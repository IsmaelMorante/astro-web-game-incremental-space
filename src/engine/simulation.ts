/**
 * Módulo puro de simulación espacial: avance temporal, generación determinista
 * de objetivos, combate contra jefes de los 4 planetas, derrota con reparación,
 * viaje entre planetas desbloqueados y activación de victoria.
 * Libre de dependencias de navegador, Canvas 2D, DOM y Web Audio.
 */

import type {
  AsteroidTarget,
  BossTarget,
  CargoState,
  EnemyTarget,
  GameState,
  GameStats,
  PlanetId,
  Projectile,
  ShipState,
  SimulationEvent,
  Target,
  Vector2D,
} from './types';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ASTEROID_RADIUS,
  BOSS_RADIUS,
  ENEMY_RADIUS,
  MAX_SIMULATION_DT_SECONDS,
  MAX_TARGETS_SIMULTANEOUS,
  OVERDRIVE_DURATION_SECONDS,
  PLANETS,
  SHIP_POSITION,
  SPAWN_INTERVAL_SECONDS,
  canChallengeBoss,
  createInitialState,
  getCannonDamage,
  getEmergencyRepairCost,
  getEmpBlastCost,
  getInitialFleetCounts,
  getInitialFleetTimers,
  getOverdriveCost,
} from './balance';
import {
  DRONE_POSITION,
  applyDamageToTarget,
  calculateDistance,
  createProjectile,
  decrementManualPulseCooldown,
  stepCombat,
} from './combat';
import { collectLoot } from './economy';

export const ARENA_SAFE_MARGIN = 20;
export const SHIP_SAFE_DISTANCE = 90;
export const DRONE_ORBIT_SPEED = 1.8;
export const DRONE_ORBIT_RADIUS = 38;

export interface SimulationStepResult {
  readonly state: GameState;
  readonly events: readonly SimulationEvent[];
}

/**
 * Puntos de aparición distribuidos en el área lógica de juego (900 x 600).
 * Mantienen holgura visual respecto a la nave central (450, 300) y entre sí.
 */
export const SPAWN_SLOTS: readonly Vector2D[] = Object.freeze([
  Object.freeze({ x: 180, y: 160 }),
  Object.freeze({ x: 450, y: 140 }),
  Object.freeze({ x: 720, y: 160 }),
  Object.freeze({ x: 740, y: 300 }),
  Object.freeze({ x: 720, y: 440 }),
  Object.freeze({ x: 450, y: 460 }),
  Object.freeze({ x: 180, y: 440 }),
  Object.freeze({ x: 160, y: 300 }),
]);

export const BOSS_SPAWN_POSITION: Vector2D = Object.freeze({
  x: 450,
  y: 140,
});

/**
 * Resuelve la siguiente posición de aparición determinista evitando
 * solapar objetivos vivos a menos de 60 píxeles.
 */
export function findNextSpawnPosition(
  existingTargets: readonly Target[],
  startIndex: number
): Vector2D {
  const totalSlots = SPAWN_SLOTS.length;

  for (let i = 0; i < totalSlots; i += 1) {
    const slot = SPAWN_SLOTS[(startIndex + i) % totalSlots];
    const isOccupied = existingTargets.some(
      (target) => calculateDistance(slot, target) < 60
    );

    if (!isOccupied) {
      return slot;
    }
  }

  return SPAWN_SLOTS[startIndex % totalSlots];
}

/**
 * Crea un asteroide o enemigo normal según la proporción de 2 asteroides
 * por cada 1 enemigo (secuencia % 3 === 2 genera enemigo).
 */
