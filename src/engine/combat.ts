/**
 * Módulo puro de combate espacial: autoapuntado, fijación manual,
 * cadencia de nave y dron de apoyo, absorción de escudo y casco.
 * Libre de dependencias de navegador, DOM, Canvas 2D y Web Audio.
 */

import type {
  FleetCounts,
  FleetShipType,
  FleetTimers,
  GameState,
  Projectile,
  ShipState,
  ShooterType,
  SimulationEvent,
  Target,
  UpgradeLevels,
  Vector2D,
} from './types';
import {
  COMBAT_SHIELD_REGEN_RATIO,
  DRONE_FIRE_INTERVAL_SECONDS,
  FLEET_CONFIGS,
  PROJECTILE_SPEED,
  SHIELD_REGEN_DELAY_SECONDS,
  SHIELD_REGEN_RATE_PERCENT,
  SHIP_POSITION,
  getCannonDamage,
  getDroneDamage,
  getFireInterval,
} from './balance';

export const DRONE_OFFSET: Vector2D = Object.freeze({
  x: 30,
  y: -25,
});

export const DRONE_POSITION: Vector2D = Object.freeze({
  x: SHIP_POSITION.x + DRONE_OFFSET.x,
  y: SHIP_POSITION.y + DRONE_OFFSET.y,
});

let projectileSequence = 0;

export function decrementManualPulseCooldown(
  currentCooldown: number,
  dt: number
): number {
  return Math.max(0, currentCooldown - dt);
}

export function resetProjectileSequence(): void {
  projectileSequence = 0;
}

export function calculateDistance(a: Vector2D, b: Vector2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function findNearestTarget<T extends Target>(
  candidates: readonly T[],
  origin: Vector2D
): T {
  let nearest = candidates[0];
  let minDistance = calculateDistance(origin, nearest);

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const distance = calculateDistance(origin, candidate);
    // Prioridad por cercanía física; en empate técnico, desempata por orden de aparición
    const isCloser = distance < minDistance - 0.001;
    const isTieWithLowerSpawn =
      Math.abs(distance - minDistance) <= 0.001 &&
      candidate.spawnIndex < nearest.spawnIndex;

    if (isCloser || isTieWithLowerSpawn) {
      nearest = candidate;
      minDistance = distance;
    }
  }

  return nearest;
}

export function selectTarget(
  targets: readonly Target[],
  shipPos: Vector2D = SHIP_POSITION,
  lockedTargetId: string | null = null
): Target | null {
  if (lockedTargetId !== null) {
    const locked = targets.find(
      (target) => target.id === lockedTargetId && target.currentHp > 0
    );
    if (locked) {
      return locked;
    }
  }

  const aliveTargets = targets.filter((target) => target.currentHp > 0);
  if (aliveTargets.length === 0) {
    return null;
  }

  // Prioridad 1: jefe activo
  const boss = aliveTargets.find((target) => target.type === 'boss');
  if (boss) {
    return boss;
  }

  // Prioridad 2: enemigo hostil más cercano
  const enemies = aliveTargets.filter((target) => target.type === 'enemy');
  if (enemies.length > 0) {
    return findNearestTarget(enemies, shipPos);
  }

  // Prioridad 3: asteroide más cercano
  const asteroids = aliveTargets.filter((target) => target.type === 'asteroid');
  if (asteroids.length > 0) {
    return findNearestTarget(asteroids, shipPos);
  }

  return null;
}

export function resolveLockedTargetId(
  lockedTargetId: string | null,
  targets: readonly Target[]
): string | null {
  if (lockedTargetId === null) {
    return null;
  }
  const exists = targets.some((t) => t.id === lockedTargetId && t.currentHp > 0);
  return exists ? lockedTargetId : null;
}

export function setLockedTarget(
  state: GameState,
  targetId: string | null
): GameState {
  if (targetId === null) {
    return { ...state, lockedTargetId: null };
  }

  const exists = state.targets.some(
    (target) => target.id === targetId && target.currentHp > 0
  );

  return {
    ...state,
    lockedTargetId: exists ? targetId : null,
  };
}

