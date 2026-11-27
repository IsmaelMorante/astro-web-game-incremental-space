/**
 * Módulo puro de economía espacial: gestión de bodega, venta manual,
 * autoventa de botín y compra de las 6 mejoras del prototipo.
 * Inmutable y libre de dependencias de navegador, Canvas 2D y Web Audio.
 */

import type {
  CargoState,
  FleetCounts,
  FleetShipType,
  GameState,
  GameStats,
  ShipState,
  SimulationEvent,
  UpgradeKey,
  UpgradeLevels,
} from './types';
import {
  getCargoCapacity,
  getFleetShipCost,
  getInitialFleetCounts,
  getMaxHull,
  getMaxShield,
  getOverclockCost,
  getUpgradeCost,
  UPGRADE_CAPS,
} from './balance';

export interface EconomyStepResult {
  readonly state: GameState;
  readonly events: readonly SimulationEvent[];
}

/**
 * Consulta si la bodega ha alcanzado o superado su capacidad máxima.
 * Admite tanto un estado de juego completo como la estructura de bodega aislada.
 */
export function isCargoFull(target: CargoState | GameState): boolean {
  const cargo = 'cargo' in target ? target.cargo : target;
  return cargo.units >= cargo.maxCapacity;
}

/**
 * Obtiene el coste en créditos del siguiente nivel de una mejora,
 * o null si ya alcanzó su tope o ya fue desbloqueada.
 */
export function getNextUpgradeCost(
  state: GameState,
  upgradeKey: UpgradeKey
): number | null {
  const currentLevel =
    upgradeKey === 'autoSell'
      ? state.upgrades.autoSell
        ? 1
        : 0
      : state.upgrades[upgradeKey];
  return getUpgradeCost(upgradeKey, currentLevel);
}

/**
 * Comprueba si el jugador puede comprar una mejora:
 * no haber alcanzado el tope y disponer de créditos suficientes.
 */
export function canPurchaseUpgrade(
  state: GameState,
  upgradeKey: UpgradeKey
): boolean {
  const cost = getNextUpgradeCost(state, upgradeKey);
  if (cost === null) {
    return false;
  }
  return state.credits >= cost;
}

/**
 * Recolecta botín generado por la destrucción de un asteroide o enemigo.
 * Si autoventa está activa, convierte directamente las unidades en créditos sin ocupar bodega.
 * Si autoventa está inactiva:
 * - Si no hay espacio en bodega, frena la recolección, descarta el recurso y emite cargo_full.
 * - Si cabe parcialmente, llena hasta el tope, descarta el excedente y emite cargo_full.
 * - Si cabe completamente, añade la carga a la bodega.
 */
export function collectLoot(
  state: GameState,
  units: number,
  valueCredits: number
): EconomyStepResult {
  if (units <= 0 || valueCredits <= 0) {
    return { state, events: [] };
  }

  if (state.upgrades.autoSell) {
    const nextCredits = state.credits + valueCredits;
    const nextStats: GameStats = {
      ...state.stats,
      totalCreditsEarned: state.stats.totalCreditsEarned + valueCredits,
    };
    const soldEvent: SimulationEvent = {
      type: 'cargo_sold',
      unitsSold: units,
      creditsEarned: valueCredits,
    };
    return {
      state: {
        ...state,
        credits: nextCredits,
        stats: nextStats,
      },
      events: [soldEvent],
    };
  }

  const availableSpace = Math.max(0, state.cargo.maxCapacity - state.cargo.units);

  if (availableSpace <= 0) {
    const fullEvent: SimulationEvent = {
      type: 'cargo_full',
      discardedResourceValue: valueCredits,
    };
    return { state, events: [fullEvent] };
  }

  if (units <= availableSpace) {
    const nextCargo: CargoState = {
      ...state.cargo,
      units: state.cargo.units + units,
      value: state.cargo.value + valueCredits,
    };
    return {
      state: {
        ...state,
        cargo: nextCargo,
      },
      events: [],
    };
  }

  const acceptedUnits = availableSpace;
  const unitValue = valueCredits / units;
  const acceptedValue = Math.round(unitValue * acceptedUnits);
  const discardedValue = valueCredits - acceptedValue;

  const nextCargo: CargoState = {
    ...state.cargo,
    units: state.cargo.units + acceptedUnits,
    value: state.cargo.value + acceptedValue,
  };
  const fullEvent: SimulationEvent = {
    type: 'cargo_full',
    discardedResourceValue: discardedValue,
  };

  return {
    state: {
      ...state,
      cargo: nextCargo,
    },
    events: [fullEvent],
  };
}

