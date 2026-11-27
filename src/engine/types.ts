/**
 * Tipos de dominio para el motor incremental espacial.
 * Modelado con uniones discriminadas estrictas y estructuras inmutables.
 * No contiene importaciones de navegador, Canvas 2D ni Web Audio.
 */

export type PlanetId = 1 | 2 | 3 | 4;

export interface Vector2D {
  readonly x: number;
  readonly y: number;
}

export type TargetType = 'asteroid' | 'enemy' | 'boss';

interface BaseTarget {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly spawnIndex: number;
  readonly angle?: number;
  readonly angularVelocity?: number;
  readonly vx?: number;
  readonly vy?: number;
  readonly hitFlashTimer?: number;
}

export interface AsteroidTarget extends BaseTarget {
  readonly type: 'asteroid';
  readonly rewardCredits: number;
}

export interface EnemyTarget extends BaseTarget {
  readonly type: 'enemy';
  readonly damage: number;
  readonly fireCooldown: number;
  readonly fireTimer: number;
  readonly rewardCredits: number;
}

export interface BossTarget extends BaseTarget {
  readonly type: 'boss';
  readonly name: string;
  readonly damage: number;
  readonly fireCooldown: number;
  readonly fireTimer: number;
  readonly rewardCredits: number;
}

export type Target = AsteroidTarget | EnemyTarget | BossTarget;

export type ShooterType = 'player' | 'drone' | 'enemy' | 'boss' | 'fleet';

export type FleetShipType = 'interceptor' | 'corvette' | 'frigate';

export interface FleetCounts {
  readonly interceptor: number;
  readonly corvette: number;
  readonly frigate: number;
}

export interface FleetTimers {
  readonly interceptor: number;
  readonly corvette: number;
  readonly frigate: number;
}

export type UpgradeTier = 'Mk I' | 'Mk II' | 'Mk III' | 'Mk IV' | 'Omega';

export interface Projectile {
  readonly id: string;
  readonly shooter: ShooterType;
  readonly x: number;
  readonly y: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly speed: number;
  readonly damage: number;
  readonly targetId?: string;
}

export type LinearUpgradeKey =
  | 'cannonDamage'
  | 'fireRate'
  | 'hullShield'
  | 'cargoCapacity'
  | 'supportDrone';

export type UpgradeKey = LinearUpgradeKey | 'autoSell';

export interface UpgradeLevels {
  readonly cannonDamage: number;
  readonly fireRate: number;
  readonly hullShield: number;
  readonly cargoCapacity: number;
  readonly supportDrone: number;
  readonly autoSell: boolean;
}

export interface PlanetConfig {
  readonly id: PlanetId;
  readonly name: string;
  readonly asteroid: {
    readonly hp: number;
    readonly damage: number;
    readonly rewardCredits: number;
  };
  readonly enemy: {
    readonly hp: number;
    readonly damage: number;
    readonly fireIntervalSeconds: number;
    readonly rewardCredits: number;
  };
  readonly bossThreshold: number;
  readonly boss: {
    readonly name: string;
    readonly hp: number;
    readonly damage: number;
    readonly fireIntervalSeconds: number;
    readonly rewardCredits: number;
  };
}

export type SimulationEvent =
  | {
      readonly type: 'shoot';
      readonly shooter: ShooterType;
      readonly origin: Vector2D;
      readonly targetId?: string;
    }
  | {
      readonly type: 'hit';
      readonly targetId: string;
      readonly damage: number;
    }
  | {
      readonly type: 'target_destroyed';
      readonly targetType: TargetType;
      readonly targetId: string;
      readonly rewardCredits: number;
      readonly wasCargoCollected: boolean;
    }
  | {
      readonly type: 'cargo_sold';
      readonly unitsSold: number;
      readonly creditsEarned: number;
    }
  | {
      readonly type: 'upgrade_purchased';
      readonly upgradeKey: UpgradeKey;
      readonly newLevel: number | boolean;
      readonly cost: number;
    }
  | {
      readonly type: 'player_hit';
      readonly shieldDamage: number;
      readonly hullDamage: number;
      readonly currentShield: number;
      readonly currentHull: number;
    }
  | {
      readonly type: 'player_defeated';
      readonly planetId: PlanetId;
    }
  | {
      readonly type: 'boss_spawned';
      readonly planetId: PlanetId;
      readonly bossName: string;
    }
  | {
      readonly type: 'boss_defeated';
      readonly planetId: PlanetId;
      readonly bossName: string;
      readonly rewardCredits: number;
    }
  | {
      readonly type: 'planet_unlocked';
      readonly planetId: PlanetId;
    }
  | {
      readonly type: 'cargo_full';
      readonly discardedResourceValue: number;
    }
  | {
      readonly type: 'victory';
      readonly totalTimeSeconds: number;
      readonly stats: GameStats;
    }
  | {
      readonly type: 'emp_blast';
      readonly damage: number;
      readonly targetsHit: number;
      readonly cost: number;
    }
  | {
      readonly type: 'overdrive_activated';
      readonly duration: number;
      readonly cost: number;
    }
  | {
      readonly type: 'emergency_repair';
      readonly hullRestored: number;
      readonly shieldRestored: number;
      readonly cost: number;
    }
  | {
      readonly type: 'overclock_purchased';
      readonly newLevel: number;
      readonly cost: number;
    }
  | {
      readonly type: 'fleet_purchased';
      readonly shipType: FleetShipType;
      readonly count: number;
      readonly cost: number;
    };

export interface ShipState {
  readonly currentHull: number;
  readonly maxHull: number;
  readonly currentShield: number;
  readonly maxShield: number;
  readonly shieldRegenCooldown: number;
  readonly fireTimer: number;
  readonly droneFireTimer: number;
}

export interface CargoState {
  readonly units: number;
  readonly value: number;
  readonly maxCapacity: number;
}

export interface GameStats {
  readonly targetsDestroyed: number;
  readonly bossesDefeated: number;
  readonly totalCreditsEarned: number;
}

export interface GameState {
  readonly credits: number;
  readonly planetActual: PlanetId;
  readonly planetasDesbloqueados: PlanetId;
  readonly objetivosPorPlaneta: Readonly<Record<PlanetId, number>>;
  readonly bossActive: boolean;
  readonly bossTargetId: string | null;
  readonly lockedTargetId: string | null;
  readonly ship: ShipState;
  readonly cargo: CargoState;
  readonly upgrades: UpgradeLevels;
  readonly targets: readonly Target[];
  readonly projectiles: readonly Projectile[];
  readonly stats: GameStats;
  readonly tiempoJugadoSegundos: number;
  readonly silencio: boolean;
  readonly victoryAcknowledged: boolean;
  readonly spawnTimer: number;
  readonly spawnSequence: number;
  readonly droneAngle?: number;
  readonly manualPulseCooldown?: number;
  readonly overclockLevel: number;
  readonly fleet: FleetCounts;
  readonly overdriveTimer?: number;
  readonly fleetTimers?: FleetTimers;
}

export interface SaveDataV1 {
  readonly version: 1;
  readonly creditos: number;
  readonly planetaActual: PlanetId;
  readonly planetasDesbloqueados: PlanetId;
  readonly objetivosPorPlaneta: Readonly<Record<PlanetId, number>>;
  readonly bodega: {
    readonly units: number;
    readonly value: number;
  };
  readonly mejoras: UpgradeLevels;
  readonly silencio: boolean;
  readonly tiempoJugadoSegundos: number;
  readonly estadisticas: GameStats;
  readonly fleet?: FleetCounts;
  readonly overclockLevel?: number;
}