export function createProjectile(
  shooter: ShooterType,
  origin: Vector2D,
  target: Target,
  damage: number
): Projectile {
  projectileSequence += 1;
  return {
    id: `proj_${shooter}_${projectileSequence}`,
    shooter,
    x: origin.x,
    y: origin.y,
    targetX: target.x,
    targetY: target.y,
    speed: PROJECTILE_SPEED,
    damage,
    targetId: target.id,
  };
}

export interface ShipDamageResult {
  readonly ship: ShipState;
  readonly event: SimulationEvent;
  readonly isDefeated: boolean;
}

export function applyDamageToShip(
  ship: ShipState,
  damage: number
): ShipDamageResult {
  const shieldDamage = Math.min(ship.currentShield, damage);
  const remainingDamage = damage - shieldDamage;
  const hullDamage = Math.min(ship.currentHull, remainingDamage);
  const nextShield = Math.max(0, ship.currentShield - shieldDamage);
  const nextHull = Math.max(0, ship.currentHull - hullDamage);

  const updatedShip: ShipState = {
    ...ship,
    currentShield: nextShield,
    currentHull: nextHull,
    shieldRegenCooldown: SHIELD_REGEN_DELAY_SECONDS,
  };

  const event: SimulationEvent = {
    type: 'player_hit',
    shieldDamage,
    hullDamage,
    currentShield: nextShield,
    currentHull: nextHull,
  };

  return {
    ship: updatedShip,
    event,
    isDefeated: nextHull <= 0,
  };
}

export function stepShieldRegen(ship: ShipState, dt: number): ShipState {
  if (ship.currentShield >= ship.maxShield) {
    if (ship.shieldRegenCooldown > 0) {
      return {
        ...ship,
        shieldRegenCooldown: Math.max(0, ship.shieldRegenCooldown - dt),
      };
    }
    return ship;
  }

  if (ship.shieldRegenCooldown > 0) {
    const nextCooldown = Math.max(0, ship.shieldRegenCooldown - dt);
    const slowRegenAmount =
      ship.maxShield * SHIELD_REGEN_RATE_PERCENT * COMBAT_SHIELD_REGEN_RATIO * dt;
    const nextShield = Math.min(ship.maxShield, ship.currentShield + slowRegenAmount);
    return {
      ...ship,
      currentShield: nextShield,
      shieldRegenCooldown: nextCooldown,
    };
  }

  const regenAmount = ship.maxShield * SHIELD_REGEN_RATE_PERCENT * dt;
  const nextShield = Math.min(ship.maxShield, ship.currentShield + regenAmount);

  return {
    ...ship,
    currentShield: nextShield,
  };
}

export interface ApplyTargetDamageResult {
  readonly updatedTargets: readonly Target[];
  readonly hitEvent: SimulationEvent;
  readonly destroyedEvent: SimulationEvent | null;
  readonly destroyedTarget: Target | null;
}

export function applyDamageToTarget(
  targets: readonly Target[],
  targetId: string,
  damage: number
): ApplyTargetDamageResult {
  const targetIndex = targets.findIndex((t) => t.id === targetId);
  if (targetIndex === -1) {
    throw new Error(`Target ${targetId} no encontrado para aplicar daño.`);
  }

  const target = targets[targetIndex];
  const nextHp = Math.max(0, target.currentHp - damage);
  const hitEvent: SimulationEvent = {
    type: 'hit',
    targetId: target.id,
    damage,
  };

  if (nextHp <= 0) {
    const updatedTargets = targets.filter((_, idx) => idx !== targetIndex);
    const destroyedEvent: SimulationEvent = {
      type: 'target_destroyed',
      targetType: target.type,
      targetId: target.id,
      rewardCredits: target.rewardCredits,
      wasCargoCollected: false,
    };

    return {
      updatedTargets,
      hitEvent,
      destroyedEvent,
      destroyedTarget: target,
    };
  }

  const updatedTarget = {
    ...target,
    currentHp: nextHp,
    hitFlashTimer: 0.12,
  };
  const updatedTargets = targets.map((t, idx) => (idx === targetIndex ? updatedTarget : t));

  return {
    updatedTargets,
    hitEvent,
    destroyedEvent: null,
    destroyedTarget: null,
  };
}

