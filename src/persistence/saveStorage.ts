/**
 * Adaptador de persistencia en almacenamiento local (StorageLike).
 * Serializa, valida en frontera y restaura el estado del juego según R10 y R11.
 * Omite deliberadamente el cálculo de progreso offline.
 */

import type {
  FleetCounts,
  FleetShipType,
  GameStats,
  GameState,
  LinearUpgradeKey,
  PlanetId,
  UpgradeLevels,
} from '../engine/types';
import {
  createInitialState,
  getCargoCapacity,
  getInitialFleetCounts,
  getMaxHull,
  getMaxShield,
  SAVE_STORAGE_KEY,
  UPGRADE_CAPS,
} from '../engine/balance';

export { SAVE_STORAGE_KEY };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SavePayload {
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
  readonly muted: boolean;
  readonly tiempoJugadoSegundos: number;
  readonly estadisticas: GameStats;
  readonly fleet?: FleetCounts;
  readonly overclockLevel?: number;
}

export interface LoadGameResult {
  readonly state: GameState;
  readonly muted: boolean;
}

const LINEAR_UPGRADE_KEYS: readonly LinearUpgradeKey[] = [
  'cannonDamage',
  'fireRate',
  'hullShield',
  'cargoCapacity',
  'supportDrone',
];

const PLANET_IDS: readonly PlanetId[] = [1, 2, 3, 4];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlanetId(value: unknown): value is PlanetId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function isObjectivesRecord(value: unknown): value is Record<PlanetId, number> {
  if (!isRecord(value)) {
    return false;
  }

  for (const id of PLANET_IDS) {
    const rawVal = value[id.toString()];
    if (
      typeof rawVal !== 'number' ||
      !Number.isInteger(rawVal) ||
      rawVal < 0
    ) {
      return false;
    }
  }

  return true;
}

function isUpgradeLevels(value: unknown): value is UpgradeLevels {
  if (!isRecord(value)) {
    return false;
  }

  for (const key of LINEAR_UPGRADE_KEYS) {
    const level = value[key];
    const maxCap = UPGRADE_CAPS[key];
    if (
      typeof level !== 'number' ||
      !Number.isInteger(level) ||
      level < 0 ||
      level > maxCap
    ) {
      return false;
    }
  }

  return typeof value.autoSell === 'boolean';
}

function isCargoPayload(
  value: unknown,
  maxCapacity: number
): value is { units: number; value: number } {
  if (!isRecord(value)) {
    return false;
  }

  const { units, value: cargoVal } = value;
  if (
    typeof units !== 'number' ||
    !Number.isInteger(units) ||
    units < 0 ||
    units > maxCapacity
  ) {
    return false;
  }

  return typeof cargoVal === 'number' && Number.isFinite(cargoVal) && cargoVal >= 0;
}

function isGameStats(value: unknown): value is GameStats {
  if (!isRecord(value)) {
    return false;
  }

  const { targetsDestroyed, bossesDefeated, totalCreditsEarned } = value;
  if (
    typeof targetsDestroyed !== 'number' ||
    !Number.isInteger(targetsDestroyed) ||
    targetsDestroyed < 0
  ) {
    return false;
  }

  if (
    typeof bossesDefeated !== 'number' ||
    !Number.isInteger(bossesDefeated) ||
    bossesDefeated < 0
  ) {
    return false;
  }

  return (
    typeof totalCreditsEarned === 'number' &&
    Number.isFinite(totalCreditsEarned) &&
    totalCreditsEarned >= 0
  );
}

function isFleetCounts(value: unknown): value is FleetCounts {
  if (!isRecord(value)) {
    return false;
  }

  const keys: readonly FleetShipType[] = ['interceptor', 'corvette', 'frigate'];
  for (const key of keys) {
    const count = value[key];
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      return false;
    }
  }

  return true;
}

