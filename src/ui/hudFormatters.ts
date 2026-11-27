/**
 * Formateadores de datos y vistas para la interfaz de usuario (HUD).
 * Genera textos en castellano, cifras con separadores limpios, badges de escalón,
 * consumibles tácticos, flota, sobremarcha y estadísticas de la nave sin dependencias del DOM.
 */

import type {
  CargoState,
  FleetShipType,
  GameState,
  GameStats,
  PlanetId,
  ShipState,
  UpgradeKey,
  UpgradeTier,
} from '../engine/types';
import {
  PLANETS,
  UPGRADE_CAPS,
  calculateFleetDps,
  calculateTotalDps,
  getCannonDamage,
  getDroneDamage,
  getEmpBlastCost,
  getEmergencyRepairCost,
  getFireRate,
  getFleetShipCost,
  getOverclockCost,
  getOverclockMultiplier,
  getOverdriveCost,
  getUpgradeTier,
} from '../engine/balance';
import {
  canPurchaseFleetShip,
  canPurchaseOverclock,
  canPurchaseUpgrade,
  getNextUpgradeCost,
  isCargoFull,
} from '../engine/economy';
import {
  canActivateOverdrive,
  canEmergencyRepair,
  canFireEmpBlast,
} from '../engine/simulation';

export interface UpgradeItemViewModel {
  readonly key: UpgradeKey;
  readonly name: string;
  readonly description: string;
  readonly levelText: string;
  readonly costText: string;
  readonly rawCost: number | null;
  readonly currentLevel: number;
  readonly maxLevel: number;
  readonly isMaxed: boolean;
  readonly canAfford: boolean;
  readonly tierBadge: UpgradeTier;
}

export interface CargoStatusViewModel {
  readonly units: number;
  readonly maxCapacity: number;
  readonly value: number;
  readonly text: string;
  readonly isFull: boolean;
  readonly warningText: string | null;
  readonly canSell: boolean;
  readonly autoSellActive: boolean;
}

export interface PlanetViewModel {
  readonly id: PlanetId;
  readonly name: string;
  readonly isCurrent: boolean;
  readonly isUnlocked: boolean;
  readonly progressText: string;
  readonly bossThreshold: number;
  readonly destroyedCount: number;
  readonly bossAvailable: boolean;
  readonly bossName: string;
  readonly canChallenge: boolean;
}

export interface ShipStatusViewModel {
  readonly currentHull: number;
  readonly maxHull: number;
  readonly hullPercent: number;
  readonly hullText: string;
  readonly currentShield: number;
  readonly maxShield: number;
  readonly shieldPercent: number;
  readonly shieldText: string;
}

export interface VictoryStatsViewModel {
  readonly totalTimeText: string;
  readonly targetsDestroyed: number;
  readonly bossesDefeated: number;
  readonly totalCreditsText: string;
}

export interface TacticalConsumablesViewModel {
  readonly overdrive: {
    readonly isActive: boolean;
    readonly timerSeconds: number;
    readonly cost: number;
    readonly costText: string;
    readonly canActivate: boolean;
  };
  readonly emergencyRepair: {
    readonly cost: number;
    readonly costText: string;
    readonly canActivate: boolean;
  };
  readonly empBlast: {
    readonly cost: number;
    readonly costText: string;
    readonly canActivate: boolean;
  };
}

export interface OverclockViewModel {
  readonly level: number;
  readonly multiplierText: string;
  readonly cost: number;
  readonly costText: string;
  readonly canBuy: boolean;
}

export interface FleetShipViewModel {
  readonly type: FleetShipType;
  readonly name: string;
  readonly count: number;
  readonly cost: number | null;
  readonly costText: string;
  readonly canBuy: boolean;
  readonly dps: number;
}

export interface FleetViewModel {
  readonly interceptor: FleetShipViewModel;
  readonly corvette: FleetShipViewModel;
  readonly frigate: FleetShipViewModel;
  readonly totalDps: number;
  readonly totalDpsText: string;
}

export interface StatsSummaryViewModel {
  readonly totalDps: number;
  readonly totalDpsText: string;
  readonly cannonDamage: number;
  readonly cannonDamageText: string;
  readonly fireRate: number;
  readonly fireRateText: string;
  readonly droneDps: number;
  readonly droneDpsText: string;
  readonly fleetDps: number;
  readonly fleetDpsText: string;
  readonly maxShield: number;
  readonly shieldRegenText: string;
  readonly cargoCapacity: number;
  readonly targetsDestroyed: number;
  readonly bossesDefeated: number;
  readonly totalCredits: string;
}