export interface ShipFireResult {
  readonly ship: ShipState;
  readonly targets: readonly Target[];
  readonly newProjectiles: readonly Projectile[];
  readonly events: readonly SimulationEvent[];
  readonly destroyedTargets: readonly Target[];
  readonly lockedTargetId: string | null;
}

export function stepShipFire(
  ship: ShipState,
  upgrades: UpgradeLevels,
  targets: readonly Target[],
  lockedTargetId: string | null,
  dt: number,
  shipPos: Vector2D = SHIP_POSITION,
  overclockLevel: number = 0,
  isOverdrive: boolean = false
): ShipFireResult {
  const interval = getFireInterval(upgrades.fireRate);
  const newTimer = ship.fireTimer + dt;

  if (newTimer < interval) {
    return {
      ship: { ...ship, fireTimer: newTimer },
      targets,
      newProjectiles: [],
      events: [],
      destroyedTargets: [],
      lockedTargetId,
    };
  }

  const currentTarget = selectTarget(targets, shipPos, lockedTargetId);
  if (!currentTarget) {
    return {
      ship: { ...ship, fireTimer: interval },
      targets,
      newProjectiles: [],
      events: [],
      destroyedTargets: [],
      lockedTargetId,
    };
  }

  let damage = getCannonDamage(upgrades.cannonDamage);
  if (overclockLevel > 0) {
    damage = Math.round(damage * (1 + 0.12 * overclockLevel));
  }
  if (isOverdrive) {
    damage = Math.round(damage * 1.5);
  }

  const shootEvent: SimulationEvent = {
    type: 'shoot',
    shooter: 'player',
    origin: shipPos,
    targetId: currentTarget.id,
  };

  const projectile = createProjectile('player', shipPos, currentTarget, damage);
  const damageResult = applyDamageToTarget(targets, currentTarget.id, damage);

  const events: SimulationEvent[] = [shootEvent, damageResult.hitEvent];
  const destroyedTargets: Target[] = [];

  let nextLockedTargetId = lockedTargetId;
  if (damageResult.destroyedEvent && damageResult.destroyedTarget) {
    events.push(damageResult.destroyedEvent);
    destroyedTargets.push(damageResult.destroyedTarget);
    if (lockedTargetId === damageResult.destroyedTarget.id) {
      nextLockedTargetId = null;
    }
  }

  return {
    ship: { ...ship, fireTimer: newTimer - interval },
    targets: damageResult.updatedTargets,
    newProjectiles: [projectile],
    events,
    destroyedTargets,
    lockedTargetId: nextLockedTargetId,
  };
}

export interface DroneFireResult {
  readonly ship: ShipState;
  readonly targets: readonly Target[];
  readonly newProjectiles: readonly Projectile[];
  readonly events: readonly SimulationEvent[];
  readonly destroyedTargets: readonly Target[];
  readonly lockedTargetId: string | null;
}