function validateSavePayload(raw: unknown): SavePayload | null {
  if (!isRecord(raw) || raw.version !== 1) {
    return null;
  }

  const creditsVal = raw.creditos ?? raw.credits;
  if (
    typeof creditsVal !== 'number' ||
    !Number.isFinite(creditsVal) ||
    creditsVal < 0
  ) {
    return null;
  }

  const currentPlanetVal = raw.planetaActual ?? raw.currentPlanet ?? raw.planetActual;
  const unlockedPlanetsVal = raw.planetasDesbloqueados ?? raw.unlockedPlanets;
  if (
    !isPlanetId(currentPlanetVal) ||
    !isPlanetId(unlockedPlanetsVal) ||
    currentPlanetVal > unlockedPlanetsVal
  ) {
    return null;
  }

  const objectivesVal = raw.objetivosPorPlaneta ?? raw.planetObjectives;
  if (!isObjectivesRecord(objectivesVal)) {
    return null;
  }

  const upgradesVal = raw.mejoras ?? raw.upgrades;
  if (!isUpgradeLevels(upgradesVal)) {
    return null;
  }

  const maxCapacity = getCargoCapacity(upgradesVal.cargoCapacity);
  const cargoVal = raw.bodega ?? raw.cargo;
  if (!isCargoPayload(cargoVal, maxCapacity)) {
    return null;
  }

  const mutedVal = raw.muted ?? raw.silencio;
  if (typeof mutedVal !== 'boolean') {
    return null;
  }

  const timePlayedVal = raw.tiempoJugadoSegundos ?? raw.timePlayedSeconds;
  if (
    typeof timePlayedVal !== 'number' ||
    !Number.isFinite(timePlayedVal) ||
    timePlayedVal < 0
  ) {
    return null;
  }

  const statsVal = raw.estadisticas ?? raw.stats;
  if (!isGameStats(statsVal)) {
    return null;
  }

  const rawFleet = raw.fleet ?? raw.flota;
  let validatedFleet: FleetCounts = getInitialFleetCounts();
  if (rawFleet !== undefined && rawFleet !== null) {
    if (!isFleetCounts(rawFleet)) {
      return null;
    }
    validatedFleet = {
      interceptor: rawFleet.interceptor,
      corvette: rawFleet.corvette,
      frigate: rawFleet.frigate,
    };
  }

  const rawOverclock = raw.overclockLevel ?? raw.nivelSobremarcha;
  let validatedOverclock = 0;
  if (rawOverclock !== undefined && rawOverclock !== null) {
    if (
      typeof rawOverclock !== 'number' ||
      !Number.isInteger(rawOverclock) ||
      rawOverclock < 0
    ) {
      return null;
    }
    validatedOverclock = rawOverclock;
  }

  return {
    version: 1,
    creditos: creditsVal,
    planetaActual: currentPlanetVal,
    planetasDesbloqueados: unlockedPlanetsVal,
    objetivosPorPlaneta: Object.freeze({
      1: objectivesVal['1'],
      2: objectivesVal['2'],
      3: objectivesVal['3'],
      4: objectivesVal['4'],
    }),
    bodega: Object.freeze({
      units: cargoVal.units,
      value: cargoVal.value,
    }),
    mejoras: Object.freeze({
      cannonDamage: upgradesVal.cannonDamage,
      fireRate: upgradesVal.fireRate,
      hullShield: upgradesVal.hullShield,
      cargoCapacity: upgradesVal.cargoCapacity,
      supportDrone: upgradesVal.supportDrone,
      autoSell: upgradesVal.autoSell,
    }),
    silencio: mutedVal,
    muted: mutedVal,
    tiempoJugadoSegundos: timePlayedVal,
    estadisticas: Object.freeze({
      targetsDestroyed: statsVal.targetsDestroyed,
      bossesDefeated: statsVal.bossesDefeated,
      totalCreditsEarned: statsVal.totalCreditsEarned,
    }),
    fleet: Object.freeze(validatedFleet),
    overclockLevel: validatedOverclock,
  };
}

function restoreGameState(payload: SavePayload): LoadGameResult {
  const maxHull = getMaxHull(payload.mejoras.hullShield);
  const maxShield = getMaxShield(payload.mejoras.hullShield);
  const maxCapacity = getCargoCapacity(payload.mejoras.cargoCapacity);

  const state: GameState = {
    credits: payload.creditos,
    planetActual: payload.planetaActual,
    planetasDesbloqueados: payload.planetasDesbloqueados,
    objetivosPorPlaneta: payload.objetivosPorPlaneta,
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
      units: payload.bodega.units,
      value: payload.bodega.value,
      maxCapacity,
    }),
    upgrades: payload.mejoras,
    targets: [],
    projectiles: [],
    stats: payload.estadisticas,
    // R11: se restaura el tiempo acumulado sin añadir progreso fuera de sesión
    tiempoJugadoSegundos: payload.tiempoJugadoSegundos,
    silencio: payload.muted,
    victoryAcknowledged: false,
    spawnTimer: 0,
    spawnSequence: 0,
    overclockLevel: payload.overclockLevel ?? 0,
    fleet: payload.fleet ?? getInitialFleetCounts(),
    overdriveTimer: 0,
    fleetTimers: Object.freeze({ interceptor: 0, corvette: 0, frigate: 0 }),
  };

  return {
    state,
    muted: payload.muted,
  };
}

export function saveGame(
  storage: StorageLike,
  state: GameState,
  muted?: boolean
): boolean {
  if (!storage || typeof storage.setItem !== 'function') {
    return false;
  }

  const isMuted = typeof muted === 'boolean' ? muted : state.silencio;

  const payload: SavePayload = {
    version: 1,
    creditos: state.credits,
    planetaActual: state.planetActual,
    planetasDesbloqueados: state.planetasDesbloqueados,
    objetivosPorPlaneta: state.objetivosPorPlaneta,
    bodega: {
      units: state.cargo.units,
      value: state.cargo.value,
    },
    mejoras: state.upgrades,
    silencio: isMuted,
    muted: isMuted,
    tiempoJugadoSegundos: state.tiempoJugadoSegundos,
    estadisticas: state.stats,
    fleet: state.fleet ?? getInitialFleetCounts(),
    overclockLevel: state.overclockLevel ?? 0,
  };

  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (_error) {
    // Si la cuota de almacenamiento está excedida o el acceso está deshabilitado por el navegador
    return false;
  }
}

export function loadGame(storage?: StorageLike | null): LoadGameResult {
  const fallback: LoadGameResult = {
    state: createInitialState(),
    muted: false,
  };

  if (!storage || typeof storage.getItem !== 'function') {
    return fallback;
  }

  let serialized: string | null = null;
  try {
    serialized = storage.getItem(SAVE_STORAGE_KEY);
  } catch (_error) {
    // Fallo de lectura del almacenamiento; se aplica respaldo seguro
    return fallback;
  }

  if (serialized === null || serialized.trim() === '') {
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch (_error) {
    // JSON malformado o truncado; se aplica respaldo seguro
    return fallback;
  }

  const validated = validateSavePayload(parsed);
  if (!validated) {
    return fallback;
  }

  return restoreGameState(validated);
}

export function clearSavedGame(storage?: StorageLike | null): void {
  if (!storage || typeof storage.removeItem !== 'function') {
    return;
  }

  try {
    storage.removeItem(SAVE_STORAGE_KEY);
  } catch (_error) {
    // Se silencia cualquier excepción si el almacenamiento es inaccesible
  }
}