export function createDeterministicTarget(
  planetId: PlanetId,
  spawnIndex: number,
  position: Vector2D
): AsteroidTarget | EnemyTarget {
  const config = PLANETS[planetId];
  const isEnemy = spawnIndex % 3 === 2;

  if (isEnemy) {
    const vxDir = spawnIndex % 2 === 0 ? 1 : -1;
    const vyDir = spawnIndex % 4 < 2 ? 1 : -1;
    const vx = vxDir * (30 + ((spawnIndex * 5) % 15));
    const vy = vyDir * (24 + ((spawnIndex * 9) % 15));

    const enemy: EnemyTarget = {
      id: `enemy_${planetId}_${spawnIndex}`,
      type: 'enemy',
      x: position.x,
      y: position.y,
      radius: ENEMY_RADIUS,
      currentHp: config.enemy.hp,
      maxHp: config.enemy.hp,
      damage: config.enemy.damage,
      fireCooldown: config.enemy.fireIntervalSeconds,
      fireTimer: 0,
      rewardCredits: config.enemy.rewardCredits,
      spawnIndex,
      angle: 0,
      angularVelocity: 0,
      vx,
      vy,
      hitFlashTimer: 0,
    };
    return enemy;
  }

  const rotDir = spawnIndex % 2 === 0 ? 1 : -1;
  const angularVelocity = rotDir * (0.25 + ((spawnIndex * 3) % 4) * 0.1);
  const angle = (spawnIndex * 1.1) % (Math.PI * 2);
  const vxDir = spawnIndex % 4 < 2 ? 1 : -1;
  const vyDir = (spawnIndex + 1) % 4 < 2 ? 1 : -1;
  const vx = vxDir * (14 + ((spawnIndex * 7) % 12));
  const vy = vyDir * (12 + ((spawnIndex * 11) % 14));

  const asteroid: AsteroidTarget = {
    id: `ast_${planetId}_${spawnIndex}`,
    type: 'asteroid',
    x: position.x,
    y: position.y,
    radius: ASTEROID_RADIUS,
    currentHp: config.asteroid.hp,
    maxHp: config.asteroid.hp,
    rewardCredits: config.asteroid.rewardCredits,
    spawnIndex,
    angle,
    angularVelocity,
    vx,
    vy,
    hitFlashTimer: 0,
  };
  return asteroid;
}

/**
 * Crea la entidad de jefe para el planeta indicado en la posición destacada superior.
 */
export function createBossTarget(planetId: PlanetId, spawnIndex: number): BossTarget {
  const config = PLANETS[planetId].boss;
  return {
    id: `boss_${planetId}_${spawnIndex}`,
    type: 'boss',
    name: config.name,
    x: BOSS_SPAWN_POSITION.x,
    y: BOSS_SPAWN_POSITION.y,
    radius: BOSS_RADIUS,
    currentHp: config.hp,
    maxHp: config.hp,
    damage: config.damage,
    fireCooldown: config.fireIntervalSeconds,
    fireTimer: 0,
    rewardCredits: config.rewardCredits,
    spawnIndex,
    angle: 0,
    angularVelocity: 0,
    vx: 28,
    vy: 0,
    hitFlashTimer: 0,
  };
}

/**
 * Desplaza suavemente los objetivos rebotando dentro del lienzo y evitando a la nave central.
 */
export function stepTargetMotion(
  targets: readonly Target[],
  dt: number,
  shipPos: Vector2D = SHIP_POSITION
): readonly Target[] {
  return targets.map((target) => {
    const angularVelocity = target.angularVelocity ?? 0;
    const currentAngle = target.angle ?? 0;
    const nextAngle = (currentAngle + angularVelocity * dt) % (Math.PI * 2);

    let vx = target.vx ?? 0;
    let vy = target.vy ?? 0;
    let nextX = target.x + vx * dt;
    let nextY = target.y + vy * dt;

    const minX = target.radius + ARENA_SAFE_MARGIN;
    const maxX = ARENA_WIDTH - target.radius - ARENA_SAFE_MARGIN;
    const minY = target.type === 'boss' ? 100 : target.radius + 60;
    const maxY = target.type === 'boss' ? 190 : ARENA_HEIGHT - target.radius - 30;

    if (nextX < minX) {
      nextX = minX;
      vx = Math.abs(vx);
    } else if (nextX > maxX) {
      nextX = maxX;
      vx = -Math.abs(vx);
    }

    if (nextY < minY) {
      nextY = minY;
      vy = Math.abs(vy);
    } else if (nextY > maxY) {
      nextY = maxY;
      vy = -Math.abs(vy);
    }

    const dx = nextX - shipPos.x;
    const dy = nextY - shipPos.y;
    const distToShip = Math.hypot(dx, dy);

    if (distToShip < SHIP_SAFE_DISTANCE && distToShip > 0.001) {
      const nx = dx / distToShip;
      const ny = dy / distToShip;
      nextX = shipPos.x + nx * SHIP_SAFE_DISTANCE;
      nextY = shipPos.y + ny * SHIP_SAFE_DISTANCE;

      const dot = vx * nx + vy * ny;
      if (dot < 0) {
        vx -= 2 * dot * nx;
        vy -= 2 * dot * ny;
      }
    }

    const currentFlash = target.hitFlashTimer ?? 0;
    const nextFlash = Math.max(0, currentFlash - dt);

    return {
      ...target,
      x: nextX,
      y: nextY,
      angle: nextAngle,
      angularVelocity,
      vx,
      vy,
      hitFlashTimer: nextFlash,
    };
  });
}