export interface HudSnapshot {
  readonly creditsText: string;
  readonly creditsRaw: number;
  readonly timeText: string;
  readonly timeSeconds: number;
  readonly cargo: CargoStatusViewModel;
  readonly ship: ShipStatusViewModel;
  readonly currentPlanet: PlanetViewModel;
  readonly planets: readonly PlanetViewModel[];
  readonly boss: {
    readonly active: boolean;
    readonly name: string;
    readonly available: boolean;
    readonly canChallenge: boolean;
  };
  readonly upgrades: readonly UpgradeItemViewModel[];
  readonly victory: {
    readonly active: boolean;
    readonly stats: VictoryStatsViewModel;
  };
  readonly muted: boolean;
  readonly muteButtonLabel: string;
  readonly lockedTargetId: string | null;
  readonly tactical: TacticalConsumablesViewModel;
  readonly overclock: OverclockViewModel;
  readonly fleet: FleetViewModel;
  readonly stats: StatsSummaryViewModel;
}

export const UPGRADE_METADATA: Readonly<
  Record<
    UpgradeKey,
    {
      readonly name: string;
      readonly description: string;
      readonly maxLevel: number;
    }
  >
> = Object.freeze({
  cannonDamage: Object.freeze({
    name: 'Daño de cañón',
    description: '+5 de daño por disparo',
    maxLevel: UPGRADE_CAPS.cannonDamage,
  }),
  fireRate: Object.freeze({
    name: 'Cadencia',
    description: '+0,25 disp/s',
    maxLevel: UPGRADE_CAPS.fireRate,
  }),
  hullShield: Object.freeze({
    name: 'Casco y Escudo',
    description: '+25 casco, +20 escudo',
    maxLevel: UPGRADE_CAPS.hullShield,
  }),
  cargoCapacity: Object.freeze({
    name: 'Capacidad de bodega',
    description: '+5 espacios de bodega',
    maxLevel: UPGRADE_CAPS.cargoCapacity,
  }),
  supportDrone: Object.freeze({
    name: 'Dron de apoyo',
    description: 'Nave escolta (1,0 disp/s)',
    maxLevel: UPGRADE_CAPS.supportDrone,
  }),
  autoSell: Object.freeze({
    name: 'Autoventa',
    description: 'Vende botín automáticamente',
    maxLevel: 1,
  }),
});

/**
 * Formatea cifras de créditos con separador de miles por espacio y sufijo 'cr'.
 */
