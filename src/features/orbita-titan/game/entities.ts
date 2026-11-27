import {
  ENEMY_PROJECTILE_SPEED,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PALETTE,
  PLANETS,
  SHIP_X,
  SHIP_Y,
  type AmbientMote,
  type CombatTarget,
  type ContractType,
  type EliteTrait,
  type FleetShipKey,
  type PlanetId,
  type Projectile,
  type SectorContract,
  type Star,
} from './types';

export interface WarpNode {
  restX: number;
  restY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface MeteorStreak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
}

export interface FleetUnitState {
  key: FleetShipKey;
  index: number;
  angle: number;
  cooldown: number;
}

export function createInitialStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 115; i++) {
    const layer = (i % 3) as 0 | 1 | 2;
    stars.push({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      size: layer === 2 ? 2.2 : layer === 1 ? 1.5 : 1.0,
      alpha: 0.25 + Math.random() * 0.65,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: 1.5 + Math.random() * 3.0,
      speed: layer === 2 ? 18 : layer === 1 ? 10 : 4,
      layer,
    });
  }
  return stars;
}

export function createInitialMotes(): AmbientMote[] {
  const motes: AmbientMote[] = [];
  for (let i = 0; i < 36; i++) {
    motes.push({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      vx: -12 - Math.random() * 18,
      vy: (Math.random() - 0.5) * 14,
      size: 1.5 + Math.random() * 2.5,
      alpha: 0.15 + Math.random() * 0.45,
    });
  }
  return motes;
}

export function createWarpGrid(): WarpNode[] {
  const grid: WarpNode[] = [];
  const cols = 19;
  const rows = 13;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rx = (c / (cols - 1)) * LOGICAL_WIDTH;
      const ry = (r / (rows - 1)) * LOGICAL_HEIGHT;
      grid.push({ restX: rx, restY: ry, x: rx, y: ry, vx: 0, vy: 0 });
    }
  }
  return grid;
}

export function applyWarpGridImpulse(
  warpGrid: WarpNode[],
  x: number,
  y: number,
  radius: number,
  strength: number
): void {
  if (warpGrid.length === 0) return;
  const cols = 19;
  const rows = 13;
  const rSq = radius * radius;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const node = warpGrid[r * cols + c];
      const dx = node.x - x;
      const dy = node.y - y;
      const dSq = dx * dx + dy * dy;
      if (dSq > 1 && dSq < rSq) {
        const dist = Math.sqrt(dSq);
        const falloff = 1 - dist / radius;
        const force = strength * falloff * falloff;
        node.vx += (dx / dist) * force * 22;
        node.vy += (dy / dist) * force * 22;
      }
    }
  }
}

export function updateWarpGrid(warpGrid: WarpNode[], dt: number): void {
  const cols = 19;
  const rows = 13;
  const stiffness = 68;
  const damping = Math.exp(-6.5 * dt);
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const node = warpGrid[r * cols + c];
      const ax = (node.restX - node.x) * stiffness;
      const ay = (node.restY - node.y) * stiffness;
      node.vx = (node.vx + ax * dt) * damping;
      node.vy = (node.vy + ay * dt) * damping;
      node.x += node.vx * dt;
      node.y += node.vy * dt;
    }
  }
}

function makeAsteroidVertices(): number[] {
  const count = 10;
  const verts: number[] = [];
  for (let i = 0; i < count; i++) {
    verts.push(0.75 + Math.random() * 0.34);
  }
  return verts;
}

function getAnomalyScale(
  anomaliaActiva: boolean,
  oleadaAnomalia: number
): { hpMult: number; dmgMult: number; lootMult: number } {
  if (!anomaliaActiva) {
    return { hpMult: 1, dmgMult: 1, lootMult: 1 };
  }
  const w = Math.max(0, oleadaAnomalia - 1);
  return {
    hpMult: 1.35 * Math.pow(1.36, w),
    dmgMult: 1.15 * Math.pow(1.12, w),
    lootMult: 1.45 * Math.pow(1.26, w),
  };
}