/**
 * Rellena objetivos normales hasta alcanzar el cupo simultáneo (5)
 * si no hay combate contra jefe en curso.
 */
export function populateInitialTargets(state: GameState): GameState {
  if (state.bossActive) {
    return state;
  }

  const targets = [...state.targets];
  let spawnSeq = state.spawnSequence;

  while (targets.length < MAX_TARGETS_SIMULTANEOUS) {
    const position = findNextSpawnPosition(targets, spawnSeq);
    const newTarget = createDeterministicTarget(state.planetActual, spawnSeq, position);
    targets.push(newTarget);
    spawnSeq += 1;
  }

  return {
    ...state,
    targets,
    spawnSequence: spawnSeq,
    spawnTimer: 0,
  };
}

/**
 * Indica si el jugador cumple los requisitos para desafiar al jefe del planeta actual.
 */
export function canChallengeCurrentBoss(state: GameState): boolean {
  if (state.bossActive) {
    return false;
  }
  return canChallengeBoss(
    state.planetActual,
    state.objetivosPorPlaneta[state.planetActual]
  );
}

/**
 * Activa el combate contra el jefe del planeta actual si se alcanzó el umbral
 * de objetivos destruidos y no hay jefe activo.
 */
export function challengeBoss(state: GameState): SimulationStepResult {
  if (state.bossActive) {
    return { state, events: [] };
  }

  const currentCount = state.objetivosPorPlaneta[state.planetActual];
  if (!canChallengeBoss(state.planetActual, currentCount)) {
    return { state, events: [] };
  }

  const bossTarget = createBossTarget(state.planetActual, state.spawnSequence);
  const bossEvent: SimulationEvent = {
    type: 'boss_spawned',
    planetId: state.planetActual,
    bossName: bossTarget.name,
  };

  const nextState: GameState = {
    ...state,
    bossActive: true,
    bossTargetId: bossTarget.id,
    lockedTargetId: bossTarget.id,
    targets: [bossTarget],
    projectiles: [],
    spawnSequence: state.spawnSequence + 1,
    spawnTimer: 0,
  };

  return {
    state: nextState,
    events: [bossEvent],
  };
}

/**
 * Viaja a un planeta desbloqueado limpiando proyectiles y poblando
 * los objetivos iniciales del planeta de destino.
 */
export function travelToPlanet(state: GameState, planetId: PlanetId): GameState {
  if (planetId === state.planetActual) {
    return state;
  }

  if (planetId < 1 || planetId > 4 || planetId > state.planetasDesbloqueados) {
    return state;
  }

  const stateOnNewPlanet: GameState = {
    ...state,
    planetActual: planetId,
    bossActive: false,
    bossTargetId: null,
    lockedTargetId: null,
    targets: [],
    projectiles: [],
    spawnTimer: 0,
  };

  return populateInitialTargets(stateOnNewPlanet);
}

/**
 * Genera un nuevo estado inicial seguro con objetivos poblados para el Planeta 1.
 */
export function resetGameState(): GameState {
  const initial = createInitialState();
  return populateInitialTargets({
    ...initial,
    droneAngle: 0,
    manualPulseCooldown: 0,
  });
}

/**
 * Cierra la superposición de victoria permitiendo continuar explorando la partida.
 */
export function dismissVictoryOverlay(state: GameState): GameState {
  return {
    ...state,
    victoryAcknowledged: true,
  };
}

interface TargetDestructionContext {
  credits: number;
  cargo: CargoState;
  stats: GameStats;
  objetivosPorPlaneta: Record<PlanetId, number>;
  planetasDesbloqueados: PlanetId;
  bossActive: boolean;
  bossTargetId: string | null;
  events: SimulationEvent[];
}