export function formatCredits(credits: number): string {
  const safe = Number.isFinite(credits) ? Math.max(0, Math.floor(credits)) : 0;
  const withSpaces = safe.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${withSpaces} cr`;
}

/**
 * Formatea una duración en segundos al formato MM:SS.
 */
export function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const remainingSeconds = safe % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = remainingSeconds.toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Formatea el estado de la bodega y emite aviso de 'Bodega llena' cuando
 * se alcanza el tope sin tener la autoventa desbloqueada.
 */
export function formatCargoStatus(
  cargo: CargoState,
  autoSellActive: boolean
): CargoStatusViewModel {
  const full = isCargoFull(cargo);
  const text = `${cargo.units} / ${cargo.maxCapacity}`;
  const warningText = full && !autoSellActive ? 'Bodega llena' : null;
  const canSell = !autoSellActive && cargo.units > 0;

  return {
    units: cargo.units,
    maxCapacity: cargo.maxCapacity,
    value: cargo.value,
    text,
    isFull: full,
    warningText,
    canSell,
    autoSellActive,
  };
}

/**
 * Formatea el estado individual de una mejora incluyendo badge de escalón de poder.
 */
export function formatUpgrade(
  state: GameState,
  key: UpgradeKey
): UpgradeItemViewModel {
  const meta = UPGRADE_METADATA[key];

  if (key === 'autoSell') {
    const isUnlocked = state.upgrades.autoSell;
    const rawCost = isUnlocked ? null : 500;
    const canAfford = !isUnlocked && state.credits >= 500;
    return {
      key,
      name: meta.name,
      description: meta.description,
      levelText: isUnlocked ? 'Desbloqueada' : 'Bloqueada',
      costText: isUnlocked ? 'Máximo' : formatCredits(500),
      rawCost,
      currentLevel: isUnlocked ? 1 : 0,
      maxLevel: 1,
      isMaxed: isUnlocked,
      canAfford,
      tierBadge: isUnlocked ? 'Omega' : 'Mk I',
    };
  }

  const currentLevel = state.upgrades[key];
  const maxLevel = UPGRADE_CAPS[key];
  const isMaxed = currentLevel >= maxLevel;
  const rawCost = getNextUpgradeCost(state, key);
  const canAfford = canPurchaseUpgrade(state, key);

  return {
    key,
    name: meta.name,
    description: meta.description,
    levelText: `${currentLevel} / ${maxLevel}`,
    costText: isMaxed || rawCost === null ? 'Máximo' : formatCredits(rawCost),
    rawCost,
    currentLevel,
    maxLevel,
    isMaxed,
    canAfford,
    tierBadge: getUpgradeTier(currentLevel),
  };
}

/**
 * Formatea la información y estado de progresión hacia el jefe para un planeta.
 */
export function formatPlanet(
  planetId: PlanetId,
  currentPlanetId: PlanetId,
  unlockedMaxPlanetId: PlanetId,
  destroyedCount: number,
  bossActive: boolean
): PlanetViewModel {
  const config = PLANETS[planetId];
  const threshold = config.bossThreshold;
  const isUnlocked = planetId <= unlockedMaxPlanetId;
  const isCurrent = planetId === currentPlanetId;
  const bossAvailable = destroyedCount >= threshold;
  const progressText = bossAvailable ? 'Jefe disponible' : `${destroyedCount} / ${threshold}`;
  const canChallenge = isCurrent && bossAvailable && !bossActive;

  return {
    id: planetId,
    name: config.name,
    isCurrent,
    isUnlocked,
    progressText,
    bossThreshold: threshold,
    destroyedCount,
    bossAvailable,
    bossName: config.boss.name,
    canChallenge,
  };
}

/**
 * Formatea las barras de vida y escudo de la nave del jugador.
 */
export function formatShipStatus(ship: ShipState): ShipStatusViewModel {
  const safeHull = Math.max(0, Math.ceil(ship.currentHull));
  const safeShield = Math.max(0, Math.ceil(ship.currentShield));
  const hullPercent =
    ship.maxHull > 0
      ? Math.max(0, Math.min(100, Math.round((ship.currentHull / ship.maxHull) * 100)))
      : 0;
  const shieldPercent =
    ship.maxShield > 0
      ? Math.max(0, Math.min(100, Math.round((ship.currentShield / ship.maxShield) * 100)))
      : 0;

  return {
    currentHull: safeHull,
    maxHull: ship.maxHull,
    hullPercent,
    hullText: `${safeHull} / ${ship.maxHull}`,
    currentShield: safeShield,
    maxShield: ship.maxShield,
    shieldPercent,
    shieldText: `${safeShield} / ${ship.maxShield}`,
  };
}

/**
 * Formatea las estadísticas finales mostradas en la pantalla de victoria.
 */
export function formatVictoryStats(
  stats: GameStats,
  totalTimeSeconds: number
): VictoryStatsViewModel {
  return {
    totalTimeText: formatDuration(totalTimeSeconds),
    targetsDestroyed: stats.targetsDestroyed,
    bossesDefeated: stats.bossesDefeated,
    totalCreditsText: formatCredits(stats.totalCreditsEarned),
  };
}

/**
 * Formatea los consumibles tácticos (Sobrecarga, Reparación y Pulso EMP).
 */
export function formatTacticalConsumables(state: GameState): TacticalConsumablesViewModel {
  const overdriveCost = getOverdriveCost(state.planetActual);
  const repairCost = getEmergencyRepairCost(state.planetActual);
  const empCost = getEmpBlastCost(state.planetActual);

  const isOverdriven = (state.overdriveTimer ?? 0) > 0;
  const timerSeconds = Math.max(0, Math.ceil(state.overdriveTimer ?? 0));

  return {
    overdrive: {
      isActive: isOverdriven,
      timerSeconds,
      cost: overdriveCost,
      costText: isOverdriven ? `${timerSeconds} s` : formatCredits(overdriveCost),
      canActivate: canActivateOverdrive(state),
    },
    emergencyRepair: {
      cost: repairCost,
      costText: formatCredits(repairCost),
      canActivate: canEmergencyRepair(state),
    },
    empBlast: {
      cost: empCost,
      costText: formatCredits(empCost),
      canActivate: canFireEmpBlast(state),
    },
  };
}

/**
 * Formatea la sobremarcha del reactor y su multiplicador.
 */
export function formatOverclock(state: GameState): OverclockViewModel {
  const level = state.overclockLevel ?? 0;
  const cost = getOverclockCost(level);
  const mult = getOverclockMultiplier(level);
  const bonusPct = Math.round((mult - 1) * 100);

  return {
    level,
    multiplierText: `+${bonusPct} % DPS`,
    cost,
    costText: formatCredits(cost),
    canBuy: canPurchaseOverclock(state),
  };
}

function formatFleetShip(
  state: GameState,
  type: FleetShipType,
  name: string,
  count: number,
  dpsPerShip: number
): FleetShipViewModel {
  const cost = getFleetShipCost(type, count);
  return {
    type,
    name,
    count,
    cost,
    costText: cost === null ? 'Máximo' : formatCredits(cost),
    canBuy: canPurchaseFleetShip(state, type),
    dps: count * dpsPerShip,
  };
}

/**
 * Formatea el estado de las naves de la flota aliada en órbita.
 */
export function formatFleet(state: GameState): FleetViewModel {
  const fleet = state.fleet ?? { interceptor: 0, corvette: 0, frigate: 0 };
  const totalDps = calculateFleetDps(fleet);

  return {
    interceptor: formatFleetShip(state, 'interceptor', 'Caza Interceptor', fleet.interceptor, 4),
    corvette: formatFleetShip(state, 'corvette', 'Corbeta Láser', fleet.corvette, 12),
    frigate: formatFleetShip(state, 'frigate', 'Fragata Pesada', fleet.frigate, 35),
    totalDps,
    totalDpsText: `${Math.round(totalDps)} DPS`,
  };
}

/**
 * Formatea las estadísticas globales de combate y nave.
 */
export function formatShipStats(state: GameState): StatsSummaryViewModel {
  const isOverdriven = (state.overdriveTimer ?? 0) > 0;
  const totalDps = calculateTotalDps(
    state.upgrades.cannonDamage,
    state.upgrades.fireRate,
    state.upgrades.supportDrone,
    state.fleet,
    state.overclockLevel ?? 0,
    isOverdriven
  );
  const cannonDmg = getCannonDamage(state.upgrades.cannonDamage);
  const fireRate = getFireRate(state.upgrades.fireRate);
  const droneDps = state.upgrades.supportDrone > 0 ? getDroneDamage(state.upgrades.supportDrone) : 0;
  const fleetDps = calculateFleetDps(state.fleet);

  return {
    totalDps: Math.round(totalDps),
    totalDpsText: `${Math.round(totalDps)} DPS`,
    cannonDamage: cannonDmg,
    cannonDamageText: `${cannonDmg}`,
    fireRate,
    fireRateText: `${fireRate.toFixed(2).replace('.', ',')} disp/s`,
    droneDps,
    droneDpsText: `${droneDps} DPS`,
    fleetDps: Math.round(fleetDps),
    fleetDpsText: `${Math.round(fleetDps)} DPS`,
    maxShield: state.ship.maxShield,
    shieldRegenText: '10 %/s',
    cargoCapacity: state.cargo.maxCapacity,
    targetsDestroyed: state.stats.targetsDestroyed,
    bossesDefeated: state.stats.bossesDefeated,
    totalCredits: formatCredits(state.stats.totalCreditsEarned),
  };
}

/**
 * Construye una instantánea inmutable del modelo de vista del HUD a partir del estado.
 */
export function createHudSnapshot(
  state: GameState,
  isMuted: boolean,
  victoryActive: boolean = false
): HudSnapshot {
  const currentConfig = PLANETS[state.planetActual];
  const currentCount = state.objetivosPorPlaneta[state.planetActual] ?? 0;
  const bossAvailable = currentCount >= currentConfig.bossThreshold;

  const allPlanetIds: readonly PlanetId[] = [1, 2, 3, 4];
  const planets = allPlanetIds.map((id) =>
    formatPlanet(
      id,
      state.planetActual,
      state.planetasDesbloqueados,
      state.objetivosPorPlaneta[id] ?? 0,
      state.bossActive
    )
  );

  const upgradeKeys: readonly UpgradeKey[] = [
    'cannonDamage',
    'fireRate',
    'hullShield',
    'cargoCapacity',
    'supportDrone',
    'autoSell',
  ];
  const upgrades = upgradeKeys.map((key) => formatUpgrade(state, key));

  const currentPlanet = planets.find((p) => p.id === state.planetActual) ?? planets[0];
  const cargo = formatCargoStatus(state.cargo, state.upgrades.autoSell);
  const ship = formatShipStatus(state.ship);
  const victoryStats = formatVictoryStats(state.stats, state.tiempoJugadoSegundos);
  const tactical = formatTacticalConsumables(state);
  const overclock = formatOverclock(state);
  const fleet = formatFleet(state);
  const stats = formatShipStats(state);

  return {
    creditsText: formatCredits(state.credits),
    creditsRaw: state.credits,
    timeText: formatDuration(state.tiempoJugadoSegundos),
    timeSeconds: state.tiempoJugadoSegundos,
    cargo,
    ship,
    currentPlanet,
    planets,
    boss: {
      active: state.bossActive,
      name: currentConfig.boss.name,
      available: bossAvailable,
      canChallenge: bossAvailable && !state.bossActive,
    },
    upgrades,
    victory: {
      active: victoryActive,
      stats: victoryStats,
    },
    muted: isMuted,
    muteButtonLabel: isMuted ? 'Activar sonido' : 'Silenciar',
    lockedTargetId: state.lockedTargetId,
    tactical,
    overclock,
    fleet,
    stats,
  };
}
