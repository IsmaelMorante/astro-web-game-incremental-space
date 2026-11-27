import { describe, expect, it } from 'vitest';
import {
  clearSavedGame,
  loadGame,
  saveGame,
  SAVE_STORAGE_KEY,
  type StorageLike,
} from '../saveStorage';
import {
  createInitialState,
  getCargoCapacity,
  getMaxHull,
  getMaxShield,
  UPGRADE_CAPS,
  type GameState,
} from '../../engine/index';

/**
 * Doble de pruebas en memoria para la interfaz StorageLike.
 * No depende de APIs del navegador ni del DOM.
 */
class MemoryStorage implements StorageLike {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Doble de almacenamiento que simula fallos de acceso o cuota excedida.
 */
class ThrowingStorage implements StorageLike {
  constructor(
    private readonly shouldThrowOnGet = false,
    private readonly shouldThrowOnSet = false,
    private readonly shouldThrowOnRemove = false
  ) {}

  getItem(_key: string): string | null {
    if (this.shouldThrowOnGet) {
      throw new Error('DOMException: SecurityError / Storage blocked');
    }
    return null;
  }

  setItem(_key: string, _value: string): void {
    if (this.shouldThrowOnSet) {
      throw new Error('DOMException: QuotaExceededError');
    }
  }