export function createNormalTarget(params: {
  id: number;
  spawnOrder: number;
  planetId: PlanetId;
  anomaliaActiva: boolean;
  oleadaAnomalia: number;
  spawnCycleIndex: number;
  enemySpawnCount: number;
  insideArena: boolean;
  forceKind?: 'asteroide' | 'enemigo';
}): { target: CombatTarget; isEnemy: boolean } {
  const {
    id,
    spawnOrder,
    planetId,
    anomaliaActiva,
    oleadaAnomalia,
    spawnCycleIndex,
    enemySpawnCount,
    insideArena,
    forceKind,
  } = params;

  const planet = PLANETS[anomaliaActiva ? 4 : planetId];
  const isEnemy =
    forceKind !== undefined
      ? forceKind === 'enemigo'
      : anomaliaActiva
        ? spawnCycleIndex % 2 === 1
        : spawnCycleIndex % 3 === 2;

  const angle = Math.random() * Math.PI * 2;
  const desiredOrbit = isEnemy ? 175 + Math.random() * 70 : 125 + Math.random() * 110;
  const startOrbit = insideArena ? desiredOrbit + 35 : 440 + Math.random() * 60;

  const x = SHIP_X + Math.cos(angle) * startOrbit * 1.15;
  const y = SHIP_Y + Math.sin(angle) * startOrbit * 0.85;
  const anomScale = getAnomalyScale(anomaliaActiva, oleadaAnomalia);

  if (isEnemy) {
    const nextEnemyCount = enemySpawnCount + 1;
    const eliteModulo = anomaliaActiva ? 4 : 6;
    const isElite = forceKind === undefined && nextEnemyCount % eliteModulo === 0;
    const traits: EliteTrait[] = ['blindado', 'veloz', 'sobrecargado'];
    const eliteTrait = isElite
      ? traits[(Math.floor(nextEnemyCount / eliteModulo) - 1) % traits.length]
      : undefined;

    const hpMult =
      eliteTrait === 'blindado'
        ? 3.0
        : eliteTrait === 'veloz'
          ? 2.2
          : eliteTrait === 'sobrecargado'
            ? 2.6
            : 1;
    const dmgMult = eliteTrait === 'sobrecargado' ? 1.45 : 1;
    const rateMult = eliteTrait === 'veloz' ? 0.72 : 1;
    const speedMult = eliteTrait === 'veloz' ? 1.55 : 1;

    const traitNames: Record<EliteTrait, string> = {
      blindado: 'Élite Blindado',
      veloz: 'Élite Veloz',
      sobrecargado: 'Élite Sobrecargado',
    };

    const maxHp = Math.round(planet.enemigoPv * hpMult * anomScale.hpMult);
    const reward = Math.round(planet.enemigoRecompensa * (isElite ? 3.0 : 1) * anomScale.lootMult);
    const baseXp = 10 + planet.id * 4;

    return {
      isEnemy: true,
      target: {
        id,
        spawnOrder,
        kind: 'enemigo',
        eliteTrait,
        name: eliteTrait ? traitNames[eliteTrait] : 'Interceptor hostil',
        x,
        y,
        vx: 0,
        vy: 0,
        orbitAngle: angle,
        orbitSpeed: (Math.random() < 0.5 ? 1 : -1) * (0.24 + Math.random() * 0.16) * speedMult,
        orbitRadius: startOrbit,
        desiredOrbitRadius: desiredOrbit,
        radius: isElite ? 25 : 20,
        hp: maxHp,
        maxHp,
        damage: Math.round(planet.enemigoDano * dmgMult * anomScale.dmgMult),
        fireInterval: planet.enemigoCadenciaSeg * rateMult,
        fireCooldown: 0.9 + Math.random() * planet.enemigoCadenciaSeg * 0.6,
        empStunTimer: 0,
        reward,
        coreDropCount: isElite ? (anomaliaActiva && oleadaAnomalia >= 3 ? 2 : 1) : 0,
        xpValue: Math.round(baseXp * (isElite ? 3.2 : 1) * (anomaliaActiva ? 1.35 : 1)),
        rotation: Math.atan2(SHIP_Y - y, SHIP_X - x),
        rotSpeed: 0,
        hitFlash: 0,
        telegraph: 0,
        vertices: [],
      },
    };
  }

  const maxHp = Math.round(planet.asteroidePv * anomScale.hpMult);
  const reward = Math.round(planet.asteroideRecompensa * anomScale.lootMult);
  const baseXp = 5 + planet.id * 2;

  return {
    isEnemy: false,
    target: {
      id,
      spawnOrder,
      kind: 'asteroide',
      name: 'Asteroide mineral',
      x,
      y,
      vx: 0,
      vy: 0,
      orbitAngle: angle,
      orbitSpeed: (Math.random() < 0.5 ? 1 : -1) * (0.1 + Math.random() * 0.12),
      orbitRadius: startOrbit,
      desiredOrbitRadius: desiredOrbit,
      radius: 24,
      hp: maxHp,
      maxHp,
      damage: 0,
      fireInterval: 0,
      fireCooldown: 0,
      empStunTimer: 0,
      reward,
      coreDropCount: 0,
      xpValue: Math.round(baseXp * (anomaliaActiva ? 1.35 : 1)),
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 1.1,
      hitFlash: 0,
      telegraph: 0,
      vertices: makeAsteroidVertices(),
    },
  };
}