export function stepDroneFire(
  ship: ShipState,
  upgrades: UpgradeLevels,
  targets: readonly Target[],
  lockedTargetId: string | null,
  dt: number,
  dronePos: Vector2D = DRONE_POSITION,
  overclockLevel: number = 0,
  isOverdrive: boolean = false
): DroneFireResult {
  if (upgrades.supportDrone <= 0) {
    return {
      ship: { ...ship, droneFireTimer: 0 },
      targets,
      newProjectiles: [],
      events: [],
      destroyedTargets: [],
      lockedTargetId,
    };
  }

  const interval = DRONE_FIRE_INTERVAL_SECONDS;
  const newTimer = ship.droneFireTimer + dt;

  if (newTimer < interval) {
    return {
      ship: { ...ship, droneFireTimer: newTimer },
      targets,
      newProjectiles: [],
      events: [],
      destroyedTargets: [],
      lockedTargetId,
    };
  }

  const currentTarget = selectTarget(targets, dronePos, lockedTargetId);
  if (!currentTarget) {
    return {
      ship: { ...ship, droneFireTimer: interval },
      targets,
      newProjectiles: [],
      events: [],
      destroyedTargets: [],
      lockedTargetId,
    };
  }

  let damage = getDroneDamage(upgrades.supportDrone);
  if (overclockLevel > 0) {
    damage = Math.round(damage * (1 + 0.12 * overclockLevel));
  }
  if (isOverdrive) {
    damage = Math.round(damage * 1.5);
  }

  const shootEvent: SimulationEvent = {
    type: 'shoot',
    shooter: 'drone',
    origin: dronePos,
    targetId: currentTarget.id,
  };

  const projectile = createProjectile('drone', dronePos, currentTarget, damage);
  const damageResult = applyDamageToTarget(targets, currentTarget.id, damage);

  const events: SimulationEvent[] = [shootEvent, damageResult.hitEvent];
  const destroyedTargets: Target[] = [];

  let nextLockedTargetId = lockedTargetId;
  if (damageResult.destroyedEvent && damageResult.destroyedTarget) {
    events.push(damageResult.destroyedEvent);
    destroyedTargets.push(damageResult.destroyedTarget);
    if (lockedTargetId === damageResult.destroyedTarget.id) {
      nextLockedTargetId = null;
    }
  }

  return {
    ship: { ...ship, droneFireTimer: newTimer - interval },
    targets: damageResult.updatedTargets,
    newProjectiles: [projectile],
    events,
    destroyedTargets,
    lockedTargetId: nextLockedTargetId,
  };
}

export interface EnemyCombatResult {
  readonly ship: ShipState;
  readonly targets: readonly Target[];
  readonly newProjectiles: readonly Projectile[];
  readonly events: readonly SimulationEvent[];
  readonly isDefeated: boolean;
}

export function stepEnemyCombat(
  targets: readonly Target[],
  ship: ShipState,
  dt: number,
  shipPos: Vector2D = SHIP_POSITION
): EnemyCombatResult {
  let currentShip = ship;
  const updatedTargets: Target[] = [];
  const newProjectiles: Projectile[] = [];
  const events: SimulationEvent[] = [];
  let isDefeated = false;

  for (const target of targets) {
    if (target.type === 'asteroid') {
      updatedTargets.push(target);
      continue;
    }

    const newTimer = target.fireTimer + dt;
    if (newTimer < target.fireCooldown) {
      updatedTargets.push({ ...target, fireTimer: newTimer });
      continue;
    }

    const shootEvent: SimulationEvent = {
      type: 'shoot',
      shooter: target.type,
      origin: { x: target.x, y: target.y },
    };
    events.push(shootEvent);

    projectileSequence += 1;
    newProjectiles.push({
      id: `proj_${target.type}_${projectileSequence}`,
      shooter: target.type,
      x: target.x,
      y: target.y,
      targetX: shipPos.x,
      targetY: shipPos.y,
      speed: PROJECTILE_SPEED,
      damage: target.damage,
    });

    const damageResult = applyDamageToShip(currentShip, target.damage);
    currentShip = damageResult.ship;
    events.push(damageResult.event);

    if (damageResult.isDefeated) {
      isDefeated = true;
    }

    updatedTargets.push({
      ...target,
      fireTimer: newTimer - target.fireCooldown,
    });
  }

  return {
    ship: currentShip,
    targets: updatedTargets,
    newProjectiles,
    events,
    isDefeated,
  };
}