  removeItem(_key: string): void {
    if (this.shouldThrowOnRemove) {
      throw new Error('DOMException: SecurityError');
    }
  }
}

describe('R10: Persistencia de estado en StorageLike (saveGame, loadGame)', () => {
  it('R10-1: guarda y recupera créditos, mejoras, autoventa, planetas, bodega, objetivos y muted', () => {
    const storage = new MemoryStorage();
    const base = createInitialState();

    const stateToSave: GameState = {
      ...base,
      credits: 4500,
      planetActual: 3,
      planetasDesbloqueados: 3,
      objetivosPorPlaneta: { 1: 15, 2: 25, 3: 8, 4: 0 },
      cargo: {
        units: 14,
        value: 420,
        maxCapacity: getCargoCapacity(2),
      },
      upgrades: {
        cannonDamage: 2,
        fireRate: 3,
        hullShield: 1,
        cargoCapacity: 2,
        supportDrone: 1,
        autoSell: true,
      },
      silencio: true,
      tiempoJugadoSegundos: 320,
      stats: {
        targetsDestroyed: 48,
        bossesDefeated: 2,
        totalCreditsEarned: 12500,
      },
    };

    const savedOk = saveGame(storage, stateToSave, true);
    expect(savedOk).toBe(true);

    const rawStored = storage.getItem(SAVE_STORAGE_KEY);
    expect(rawStored).not.toBeNull();

    const loaded = loadGame(storage);

    expect(loaded.muted).toBe(true);
    expect(loaded.state.silencio).toBe(true);
    expect(loaded.state.credits).toBe(4500);
    expect(loaded.state.planetActual).toBe(3);
    expect(loaded.state.planetasDesbloqueados).toBe(3);
    expect(loaded.state.objetivosPorPlaneta).toEqual({ 1: 15, 2: 25, 3: 8, 4: 0 });
    expect(loaded.state.cargo.units).toBe(14);
    expect(loaded.state.cargo.value).toBe(420);
    expect(loaded.state.cargo.maxCapacity).toBe(getCargoCapacity(2));
    expect(loaded.state.upgrades.cannonDamage).toBe(2);
    expect(loaded.state.upgrades.fireRate).toBe(3);
    expect(loaded.state.upgrades.hullShield).toBe(1);
    expect(loaded.state.upgrades.cargoCapacity).toBe(2);
    expect(loaded.state.upgrades.supportDrone).toBe(1);
    expect(loaded.state.upgrades.autoSell).toBe(true);
    expect(loaded.state.ship.currentHull).toBe(getMaxHull(1));
    expect(loaded.state.ship.maxHull).toBe(getMaxHull(1));
    expect(loaded.state.ship.currentShield).toBe(getMaxShield(1));
    expect(loaded.state.ship.maxShield).toBe(getMaxShield(1));
    expect(loaded.state.stats.targetsDestroyed).toBe(48);
    expect(loaded.state.stats.bossesDefeated).toBe(2);
    expect(loaded.state.stats.totalCreditsEarned).toBe(12500);
  });

  it('R10-2: muted se preserva correctamente cuando es false tanto explícito como derivado de state', () => {
    const storage = new MemoryStorage();
    const state = {
      ...createInitialState(),
      silencio: false,
    };

    saveGame(storage, state, false);
    const loadedExplicit = loadGame(storage);
    expect(loadedExplicit.muted).toBe(false);
    expect(loadedExplicit.state.silencio).toBe(false);

    // Derivado de state.silencio cuando muted parameter no se proporciona
    state.silencio = true;
    saveGame(storage, state);
    const loadedImplicit = loadGame(storage);
    expect(loadedImplicit.muted).toBe(true);
    expect(loadedImplicit.state.silencio).toBe(true);
  });
});

describe('R11: Carga determinista sin progreso offline', () => {
  it('R11-1: los créditos y el tiempo jugado no aumentan entre guardar y cargar', () => {
    const storage = new MemoryStorage();
    const base = createInitialState();
    const savedState: GameState = {
      ...base,
      credits: 2350,
      tiempoJugadoSegundos: 180,
      cargo: {
        units: 5,
        value: 120,
        maxCapacity: getCargoCapacity(0),
      },
    };

    saveGame(storage, savedState, false);

    // Cargar inmediatamente o con intervalo de reloj simulado
    const loaded = loadGame(storage);

    // Sin adición de ingresos pasivos, dron o cálculo offline delta
    expect(loaded.state.credits).toBe(2350);
    expect(loaded.state.tiempoJugadoSegundos).toBe(180);
    expect(loaded.state.cargo.units).toBe(5);
    expect(loaded.state.cargo.value).toBe(120);
    expect(loaded.state.targets).toHaveLength(0);
    expect(loaded.state.projectiles).toHaveLength(0);
  });
});

describe('R10 / R11: Respaldo seguro ante corrupción y fallos de almacenamiento', () => {
  it('R10-F1: devuelve createInitialState y muted: false ante almacenamiento nulo o indefinido', () => {
    const expected = createInitialState();

    const loadedNull = loadGame(null);
    expect(loadedNull.muted).toBe(false);
    expect(loadedNull.state.credits).toBe(expected.credits);
    expect(loadedNull.state.planetActual).toBe(expected.planetActual);

    const loadedUndefined = loadGame(undefined);
    expect(loadedUndefined.muted).toBe(false);
    expect(loadedUndefined.state.credits).toBe(expected.credits);
  });

  it('R10-F2: devuelve estado inicial ante almacenamiento vacío o clave ausente', () => {
    const storage = new MemoryStorage();
    const expected = createInitialState();

    const loaded = loadGame(storage);
    expect(loaded.muted).toBe(false);
    expect(loaded.state.credits).toBe(expected.credits);
    expect(loaded.state.upgrades).toEqual(expected.upgrades);
  });

  it('R10-F3: devuelve estado inicial ante JSON malformado sin lanzar excepción', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_STORAGE_KEY, '{ invalid json truncated:');

    const loaded = loadGame(storage);
    expect(loaded.muted).toBe(false);
    expect(loaded.state.credits).toBe(0);
    expect(loaded.state.planetActual).toBe(1);
    expect(loaded.state.planetasDesbloqueados).toBe(1);
  });