function processDestroyedTargets(
  state: GameState,
  destroyedTargets: readonly Target[],
  elapsedSeconds: number
): TargetDestructionContext {
  const ctx: TargetDestructionContext = {
    credits: state.credits,
    cargo: state.cargo,
    stats: { ...state.stats },
    objetivosPorPlaneta: { ...state.objetivosPorPlaneta },
    planetasDesbloqueados: state.planetasDesbloqueados,
    bossActive: state.bossActive,
    bossTargetId: state.bossTargetId,
    events: [],
  };

  for (const target of destroyedTargets) {
    if (target.type === 'boss') {
      applyBossDestruction(state.planetActual, target, elapsedSeconds, ctx);
    } else {
      applyRegularTargetDestruction(state, target, ctx);
    }
  }

  return ctx;
}

function applyRegularTargetDestruction(
  state: GameState,
  target: AsteroidTarget | EnemyTarget,
  ctx: TargetDestructionContext
): void {
  // Construye un estado temporal para reutilizar collectLoot con la bodega y mejoras actuales
  const tempState: GameState = {
    ...state,
    credits: ctx.credits,
    cargo: ctx.cargo,
    stats: ctx.stats,
  };

  const lootResult = collectLoot(tempState, 1, target.rewardCredits);
  ctx.credits = lootResult.state.credits;
  ctx.cargo = lootResult.state.cargo;
  ctx.stats = {
    ...lootResult.state.stats,
    targetsDestroyed: ctx.stats.targetsDestroyed + 1,
  };
  ctx.objetivosPorPlaneta[state.planetActual] += 1;
  ctx.events.push(...lootResult.events);
}

function applyBossDestruction(
  planetId: PlanetId,
  target: BossTarget,
  elapsedSeconds: number,
  ctx: TargetDestructionContext
): void {
  ctx.credits += target.rewardCredits;
  ctx.stats = {
    ...ctx.stats,
    targetsDestroyed: ctx.stats.targetsDestroyed + 1,
    bossesDefeated: ctx.stats.bossesDefeated + 1,
    totalCreditsEarned: ctx.stats.totalCreditsEarned + target.rewardCredits,
  };
  ctx.bossActive = false;
  ctx.bossTargetId = null;

  ctx.events.push({
    type: 'boss_defeated',
    planetId,
    bossName: target.name,
    rewardCredits: target.rewardCredits,
  });

  if (planetId < 4) {
    const nextPlanet = (planetId + 1) as PlanetId;
    if (ctx.planetasDesbloqueados < nextPlanet) {
      ctx.planetasDesbloqueados = nextPlanet;
      ctx.events.push({
        type: 'planet_unlocked',
        planetId: nextPlanet,
      });
    }
  } else {
    ctx.events.push({
      type: 'victory',
      totalTimeSeconds: elapsedSeconds,
      stats: ctx.stats,
    });
  }
}

function handleShipRepairOnDefeat(
  ship: ShipState,
  planetId: PlanetId,
  hadBossActive: boolean,
  currentTargets: readonly Target[],
  spawnSequence: number
): {
  readonly ship: ShipState;
  readonly targets: readonly Target[];
  readonly bossActive: boolean;
  readonly bossTargetId: string | null;
  readonly lockedTargetId: string | null;
  readonly spawnSequence: number;
} {
  const repairedShip: ShipState = {
    ...ship,
    currentHull: ship.maxHull,
    currentShield: ship.maxShield,
    shieldRegenCooldown: 0,
  };

  if (!hadBossActive) {
    return {
      ship: repairedShip,
      targets: currentTargets,
      bossActive: false,
      bossTargetId: null,
      lockedTargetId: null,
      spawnSequence,
    };
  }

  // Si había jefe activo, se retira y se regeneran objetivos normales de reintento
  const targetsWithoutBoss = currentTargets.filter((t) => t.type !== 'boss');
  let targets: Target[] = [...targetsWithoutBoss];
  let seq = spawnSequence;

  while (targets.length < MAX_TARGETS_SIMULTANEOUS) {
    const position = findNextSpawnPosition(targets, seq);
    const newTarget = createDeterministicTarget(planetId, seq, position);
    targets.push(newTarget);
    seq += 1;
  }

  return {
    ship: repairedShip,
    targets,
    bossActive: false,
    bossTargetId: null,
    lockedTargetId: null,
    spawnSequence: seq,
  };
}

