/**
 * Tabla de balance y fórmulas del motor de juego incremental espacial.
 * Valores exactos según docs/dev/feat--gdd-prototipo-espacial/gdd.md.
 */

import type {
  FleetCounts,
  FleetShipType,
  FleetTimers,
  GameState,
  PlanetConfig,
  PlanetId,
  UpgradeKey,
  UpgradeLevels,
  UpgradeTier,
  Vector2D,
} from './types';

export const ARENA_WIDTH = 900;
export const ARENA_HEIGHT = 600;

export const SHIP_POSITION: Vector2D = Object.freeze({
  x: 450,
  y: 300,
});

export const MAX_TARGETS_SIMULTANEOUS = 5;
export const SPAWN_INTERVAL_SECONDS = 0.6;
export const PROJECTILE_SPEED = 600;
export const SHIELD_REGEN_DELAY_SECONDS = 2.0;
export const SHIELD_REGEN_RATE_PERCENT = 0.2;
export const COMBAT_SHIELD_REGEN_RATIO = 0.25;
export const DRONE_FIRE_INTERVAL_SECONDS = 1.0;
export const SAVE_STORAGE_KEY = 'astro-incremental-save-v1';
export const SAVE_INTERVAL_SECONDS = 10;
export const MAX_SIMULATION_DT_SECONDS = 0.1;

export const OVERDRIVE_DURATION_SECONDS = 15;
export const OVERDRIVE_DAMAGE_MULTIPLIER = 1.5;

export const OVERCLOCK_BASE_COST = 800;
export const OVERCLOCK_COST_PER_LEVEL = 400;
export const OVERCLOCK_DAMAGE_MULTIPLIER_PER_LEVEL = 0.12;

export const FLEET_CAPS: Readonly<Record<FleetShipType, number>> = Object.freeze({
  interceptor: 6,
  corvette: 4,
  frigate: 3,
});

export interface FleetShipConfig {
  readonly type: FleetShipType;
  readonly name: string;
  readonly baseCost: number;
  readonly costPerUnit: number;
  readonly cap: number;
  readonly damage: number;
  readonly fireInterval: number;
}

export const FLEET_CONFIGS: Readonly<Record<FleetShipType, FleetShipConfig>> = Object.freeze({
  interceptor: Object.freeze({
    type: 'interceptor',
    name: 'Caza Interceptor',
    baseCost: 600,
    costPerUnit: 350,
    cap: 6,
    damage: 8,
    fireInterval: 0.5,
  }),
  corvette: Object.freeze({
    type: 'corvette',
    name: 'Corbeta Láser',
    baseCost: 1400,
    costPerUnit: 700,
    cap: 4,
    damage: 35,
    fireInterval: 1.0,
  }),
  frigate: Object.freeze({
    type: 'frigate',
    name: 'Fragata Pesada',
    baseCost: 2800,
    costPerUnit: 1200,
    cap: 3,
    damage: 160,
    fireInterval: 2.0,
  }),
});

export const ASTEROID_RADIUS = 26;
export const ENEMY_RADIUS = 22;
export const BOSS_RADIUS = 46;

export const AUTOSELL_COST = 500;

export const UPGRADE_CAPS: Readonly<Record<UpgradeKey, number>> = Object.freeze({
  cannonDamage: 20,
  fireRate: 15,
  hullShield: 15,
  cargoCapacity: 10,
  supportDrone: 10,
  autoSell: 1,
});