/**
 * Vacía la bodega del jugador convirtiendo todos sus recursos en créditos.
 * Si la bodega tiene unidades (> 0), suma su valor a credits y totalCreditsEarned,
 * y emite cargo_sold. Si está vacía, devuelve el estado sin alteraciones.
 */
export function sellAllCargo(state: GameState): EconomyStepResult {
  if (state.cargo.units <= 0) {
    return { state, events: [] };
  }

  const unitsSold = state.cargo.units;
  const creditsEarned = state.cargo.value;
  const nextCargo: CargoState = {
    ...state.cargo,
    units: 0,
    value: 0,
  };
  const nextCredits = state.credits + creditsEarned;
  const nextStats: GameStats = {
    ...state.stats,
    totalCreditsEarned: state.stats.totalCreditsEarned + creditsEarned,
  };
  const soldEvent: SimulationEvent = {
    type: 'cargo_sold',
    unitsSold,
    creditsEarned,
  };

  return {
    state: {
      ...state,
      credits: nextCredits,
      cargo: nextCargo,
      stats: nextStats,
    },
    events: [soldEvent],
  };
}

function applyAutoSellPurchase(
  state: GameState,
  creditsAfterCost: number,
  cost: number
): EconomyStepResult {
  const nextUpgrades: UpgradeLevels = {
    ...state.upgrades,
    autoSell: true,
  };
  const purchaseEvent: SimulationEvent = {
    type: 'upgrade_purchased',
    upgradeKey: 'autoSell',
    newLevel: true,
    cost,
  };

  if (state.cargo.units > 0) {
    const unitsSold = state.cargo.units;
    const creditsEarned = state.cargo.value;
    const finalCredits = creditsAfterCost + creditsEarned;
    const nextCargo: CargoState = {
      ...state.cargo,
      units: 0,
      value: 0,
    };
    const nextStats: GameStats = {
      ...state.stats,
      totalCreditsEarned: state.stats.totalCreditsEarned + creditsEarned,
    };
    const soldEvent: SimulationEvent = {
      type: 'cargo_sold',
      unitsSold,
      creditsEarned,
    };

    return {
      state: {
        ...state,
        credits: finalCredits,
        cargo: nextCargo,
        upgrades: nextUpgrades,
        stats: nextStats,
      },
      events: [purchaseEvent, soldEvent],
    };
  }

  return {
    state: {
      ...state,
      credits: creditsAfterCost,
      upgrades: nextUpgrades,
    },
    events: [purchaseEvent],
  };
}

function applyHullShieldPurchase(
  state: GameState,
  remainingCredits: number,
  cost: number
): EconomyStepResult {
  const nextLevel = state.upgrades.hullShield + 1;
  const nextMaxHull = getMaxHull(nextLevel);
  const nextMaxShield = getMaxShield(nextLevel);
  const hullDelta = nextMaxHull - state.ship.maxHull;
  const shieldDelta = nextMaxShield - state.ship.maxShield;

  const nextShip: ShipState = {
    ...state.ship,
    currentHull: Math.min(state.ship.currentHull + hullDelta, nextMaxHull),
    maxHull: nextMaxHull,
    currentShield: Math.min(state.ship.currentShield + shieldDelta, nextMaxShield),
    maxShield: nextMaxShield,
  };

  const nextUpgrades: UpgradeLevels = {
    ...state.upgrades,
    hullShield: nextLevel,
  };

  const purchaseEvent: SimulationEvent = {
    type: 'upgrade_purchased',
    upgradeKey: 'hullShield',
    newLevel: nextLevel,
    cost,
  };

  return {
    state: {
      ...state,
      credits: remainingCredits,
      ship: nextShip,
      upgrades: nextUpgrades,
    },
    events: [purchaseEvent],
  };
}