export function updateProjectiles(
  projectiles: readonly Projectile[],
  dt: number
): readonly Projectile[] {
  const remainingProjectiles: Projectile[] = [];

  for (const proj of projectiles) {
    const dx = proj.targetX - proj.x;
    const dy = proj.targetY - proj.y;
    const distance = Math.hypot(dx, dy);
    const stepDistance = proj.speed * dt;

    if (distance <= stepDistance) {
      continue;
    }

    const ratio = stepDistance / distance;
    remainingProjectiles.push({
      ...proj,
      x: proj.x + dx * ratio,
      y: proj.y + dy * ratio,
    });
  }

  return remainingProjectiles;
}

export interface FleetFireResult {
  readonly fleetTimers: FleetTimers;
  readonly targets: readonly Target[];
  readonly newProjectiles: readonly Projectile[];
  readonly events: readonly SimulationEvent[];
  readonly destroyedTargets: readonly Target[];
  readonly lockedTargetId: string | null;
}

const FLEET_SHIP_TYPES: readonly FleetShipType[] = ['interceptor', 'corvette', 'frigate'];

export function getFleetShipPosition(
  shipType: FleetShipType,
  index: number,
  shipPos: Vector2D = SHIP_POSITION
): Vector2D {
  const side = index % 2 === 0 ? -1 : 1;
  const pairIndex = Math.floor(index / 2);

  switch (shipType) {
    case 'interceptor':
      return {
        x: shipPos.x + side * (45 + pairIndex * 18),
        y: shipPos.y - 25 - pairIndex * 10,
      };
    case 'corvette':
      return {
        x: shipPos.x + side * (75 + pairIndex * 22),
        y: shipPos.y + 5 + pairIndex * 12,
      };
    case 'frigate':
      return {
        x: shipPos.x + side * (105 + pairIndex * 26),
        y: shipPos.y + 35 + pairIndex * 14,
      };
  }
}

export function stepFleetFire(
  fleet: FleetCounts | undefined,
  fleetTimers: FleetTimers | undefined,
  targets: readonly Target[],
  lockedTargetId: string | null,
  dt: number,
  shipPos: Vector2D = SHIP_POSITION,
  overclockLevel: number = 0,
  isOverdrive: boolean = false
): FleetFireResult {
  const nextTimers: Record<FleetShipType, number> = {
    interceptor: fleetTimers?.interceptor ?? 0,
    corvette: fleetTimers?.corvette ?? 0,
    frigate: fleetTimers?.frigate ?? 0,
  };

  if (!fleet) {
    return {
      fleetTimers: nextTimers,
      targets,
      newProjectiles: [],
      events: [],
      destroyedTargets: [],
      lockedTargetId,
    };
  }

  let currentTargets = targets;
  let currentLockedId = lockedTargetId;
  const newProjectiles: Projectile[] = [];
  const events: SimulationEvent[] = [];
  const destroyedTargets: Target[] = [];

  for (const shipType of FLEET_SHIP_TYPES) {
    const count = fleet[shipType] ?? 0;
    if (count <= 0) {
      continue;
    }

    const config = FLEET_CONFIGS[shipType];
    const timer = nextTimers[shipType] + dt;

    if (timer < config.fireInterval) {
      nextTimers[shipType] = timer;
      continue;
    }

    nextTimers[shipType] = timer - config.fireInterval;

    let baseDamage = config.damage;
    if (overclockLevel > 0) {
      baseDamage = Math.round(baseDamage * (1 + 0.12 * overclockLevel));
    }
    if (isOverdrive) {
      baseDamage = Math.round(baseDamage * 1.5);
    }

    for (let i = 0; i < count; i += 1) {
      const shipOrigin = getFleetShipPosition(shipType, i, shipPos);
      const target = selectTarget(currentTargets, shipOrigin, currentLockedId);
      if (!target) {
        break;
      }

      const shootEvent: SimulationEvent = {
        type: 'shoot',
        shooter: 'fleet',
        origin: shipOrigin,
        targetId: target.id,
      };
      const proj = createProjectile('fleet', shipOrigin, target, baseDamage);
      const dmgRes = applyDamageToTarget(currentTargets, target.id, baseDamage);

      newProjectiles.push(proj);
      events.push(shootEvent, dmgRes.hitEvent);
      currentTargets = dmgRes.updatedTargets;

      if (dmgRes.destroyedEvent && dmgRes.destroyedTarget) {
        events.push(dmgRes.destroyedEvent);
        destroyedTargets.push(dmgRes.destroyedTarget);
        if (currentLockedId === dmgRes.destroyedTarget.id) {
          currentLockedId = null;
        }
      }
    }
  }

  return {
    fleetTimers: nextTimers,
    targets: currentTargets,
    newProjectiles,
    events,
    destroyedTargets,
    lockedTargetId: currentLockedId,
  };
}