function spawnMissingTargets(
  state: GameState,
  dt: number
): {
  readonly targets: readonly Target[];
  readonly spawnSequence: number;
  readonly spawnTimer: number;
} {
  if (state.bossActive) {
    return {
      targets: state.targets,
      spawnSequence: state.spawnSequence,
      spawnTimer: 0,
    };
  }

  if (state.targets.length === 0) {
    const populated = populateInitialTargets(state);
    return {
      targets: populated.targets,
      spawnSequence: populated.spawnSequence,
      spawnTimer: 0,
    };
  }

  let timer = state.spawnTimer + dt;
  let targets = [...state.targets];
  let seq = state.spawnSequence;

  while (timer >= SPAWN_INTERVAL_SECONDS && targets.length < MAX_TARGETS_SIMULTANEOUS) {
    timer -= SPAWN_INTERVAL_SECONDS;
    const position = findNextSpawnPosition(targets, seq);
    const newTarget = createDeterministicTarget(state.planetActual, seq, position);
    targets.push(newTarget);
    seq += 1;
  }

  return {
    targets,
    spawnSequence: seq,
    spawnTimer: timer,
  };
}

/**
 * Avanza la simulación un paso delta de tiempo (dt en segundos).
 * Ejecuta apariciones deterministas, combate, recolección de botín,
 * recompensas de jefes y reparación instantánea tras derrota.
 */
export function stepSimulation(
  state: GameState,
  dt: number
): SimulationStepResult {
  if (dt <= 0) {
    return { state, events: [] };
  }

  const clampedDt = Math.min(dt, MAX_SIMULATION_DT_SECONDS);
  const nextElapsed = state.tiempoJugadoSegundos + clampedDt;
  const events: SimulationEvent[] = [];

  const spawnResult = spawnMissingTargets(state, clampedDt);
  const movedTargets = stepTargetMotion(spawnResult.targets, clampedDt, SHIP_POSITION);

  const nextDroneAngle = ((state.droneAngle ?? 0) + DRONE_ORBIT_SPEED * clampedDt) % (Math.PI * 2);
  const dronePos: Vector2D =
    state.upgrades.supportDrone > 0
      ? {
          x: SHIP_POSITION.x + Math.cos(nextDroneAngle) * DRONE_ORBIT_RADIUS,
          y: SHIP_POSITION.y + Math.sin(nextDroneAngle) * DRONE_ORBIT_RADIUS,
        }
      : DRONE_POSITION;

  const nextManualPulseCooldown = decrementManualPulseCooldown(
    state.manualPulseCooldown ?? 0,
    clampedDt
  );

  const isOverdrive = (state.overdriveTimer ?? 0) > 0;
  const nextOverdriveTimer = isOverdrive
    ? Math.max(0, (state.overdriveTimer ?? 0) - clampedDt)
    : 0;
  const overclockLevel = state.overclockLevel ?? 0;

  const combatResult = stepCombat(
    state.ship,
    state.upgrades,
    movedTargets,
    state.projectiles,
    state.lockedTargetId,
    clampedDt,
    SHIP_POSITION,
    dronePos,
    state.fleet,
    state.fleetTimers,
    overclockLevel,
    isOverdrive
  );

  events.push(...combatResult.events);

  const destructionCtx = processDestroyedTargets(
    state,
    combatResult.destroyedTargets,
    nextElapsed
  );
  events.push(...destructionCtx.events);

  let nextShip = combatResult.ship;
  let nextTargets = combatResult.targets;
  let nextProjectiles: readonly Projectile[] = combatResult.projectiles;
  let nextBossActive = destructionCtx.bossActive;
  let nextBossTargetId = destructionCtx.bossTargetId;
  let nextLockedTargetId = combatResult.lockedTargetId;
  let nextSpawnSequence = spawnResult.spawnSequence;

  if (combatResult.isDefeated) {
    events.push({
      type: 'player_defeated',
      planetId: state.planetActual,
    });

    const repairResult = handleShipRepairOnDefeat(
      combatResult.ship,
      state.planetActual,
      state.bossActive,
      nextTargets,
      nextSpawnSequence
    );

    nextShip = repairResult.ship;
    nextTargets = repairResult.targets;
    nextBossActive = repairResult.bossActive;
    nextBossTargetId = repairResult.bossTargetId;
    nextLockedTargetId = repairResult.lockedTargetId;
    nextSpawnSequence = repairResult.spawnSequence;
    nextProjectiles = [];
  }

  const finalState: GameState = {
    ...state,
    credits: destructionCtx.credits,
    cargo: destructionCtx.cargo,
    planetasDesbloqueados: destructionCtx.planetasDesbloqueados,
    objetivosPorPlaneta: Object.freeze(destructionCtx.objetivosPorPlaneta),
    bossActive: nextBossActive,
    bossTargetId: nextBossTargetId,
    lockedTargetId: nextLockedTargetId,
    ship: nextShip,
    targets: nextTargets,
    projectiles: nextProjectiles,
    stats: Object.freeze(destructionCtx.stats),
    tiempoJugadoSegundos: nextElapsed,
    spawnTimer: spawnResult.spawnTimer,
    spawnSequence: nextSpawnSequence,
    droneAngle: nextDroneAngle,
    manualPulseCooldown: nextManualPulseCooldown,
    overclockLevel,
    fleet: state.fleet ?? getInitialFleetCounts(),
    overdriveTimer: nextOverdriveTimer,
    fleetTimers: combatResult.fleetTimers ?? state.fleetTimers ?? getInitialFleetTimers(),
  };

  return {
    state: finalState,
    events,
  };
}