  it('R10-F4: devuelve estado inicial ante versión incompatible o ausente', () => {
    const storage = new MemoryStorage();
    const valid = {
      version: 2, // Incompatible version
      creditos: 100,
      planetaActual: 1,
      planetasDesbloqueados: 1,
      objetivosPorPlaneta: { 1: 0, 2: 0, 3: 0, 4: 0 },
      bodega: { units: 0, value: 0 },
      mejoras: {
        cannonDamage: 0,
        fireRate: 0,
        hullShield: 0,
        cargoCapacity: 0,
        supportDrone: 0,
        autoSell: false,
      },
      muted: false,
      tiempoJugadoSegundos: 0,
      estadisticas: { targetsDestroyed: 0, bossesDefeated: 0, totalCreditsEarned: 0 },
    };

    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(valid));
    const loaded = loadGame(storage);
    expect(loaded.muted).toBe(false);
    expect(loaded.state.credits).toBe(0);
  });

  it('R10-F5: devuelve estado inicial ante tipos inválidos o datos inconsistentes', () => {
    const storage = new MemoryStorage();
    const createPayload = (overrides: Record<string, unknown>) => ({
      version: 1,
      creditos: 100,
      planetaActual: 1,
      planetasDesbloqueados: 1,
      objetivosPorPlaneta: { 1: 0, 2: 0, 3: 0, 4: 0 },
      bodega: { units: 0, value: 0 },
      mejoras: {
        cannonDamage: 0,
        fireRate: 0,
        hullShield: 0,
        cargoCapacity: 0,
        supportDrone: 0,
        autoSell: false,
      },
      muted: false,
      tiempoJugadoSegundos: 0,
      estadisticas: { targetsDestroyed: 0, bossesDefeated: 0, totalCreditsEarned: 0 },
      ...overrides,
    });

    // Créditos negativos
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(createPayload({ creditos: -50 })));
    expect(loadGame(storage).state.credits).toBe(0);

    // Planeta actual mayor que planetas desbloqueados
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(createPayload({ planetaActual: 3, planetasDesbloqueados: 1 }))
    );
    expect(loadGame(storage).state.planetActual).toBe(1);

    // Planeta inexistente (ej. 9)
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(createPayload({ planetaActual: 9, planetasDesbloqueados: 9 }))
    );
    expect(loadGame(storage).state.planetActual).toBe(1);

    // Mejora por encima del límite permitido
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(
        createPayload({
          mejoras: {
            cannonDamage: UPGRADE_CAPS.cannonDamage + 10,
            fireRate: 0,
            hullShield: 0,
            cargoCapacity: 0,
            supportDrone: 0,
            autoSell: false,
          },
        })
      )
    );
    expect(loadGame(storage).state.upgrades.cannonDamage).toBe(0);

    // Bodega con unidades superiores a su capacidad máxima
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(
        createPayload({
          bodega: { units: 9999, value: 0 },
        })
      )
    );
    expect(loadGame(storage).state.cargo.units).toBe(0);

    // Objetivos por planeta inválidos (clave faltante o valor negativo)
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(
        createPayload({
          objetivosPorPlaneta: { 1: -1, 2: 0, 3: 0, 4: 0 },
        })
      )
    );
    expect(loadGame(storage).state.objetivosPorPlaneta).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 });

    // Campo muted no booleano
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify(
        createPayload({
          muted: 'not-a-boolean',
        })
      )
    );
    expect(loadGame(storage).muted).toBe(false);
  });

  it('R10-F6: responde con gracia y sin lanzar excepciones si el almacenamiento arroja error al leer o escribir', () => {
    const errorGetStorage = new ThrowingStorage(true, false, false);
    const loaded = loadGame(errorGetStorage);
    expect(loaded.muted).toBe(false);
    expect(loaded.state.credits).toBe(0);

    const errorSetStorage = new ThrowingStorage(false, true, false);
    const saved = saveGame(errorSetStorage, createInitialState());
    expect(saved).toBe(false);
  });
});

describe('R10: Reinicio y borrado con clearSavedGame', () => {
  it('R10-C1: clearSavedGame elimina la clave de almacenamiento persistido', () => {
    const storage = new MemoryStorage();
    const state = {
      ...createInitialState(),
      credits: 999,
    };

    saveGame(storage, state);
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();

    clearSavedGame(storage);
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();

    const loadedAfterClear = loadGame(storage);
    expect(loadedAfterClear.state.credits).toBe(0);
    expect(loadedAfterClear.muted).toBe(false);
  });

  it('R10-C2: clearSavedGame no lanza excepciones con almacenamiento nulo o que falla', () => {
    expect(() => clearSavedGame(null)).not.toThrow();
    expect(() => clearSavedGame(undefined)).not.toThrow();

    const throwingStorage = new ThrowingStorage(false, false, true);
    expect(() => clearSavedGame(throwingStorage)).not.toThrow();
  });
});