export interface FullCombatStepResult {
  readonly ship: ShipState;
  readonly targets: readonly Target[];
  readonly projectiles: readonly Projectile[];
  readonly lockedTargetId: string | null;
  readonly events: readonly SimulationEvent[];
  readonly destroyedTargets: readonly Target[];
  readonly isDefeated: boolean;
  readonly fleetTimers?: FleetTimers;
}

export function stepCombat(
  ship: ShipState,
  upgrades: UpgradeLevels,
  targets: readonly Target[],
  projectiles: readonly Projectile[],
  lockedTargetId: string | null,
  dt: number,
  shipPos: Vector2D = SHIP_POSITION,
  dronePos: Vector2D = DRONE_POSITION,
  fleet?: FleetCounts,
  fleetTimers?: FleetTimers,
  overclockLevel: number = 0,
  isOverdrive: boolean = false
): FullCombatStepResult {
  const activeProjectiles = updateProjectiles(projectiles, dt);
  const collectedEvents: SimulationEvent[] = [];
  const destroyedTargets: Target[] = [];

  const shipFire = stepShipFire(
    ship,
    upgrades,
    targets,
    lockedTargetId,
    dt,
    shipPos,
    overclockLevel,
    isOverdrive
  );
  let currentShip = shipFire.ship;
  let currentTargets = shipFire.targets;
  let currentLockedId = shipFire.lockedTargetId;
  collectedEvents.push(...shipFire.events);
  destroyedTargets.push(...shipFire.destroyedTargets);

  const droneFire = stepDroneFire(
    currentShip,
    upgrades,
    currentTargets,
    currentLockedId,
    dt,
    dronePos,
    overclockLevel,
    isOverdrive
  );
  currentShip = droneFire.ship;
  currentTargets = droneFire.targets;
  currentLockedId = droneFire.lockedTargetId;
  collectedEvents.push(...droneFire.events);
  destroyedTargets.push(...droneFire.destroyedTargets);

  const fleetFire = stepFleetFire(
    fleet,
    fleetTimers,
    currentTargets,
    currentLockedId,
    dt,
    shipPos,
    overclockLevel,
    isOverdrive
  );
  currentTargets = fleetFire.targets;
  currentLockedId = fleetFire.lockedTargetId;
  collectedEvents.push(...fleetFire.events);
  destroyedTargets.push(...fleetFire.destroyedTargets);

  const enemyFire = stepEnemyCombat(currentTargets, currentShip, dt, shipPos);
  currentShip = enemyFire.ship;
  currentTargets = enemyFire.targets;
  collectedEvents.push(...enemyFire.events);

  currentShip = stepShieldRegen(currentShip, dt);

  const allProjectiles = [
    ...activeProjectiles,
    ...shipFire.newProjectiles,
    ...droneFire.newProjectiles,
    ...fleetFire.newProjectiles,
    ...enemyFire.newProjectiles,
  ];

  return {
    ship: currentShip,
    targets: currentTargets,
    projectiles: allProjectiles,
    lockedTargetId: currentLockedId,
    events: collectedEvents,
    destroyedTargets,
    isDefeated: enemyFire.isDefeated || currentShip.currentHull <= 0,
    fleetTimers: fleetFire.fleetTimers,
  };
}