export function createBonusEventAsteroid(params: {
  id: number;
  spawnOrder: number;
  planetId: PlanetId;
  anomaliaActiva: boolean;
  oleadaAnomalia: number;
  name: string;
  rewardMult: number;
  coreDropCount: number;
}): CombatTarget {
  const { id, spawnOrder, planetId, anomaliaActiva, oleadaAnomalia, name, rewardMult, coreDropCount } = params;
  const planet = PLANETS[anomaliaActiva ? 4 : planetId];
  const anomScale = getAnomalyScale(anomaliaActiva, oleadaAnomalia);
  const angle = Math.random() * Math.PI * 2;
  const desiredOrbit = 140 + Math.random() * 80;
  const startOrbit = 430;
  const maxHp = Math.round(planet.asteroidePv * 1.15 * anomScale.hpMult);

  return {
    id,
    spawnOrder,
    kind: 'asteroide',
    name,
    x: SHIP_X + Math.cos(angle) * startOrbit * 1.15,
    y: SHIP_Y + Math.sin(angle) * startOrbit * 0.85,
    vx: 0,
    vy: 0,
    orbitAngle: angle,
    orbitSpeed: (Math.random() < 0.5 ? 1 : -1) * 0.24,
    orbitRadius: startOrbit,
    desiredOrbitRadius: desiredOrbit,
    radius: 26,
    hp: maxHp,
    maxHp,
    damage: 0,
    fireInterval: 0,
    fireCooldown: 0,
    empStunTimer: 0,
    reward: Math.round(planet.asteroideRecompensa * rewardMult * anomScale.lootMult),
    coreDropCount,
    xpValue: Math.round((8 + planet.id * 3) * (coreDropCount > 0 ? 1.8 : 1.3)),
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: 1.4,
    hitFlash: 0,
    telegraph: 0,
    vertices: makeAsteroidVertices(),
  };
}