/**
 * Fija un objetivo y dispara un pulso manual instantáneo si no está en enfriamiento.
 * Daño: 60 % del daño base del cañón; Enfriamiento: 0.25 s.
 * Si está en enfriamiento, únicamente fija el objetivo sin emitir disparo.
 */
export function triggerManualPulse(
  state: GameState,
  targetId: string
): SimulationStepResult {
  const target = state.targets.find(
    (t) => t.id === targetId && t.currentHp > 0
  );

  if (!target) {
    return {
      state: {
        ...state,
        lockedTargetId: null,
      },
      events: [],
    };
  }

  const cooldown = state.manualPulseCooldown ?? 0;
  if (cooldown > 0) {
    return {
      state: {
        ...state,
        lockedTargetId: targetId,
      },
      events: [],
    };
  }

  const baseDamage = getCannonDamage(state.upgrades.cannonDamage);
  let pulseDamage = Math.round(baseDamage * 0.6);
  if ((state.overclockLevel ?? 0) > 0) {
    pulseDamage = Math.round(pulseDamage * (1 + 0.12 * state.overclockLevel));
  }
  if ((state.overdriveTimer ?? 0) > 0) {
    pulseDamage = Math.round(pulseDamage * 1.5);
  }

  const shootEvent: SimulationEvent = {
    type: 'shoot',
    shooter: 'player',
    origin: SHIP_POSITION,
    targetId: target.id,
  };

  const projectile = createProjectile('player', SHIP_POSITION, target, pulseDamage);
  const damageResult = applyDamageToTarget(state.targets, target.id, pulseDamage);
  const events: SimulationEvent[] = [shootEvent, damageResult.hitEvent];

  if (!damageResult.destroyedEvent || !damageResult.destroyedTarget) {
    return {
      state: {
        ...state,
        lockedTargetId: targetId,
        targets: damageResult.updatedTargets,
        projectiles: [...state.projectiles, projectile],
        manualPulseCooldown: 0.25,
      },
      events,
    };
  }

  events.push(damageResult.destroyedEvent);
  const destructionCtx = processDestroyedTargets(
    state,
    [damageResult.destroyedTarget],
    state.tiempoJugadoSegundos
  );
  events.push(...destructionCtx.events);

  return {
    state: {
      ...state,
      credits: destructionCtx.credits,
      cargo: destructionCtx.cargo,
      planetasDesbloqueados: destructionCtx.planetasDesbloqueados,
      objetivosPorPlaneta: Object.freeze(destructionCtx.objetivosPorPlaneta),
      bossActive: destructionCtx.bossActive,
      bossTargetId: destructionCtx.bossTargetId,
      lockedTargetId: null,
      targets: damageResult.updatedTargets,
      projectiles: [...state.projectiles, projectile],
      stats: Object.freeze(destructionCtx.stats),
      manualPulseCooldown: 0.25,
    },
    events,
  };
}