export const PLANETS: Readonly<Record<PlanetId, PlanetConfig>> = Object.freeze({
  1: Object.freeze({
    id: 1,
    name: 'Cinturón de Hierro',
    asteroid: Object.freeze({
      hp: 60,
      damage: 0,
      rewardCredits: 10,
    }),
    enemy: Object.freeze({
      hp: 110,
      damage: 6,
      fireIntervalSeconds: 2.0,
      rewardCredits: 22,
    }),
    bossThreshold: 25,
    boss: Object.freeze({
      name: 'Perforadora Titán',
      hp: 1200,
      damage: 10,
      fireIntervalSeconds: 2.0,
      rewardCredits: 220,
    }),
  }),
  2: Object.freeze({
    id: 2,
    name: 'Órbita de Cobalto',
    asteroid: Object.freeze({
      hp: 220,
      damage: 0,
      rewardCredits: 24,
    }),
    enemy: Object.freeze({
      hp: 400,
      damage: 10,
      fireIntervalSeconds: 1.8,
      rewardCredits: 54,
    }),
    bossThreshold: 35,
    boss: Object.freeze({
      name: 'Fragata Cobalto',
      hp: 4800,
      damage: 14,
      fireIntervalSeconds: 1.8,
      rewardCredits: 550,
    }),
  }),
  3: Object.freeze({
    id: 3,
    name: 'Nebulosa de Plasma',
    asteroid: Object.freeze({
      hp: 650,
      damage: 0,
      rewardCredits: 52,
    }),
    enemy: Object.freeze({
      hp: 1150,
      damage: 14,
      fireIntervalSeconds: 1.6,
      rewardCredits: 116,
    }),
    bossThreshold: 45,
    boss: Object.freeze({
      name: 'Crucero Nebular',
      hp: 14500,
      damage: 15,
      fireIntervalSeconds: 1.6,
      rewardCredits: 1400,
    }),
  }),
  4: Object.freeze({
    id: 4,
    name: 'Núcleo Estelar',
    asteroid: Object.freeze({
      hp: 1600,
      damage: 0,
      rewardCredits: 105,
    }),
    enemy: Object.freeze({
      hp: 1900,
      damage: 18,
      fireIntervalSeconds: 1.5,
      rewardCredits: 240,
    }),
    bossThreshold: 50,
    boss: Object.freeze({
      name: 'Guardián Solar',
      hp: 19000,
      damage: 16,
      fireIntervalSeconds: 1.5,
      rewardCredits: 2500,
    }),
  }),
});

export function getUpgradeTier(level: number): UpgradeTier {
  const tierIndex = Math.floor(Math.max(0, level) / 5);
  if (tierIndex === 0) return 'Mk I';
  if (tierIndex === 1) return 'Mk II';
  if (tierIndex === 2) return 'Mk III';
  if (tierIndex === 3) return 'Mk IV';
  return 'Omega';
}

export function getTierMultiplier(level: number): number {
  return 1 + 0.15 * Math.floor(Math.max(0, level) / 5);
}

export function getOverdriveCost(planetId: PlanetId): number {
  return 250 * planetId;
}

export function getEmergencyRepairCost(planetId: PlanetId): number {
  return 150 * planetId;
}

export function getEmpBlastCost(planetId: PlanetId): number {
  return 350 * planetId;
}

export function getOverclockCost(level: number): number {
  return OVERCLOCK_BASE_COST + OVERCLOCK_COST_PER_LEVEL * Math.max(0, level);
}

export function getOverclockMultiplier(level: number): number {
  return 1 + OVERCLOCK_DAMAGE_MULTIPLIER_PER_LEVEL * Math.max(0, level);
}

export function getFleetShipCost(
  shipType: FleetShipType,
  currentCount: number
): number | null {
  const config = FLEET_CONFIGS[shipType];
  if (currentCount >= config.cap) {
    return null;
  }
  return config.baseCost + config.costPerUnit * currentCount;
}

export function getInitialFleetCounts(): FleetCounts {
  return Object.freeze({
    interceptor: 0,
    corvette: 0,
    frigate: 0,
  });
}

export function getInitialFleetTimers(): FleetTimers {
  return Object.freeze({
    interceptor: 0,
    corvette: 0,
    frigate: 0,
  });
}

export function calculateFleetDps(fleet: FleetCounts): number {
  const interceptorDps =
    (fleet.interceptor ?? 0) * (FLEET_CONFIGS.interceptor.damage / FLEET_CONFIGS.interceptor.fireInterval);
  const corvetteDps =
    (fleet.corvette ?? 0) * (FLEET_CONFIGS.corvette.damage / FLEET_CONFIGS.corvette.fireInterval);
  const frigateDps =
    (fleet.frigate ?? 0) * (FLEET_CONFIGS.frigate.damage / FLEET_CONFIGS.frigate.fireInterval);
  return Number((interceptorDps + corvetteDps + frigateDps).toFixed(1));
}