export function createBossTarget(params: {
  id: number;
  spawnOrder: number;
  planetId: PlanetId;
  isAnomalyBoss: boolean;
  oleadaAnomalia: number;
}): CombatTarget {
  const { id, spawnOrder, planetId, isAnomalyBoss, oleadaAnomalia } = params;
  const effectivePlanetId: PlanetId = isAnomalyBoss ? 4 : planetId;
  const planet = PLANETS[effectivePlanetId];
  const anomScale = getAnomalyScale(isAnomalyBoss, oleadaAnomalia);

  const bossHp = Math.round(planet.jefePv * (isAnomalyBoss ? anomScale.hpMult * 0.75 : 1));
  const bossDmg = Math.round(planet.jefeDano * (isAnomalyBoss ? anomScale.dmgMult : 1));
  const bossReward = Math.round(planet.jefeRecompensa * (isAnomalyBoss ? anomScale.lootMult : 1));
  const bossName = isAnomalyBoss ? `Titán Anómalo · O${oleadaAnomalia}` : planet.jefeNombre;

  return {
    id,
    spawnOrder,
    kind: 'jefe',
    bossPlanetId: effectivePlanetId,
    bossAttackCount: 0,
    bossSummonedEscorts: false,
    name: bossName,
    x: SHIP_X + 460,
    y: SHIP_Y - 120,
    vx: 0,
    vy: 0,
    orbitAngle: -0.25,
    orbitSpeed: effectivePlanetId === 3 ? 0.34 : 0.28,
    orbitRadius: 430,
    desiredOrbitRadius: 210,
    radius: 40,
    hp: bossHp,
    maxHp: bossHp,
    damage: bossDmg,
    fireInterval: planet.jefeCadenciaSeg,
    fireCooldown: 1.25,
    empStunTimer: 0,
    reward: bossReward,
    coreDropCount: isAnomalyBoss ? 2 : planet.id >= 3 ? 3 : 2,
    xpValue: 55 + planet.id * 25,
    rotation: Math.PI,
    rotSpeed: 0,
    hitFlash: 0,
    telegraph: 0,
    vertices: [],
  };
}

export function spawnBossAttackProjectiles(
  boss: CombatTarget,
  nextId: () => number
): Projectile[] {
  const count = (boss.bossAttackCount ?? 0) + 1;
  boss.bossAttackCount = count;

  const bossId = boss.bossPlanetId ?? 1;
  const aimAngle = Math.atan2(SHIP_Y - boss.y, SHIP_X - boss.x);
  const isPhase2 = boss.hp < boss.maxHp * 0.5;
  const projectiles: Projectile[] = [];

  const pushShot = (angle: number, speedMult = 1, dmgMult = 1, radius = 6, spawnX = boss.x, spawnY = boss.y, color: string = PALETTE.boss) => {
    const spd = ENEMY_PROJECTILE_SPEED * speedMult;
    projectiles.push({
      id: nextId(),
      fromPlayer: false,
      sourceKind: 'boss',
      x: spawnX + Math.cos(angle) * (boss.radius + 4),
      y: spawnY + Math.sin(angle) * (boss.radius + 4),
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      damage: Math.max(1, Math.round(boss.damage * dmgMult)),
      radius,
      color,
      targetId: null,
      life: 4.2,
    });
  };

  if (bossId === 1) {
    // Perforadora Titán: salva doble paralela + lanza central pesada (y flancos angulados en Fase 2)
    const perp = aimAngle + Math.PI / 2;
    const offset = 10;
    pushShot(aimAngle, 0.98, 0.72, 5.5, boss.x + Math.cos(perp) * offset, boss.y + Math.sin(perp) * offset);
    pushShot(aimAngle, 0.98, 0.72, 5.5, boss.x - Math.cos(perp) * offset, boss.y - Math.sin(perp) * offset);
    if (count % 3 === 0 || isPhase2) {
      pushShot(aimAngle, 1.15, 0.95, 7, boss.x, boss.y, PALETTE.warning);
    }
    if (isPhase2) {
      pushShot(aimAngle - 0.14, 1.04, 0.65, 5.2, boss.x, boss.y, PALETTE.warning);
      pushShot(aimAngle + 0.14, 1.04, 0.65, 5.2, boss.x, boss.y, PALETTE.warning);
    }
  } else if (bossId === 2) {
    // Fragata Cobalto: abanico táctico de 3 proyectiles (5 proyectiles en Fase 2)
    if (isPhase2) {
      for (const delta of [-0.36, -0.18, 0, 0.18, 0.36]) {
        pushShot(
          aimAngle + delta,
          delta === 0 ? 1.18 : 1.08,
          delta === 0 ? 0.85 : 0.6,
          delta === 0 ? 6.4 : 5.2,
          boss.x,
          boss.y,
          delta === 0 ? PALETTE.boss : '#FF3B9A'
        );
      }
    } else {
      pushShot(aimAngle - 0.21, 1.1, 0.65, 5.5, boss.x, boss.y, '#FF3B9A');
      pushShot(aimAngle, 1.16, 0.85, 6.2, boss.x, boss.y, PALETTE.boss);
      pushShot(aimAngle + 0.21, 1.1, 0.65, 5.5, boss.x, boss.y, '#FF3B9A');
    }
  } else if (bossId === 3) {
    // Crucero Nebular: alterna ráfaga directa y cruz rotatoria (añade alas oblicuas en Fase 2)
    if (count % 2 === 0) {
      const baseRot = count * 0.35;
      for (let k = 0; k < 4; k++) {
        pushShot(aimAngle + baseRot + (k * Math.PI) / 2, 0.95, 0.7, 5.8, boss.x, boss.y, PALETTE.stellarCore);
      }
      if (isPhase2) {
        pushShot(aimAngle, 1.14, 0.85, 6.2, boss.x, boss.y, PALETTE.boss);
      }
    } else {
      const deltas = isPhase2 ? [-0.42, -0.1, 0.1, 0.42] : [-0.1, 0.1];
      for (const d of deltas) {
        pushShot(aimAngle + d, 1.08, 0.72, 5.6, boss.x, boss.y, Math.abs(d) > 0.2 ? PALETTE.stellarCore : PALETTE.boss);
      }
    }
  } else {
    // Guardián Solar / Titán Anómalo: abanico solar de 5 haces (+ anillo radial cada 2 salvas en Fase 2)
    const angles = isPhase2 ? [-0.36, -0.18, 0, 0.18, 0.36] : [-0.26, -0.13, 0, 0.13, 0.26];
    for (const delta of angles) {
      pushShot(
        aimAngle + delta,
        delta === 0 ? 1.12 : 1.0,
        delta === 0 ? 0.85 : 0.58,
        delta === 0 ? 6.8 : 5.2,
        boss.x,
        boss.y,
        delta === 0 ? PALETTE.warning : PALETTE.boss
      );
    }
    if (isPhase2 && count % 2 === 0) {
      for (let k = 0; k < 8; k++) {
        pushShot(aimAngle + (k * Math.PI) / 4, 0.82, 0.52, 4.8, boss.x, boss.y, PALETTE.warning);
      }
    }
  }

  return projectiles;
}