export function canActivateOverdrive(state: GameState): boolean {
  return state.credits >= getOverdriveCost(state.planetActual);
}

export function activateOverdrive(state: GameState): SimulationStepResult {
  const cost = getOverdriveCost(state.planetActual);
  if (state.credits < cost) {
    return { state, events: [] };
  }

  const event: SimulationEvent = {
    type: 'overdrive_activated',
    duration: OVERDRIVE_DURATION_SECONDS,
    cost,
  };

  return {
    state: {
      ...state,
      credits: state.credits - cost,
      overdriveTimer: OVERDRIVE_DURATION_SECONDS,
    },
    events: [event],
  };
}

export function canEmergencyRepair(state: GameState): boolean {
  return state.credits >= getEmergencyRepairCost(state.planetActual);
}

export function emergencyRepair(state: GameState): SimulationStepResult {
  const cost = getEmergencyRepairCost(state.planetActual);
  if (state.credits < cost) {
    return { state, events: [] };
  }

  const repairedShip: ShipState = {
    ...state.ship,
    currentHull: state.ship.maxHull,
    currentShield: state.ship.maxShield,
    shieldRegenCooldown: 0,
  };

  const event: SimulationEvent = {
    type: 'emergency_repair',
    hullRestored: state.ship.maxHull - state.ship.currentHull,
    shieldRestored: state.ship.maxShield - state.ship.currentShield,
    cost,
  };

  return {
    state: {
      ...state,
      credits: state.credits - cost,
      ship: repairedShip,
    },
    events: [event],
  };
}

export function canFireEmpBlast(state: GameState): boolean {
  return state.credits >= getEmpBlastCost(state.planetActual);
}

export function fireEmpBlast(state: GameState): SimulationStepResult {
  const cost = getEmpBlastCost(state.planetActual);
  if (state.credits < cost) {
    return { state, events: [] };
  }

  const baseCannon = getCannonDamage(state.upgrades.cannonDamage);
  let damage = 8 * baseCannon;
  if ((state.overclockLevel ?? 0) > 0) {
    damage = Math.round(damage * (1 + 0.12 * state.overclockLevel));
  }
  if ((state.overdriveTimer ?? 0) > 0) {
    damage = Math.round(damage * 1.5);
  }

  const aliveTargets = state.targets.filter((t) => t.currentHp > 0);
  const events: SimulationEvent[] = [
    {
      type: 'emp_blast',
      damage,
      targetsHit: aliveTargets.length,
      cost,
    },
  ];

  let currentTargets = state.targets;
  const destroyedTargets: Target[] = [];

  for (const target of aliveTargets) {
    const res = applyDamageToTarget(currentTargets, target.id, damage);
    currentTargets = res.updatedTargets;
    events.push(res.hitEvent);
    if (res.destroyedEvent && res.destroyedTarget) {
      events.push(res.destroyedEvent);
      destroyedTargets.push(res.destroyedTarget);
    }
  }

  let nextLockedTargetId = state.lockedTargetId;
  if (destroyedTargets.some((t) => t.id === state.lockedTargetId)) {
    nextLockedTargetId = null;
  }

  const destructionCtx = processDestroyedTargets(
    { ...state, credits: state.credits - cost },
    destroyedTargets,
    state.tiempoJugadoSegundos
  );
  events.push(...destructionCtx.events);

  return {
    state: {
      ...state,
      credits: destructionCtx.credits,
      cargo: destructionCtx.cargo,
      planetasDesbloqueados: destructionCtx.planetasDesbloqueados,
      objetivosPorPlaneta: Object.freeze(destructionCtx.objetivosPorPlaneta),
      bossActive: destructionCtx.bossActive,
      bossTargetId: destructionCtx.bossTargetId,
      lockedTargetId: nextLockedTargetId,
      targets: currentTargets,
      stats: Object.freeze(destructionCtx.stats),
    },
    events,
  };
}