export function getUpgradeCost(key: UpgradeKey, currentLevel: number): number | null {
  if (currentLevel >= UPGRADE_CAPS[key]) {
    return null;
  }

  switch (key) {
    case 'cannonDamage':
      return 25 + 25 * currentLevel;
    case 'fireRate':
      return 30 + 35 * currentLevel;
    case 'hullShield':
      return 35 + 30 * currentLevel;
    case 'cargoCapacity':
      return 30 + 25 * currentLevel;
    case 'supportDrone':
      return 60 + 60 * currentLevel;
    case 'autoSell':
      return currentLevel >= 1 ? null : AUTOSELL_COST;
  }
}

export function getCannonDamage(level: number): number {
  return Math.round((10 + 5 * level) * getTierMultiplier(level));
}

export function getFireRate(level: number): number {
  return 1.0 + 0.25 * level;
}

export function getFireInterval(level: number): number {
  const rate = getFireRate(level);
  return rate > 0 ? 1 / rate : 1.0;
}

export function getMaxHull(level: number): number {
  return Math.round((80 + 25 * level) * getTierMultiplier(level));
}

export function getMaxShield(level: number): number {
  return Math.round((40 + 20 * level) * getTierMultiplier(level));
}

export function getCargoCapacity(level: number): number {
  return 10 + 5 * level;
}

export function getDroneDamage(level: number): number {
  return level <= 0 ? 0 : Math.round(12 * level * getTierMultiplier(level));
}

export function getDroneFireInterval(): number {
  return DRONE_FIRE_INTERVAL_SECONDS;
}

export function calculateTotalDps(
  cannonDamageLevel: number,
  fireRateLevel: number,
  droneLevel: number,
  fleetCounts?: FleetCounts,
  overclockLevel: number = 0,
  isOverdrive: boolean = false
): number {
  const cannonDps = getCannonDamage(cannonDamageLevel) * getFireRate(fireRateLevel);
  const droneDps = getDroneDamage(droneLevel) * (1 / DRONE_FIRE_INTERVAL_SECONDS);
  const fleetDps = fleetCounts ? calculateFleetDps(fleetCounts) : 0;
  let totalDps = cannonDps + droneDps + fleetDps;

  if (overclockLevel > 0) {
    totalDps *= 1 + OVERCLOCK_DAMAGE_MULTIPLIER_PER_LEVEL * overclockLevel;
  }
  if (isOverdrive) {
    totalDps *= OVERDRIVE_DAMAGE_MULTIPLIER;
  }

  return Number(totalDps.toFixed(1));
}

export function canChallengeBoss(planetId: PlanetId, objetivosDestruidos: number): boolean {
  return objetivosDestruidos >= PLANETS[planetId].bossThreshold;
}

export function getInitialUpgradeLevels(): UpgradeLevels {
  return Object.freeze({
    cannonDamage: 0,
    fireRate: 0,
    hullShield: 0,
    cargoCapacity: 0,
    supportDrone: 0,
    autoSell: false,
  });
}

export function createInitialState(): GameState {
  const initialUpgrades = getInitialUpgradeLevels();
  const maxHull = getMaxHull(initialUpgrades.hullShield);
  const maxShield = getMaxShield(initialUpgrades.hullShield);
  const maxCargo = getCargoCapacity(initialUpgrades.cargoCapacity);

  return {
    credits: 0,
    planetActual: 1,
    planetasDesbloqueados: 1,
    objetivosPorPlaneta: Object.freeze({
      1: 0,
      2: 0,
      3: 0,
      4: 0,
    }),
    bossActive: false,
    bossTargetId: null,
    lockedTargetId: null,
    ship: Object.freeze({
      currentHull: maxHull,
      maxHull,
      currentShield: maxShield,
      maxShield,
      shieldRegenCooldown: 0,
      fireTimer: 0,
      droneFireTimer: 0,
    }),
    cargo: Object.freeze({
      units: 0,
      value: 0,
      maxCapacity: maxCargo,
    }),
    upgrades: initialUpgrades,
    targets: [],
    projectiles: [],
    stats: Object.freeze({
      targetsDestroyed: 0,
      bossesDefeated: 0,
      totalCreditsEarned: 0,
    }),
    tiempoJugadoSegundos: 0,
    silencio: false,
    victoryAcknowledged: false,
    spawnTimer: 0,
    spawnSequence: 0,
    overclockLevel: 0,
    fleet: getInitialFleetCounts(),
    overdriveTimer: 0,
    fleetTimers: getInitialFleetTimers(),
  };
}