const CONTRACT_POOL: { type: ContractType; titulo: (meta: number) => string; baseMeta: number }[] = [
  {
    type: 'asteroides',
    titulo: (m) => `Extrae ${m} asteroides minerales`,
    baseMeta: 5,
  },
  {
    type: 'enemigos',
    titulo: (m) => `Destruye ${m} interceptores hostiles`,
    baseMeta: 4,
  },
  {
    type: 'bajas_manuales',
    titulo: (m) => `Lanza ${m} pulsos manuales (clic/toque)`,
    baseMeta: 6,
  },
  {
    type: 'elites',
    titulo: (m) => `Abate ${m} enemigo élite`,
    baseMeta: 1,
  },
  {
    type: 'orbes_racha',
    titulo: (m) => `Alcanza una racha de ${m} orbes`,
    baseMeta: 5,
  },
];

export function createSectorContract(
  contractId: number,
  unlockedPlanet: PlanetId
): SectorContract {
  const template = CONTRACT_POOL[(contractId - 1) % CONTRACT_POOL.length];
  const scaleMeta =
    template.type === 'elites'
      ? unlockedPlanet >= 3
        ? 2
        : 1
      : template.type === 'orbes_racha'
        ? Math.min(10, template.baseMeta + (unlockedPlanet - 1))
        : template.baseMeta + (unlockedPlanet - 1) * 2;

  const creditBase = [75, 190, 440, 920][unlockedPlanet - 1] ?? 75;
  const bonusMult = template.type === 'elites' ? 1.55 : 1.0;

  return {
    id: contractId,
    type: template.type,
    titulo: template.titulo(scaleMeta),
    progreso: 0,
    meta: scaleMeta,
    recompensaCreditos: Math.round(creditBase * bonusMult),
    recompensaNucleos: template.type === 'elites' || contractId % 3 === 0 ? 1 : 0,
  };
}