function applyCargoCapacityPurchase(
  state: GameState,
  remainingCredits: number,
  cost: number
): EconomyStepResult {
  const nextLevel = state.upgrades.cargoCapacity + 1;
  const nextMaxCapacity = getCargoCapacity(nextLevel);

  const nextCargo: CargoState = {
    ...state.cargo,
    maxCapacity: nextMaxCapacity,
  };

  const nextUpgrades: UpgradeLevels = {
    ...state.upgrades,
    cargoCapacity: nextLevel,
  };

  const purchaseEvent: SimulationEvent = {
    type: 'upgrade_purchased',
    upgradeKey: 'cargoCapacity',
    newLevel: nextLevel,
    cost,
  };

  return {
    state: {
      ...state,
      credits: remainingCredits,
      cargo: nextCargo,
      upgrades: nextUpgrades,
    },
    events: [purchaseEvent],
  };
}

function applyLinearStatPurchase(
  state: GameState,
  upgradeKey: 'cannonDamage' | 'fireRate' | 'supportDrone',
  remainingCredits: number,
  cost: number
): EconomyStepResult {
  const nextLevel = state.upgrades[upgradeKey] + 1;

  const nextUpgrades: UpgradeLevels = {
    ...state.upgrades,
    [upgradeKey]: nextLevel,
  };

  const purchaseEvent: SimulationEvent = {
    type: 'upgrade_purchased',
    upgradeKey,
    newLevel: nextLevel,
    cost,
  };

  return {
    state: {
      ...state,
      credits: remainingCredits,
      upgrades: nextUpgrades,
    },
    events: [purchaseEvent],
  };
}

/**
 * Compra una mejora del catálogo validando fondos y tope de nivel.
 * Si la compra es válida, descuenta su coste, incrementa el nivel y aplica
 * los efectos secundarios inmediatos (máximos de casco/escudo, capacidad o autoventa).
 * Si no es válida, devuelve el estado original sin emitir eventos.
 */
export function purchaseUpgrade(
  state: GameState,
  upgradeKey: UpgradeKey
): EconomyStepResult {
  const cost = getNextUpgradeCost(state, upgradeKey);
  if (cost === null || state.credits < cost) {
    return { state, events: [] };
  }

  const remainingCredits = state.credits - cost;

  if (upgradeKey === 'autoSell') {
    return applyAutoSellPurchase(state, remainingCredits, cost);
  }

  if (upgradeKey === 'hullShield') {
    return applyHullShieldPurchase(state, remainingCredits, cost);
  }

  if (upgradeKey === 'cargoCapacity') {
    return applyCargoCapacityPurchase(state, remainingCredits, cost);
  }

  return applyLinearStatPurchase(state, upgradeKey, remainingCredits, cost);
}

export function canPurchaseOverclock(state: GameState): boolean {
  if (
    state.upgrades.cannonDamage < UPGRADE_CAPS.cannonDamage ||
    state.upgrades.supportDrone < UPGRADE_CAPS.supportDrone
  ) {
    return false;
  }
  const cost = getOverclockCost(state.overclockLevel ?? 0);
  return state.credits >= cost;
}

export function purchaseOverclock(state: GameState): EconomyStepResult {
  if (!canPurchaseOverclock(state)) {
    return { state, events: [] };
  }

  const currentLevel = state.overclockLevel ?? 0;
  const cost = getOverclockCost(currentLevel);
  const nextLevel = currentLevel + 1;

  const event: SimulationEvent = {
    type: 'overclock_purchased',
    newLevel: nextLevel,
    cost,
  };

  return {
    state: {
      ...state,
      credits: state.credits - cost,
      overclockLevel: nextLevel,
    },
    events: [event],
  };
}

export function canPurchaseFleetShip(
  state: GameState,
  shipType: FleetShipType
): boolean {
  const count = state.fleet?.[shipType] ?? 0;
  const cost = getFleetShipCost(shipType, count);
  if (cost === null) {
    return false;
  }
  return state.credits >= cost;
}

export function purchaseFleetShip(
  state: GameState,
  shipType: FleetShipType
): EconomyStepResult {
  const count = state.fleet?.[shipType] ?? 0;
  const cost = getFleetShipCost(shipType, count);
  if (cost === null || state.credits < cost) {
    return { state, events: [] };
  }

  const nextCount = count + 1;
  const nextFleet: FleetCounts = {
    ...getInitialFleetCounts(),
    ...state.fleet,
    [shipType]: nextCount,
  };

  const purchaseEvent: SimulationEvent = {
    type: 'fleet_purchased',
    shipType,
    count: nextCount,
    cost,
  };

  return {
    state: {
      ...state,
      credits: state.credits - cost,
      fleet: nextFleet,
    },
    events: [purchaseEvent],
  };
}
