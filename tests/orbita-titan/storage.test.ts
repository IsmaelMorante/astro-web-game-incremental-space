import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSaveData,
  exportSaveJson,
  loadSaveData,
  parseAndValidateSaveJson,
  persistSaveData,
  validateSaveData,
} from '../../src/features/orbita-titan/game/storage';
import { SAVE_STORAGE_KEY, createInitialSaveData } from '../../src/features/orbita-titan/game/types';

class MemoryStorage {
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

describe('Órbita Titán — Persistencia, validación y migración segura', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('guarda y carga SaveDataV1 bajo la clave astro-incremental-save-v1', () => {
    expect(SAVE_STORAGE_KEY).toBe('astro-incremental-save-v1');

    const save = createInitialSaveData();
    save.creditos = 4250;
    save.nucleos = 7;
    save.planetaActual = 2;
    save.planetasDesbloqueados = 3;
    save.objetivosPorPlaneta = { 1: 25, 2: 14, 3: 0, 4: 0 };
    save.mejoras.danoCanon = 6;
    save.mejoras.autoventa = true;
    save.flota.caza = 2;
    save.tecnologia.imanCuantico = true;
    save.talentos.calibrePesado = 2;
    save.rango = 4;
    save.prestigioNivel = 1;
    save.postura = 'asalto';
    save.silencio = true;
    save.estadisticas.objetivosDestruidos = 39;
    save.estadisticas.jefesDerrotados = 1;
    save.estadisticas.creditosTotalesGanados = 9800;

    persistSaveData(save);

    const raw = storage.getItem('astro-incremental-save-v1');
    expect(raw).not.toBeNull();

    const loaded = loadSaveData();
    expect(loaded.hasExistingSave).toBe(true);
    expect(loaded.data).toEqual(save);

    clearSaveData();
    expect(storage.getItem('astro-incremental-save-v1')).toBeNull();

    const afterClear = loadSaveData();
    expect(afterClear.hasExistingSave).toBe(false);
    expect(afterClear.data).toEqual(createInitialSaveData());
  });

  it('devuelve estado inicial limpio cuando localStorage contiene JSON corrupto', () => {
    storage.setItem(SAVE_STORAGE_KEY, '{corrupt-json: [1, 2, ');

    const loaded = loadSaveData();
    expect(loaded.hasExistingSave).toBe(false);
    expect(loaded.data).toEqual(createInitialSaveData());
    expect(parseAndValidateSaveJson('{invalid json')).toBeNull();
  });

  it('rechaza guardados incompatibles del prototipo anterior con campos en inglés y reinicia de forma segura', () => {
    const legacyEnglishPrototypeSave = {
      version: 1,
      creditos: 1200,
      planetaActual: 2,
      planetasDesbloqueados: 2,
      objetivosPorPlaneta: { 1: 25, 2: 5, 3: 0, 4: 0 },
      bodega: {
        units: 4,
        value: 80,
      },
      mejoras: {
        cannonDamage: 3,
        fireRate: 2,
        hullShield: 1,
        cargoCapacity: 2,
        supportDrone: 1,
        autoSell: false,
      },
      muted: true,
      tiempoJugadoSegundos: 245,
      estadisticas: {
        targetsDestroyed: 30,
        bossesDefeated: 1,
        totalCreditsEarned: 3500,
      },
    };

    expect(validateSaveData(legacyEnglishPrototypeSave)).toBeNull();

    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(legacyEnglishPrototypeSave));
    const loaded = loadSaveData();

    expect(loaded.hasExistingSave).toBe(false);
    expect(loaded.data).toEqual(createInitialSaveData());
  });

  it('rechaza datos con versión errónea o valores fuera de rango', () => {
    const wrongVersion = { ...createInitialSaveData(), version: 2 };
    expect(validateSaveData(wrongVersion)).toBeNull();

    const negativeCredits = { ...createInitialSaveData(), creditos: -1 };
    expect(validateSaveData(negativeCredits)).toBeNull();

    const invalidPlanetProgress = {
      ...createInitialSaveData(),
      planetaActual: 3,
      planetasDesbloqueados: 1,
    };
    expect(validateSaveData(invalidPlanetProgress)).toBeNull();

    const overCapUpgrade = createInitialSaveData();
    overCapUpgrade.mejoras.danoCanon = 99;
    expect(validateSaveData(overCapUpgrade)).toBeNull();
  });

  it('exporta a JSON legible y reimporta mediante parseAndValidateSaveJson', () => {
    const save = createInitialSaveData();
    save.creditos = 1850;
    save.nucleos = 3;
    save.mejoras.cadencia = 4;
    save.flota.corbeta = 1;
    save.postura = 'escudo';

    const exported = exportSaveJson(save);
    expect(typeof exported).toBe('string');
    expect(exported).toContain('"version": 1');

    const reimported = parseAndValidateSaveJson(exported);
    expect(reimported).toEqual(save);
    expect(parseAndValidateSaveJson(JSON.stringify({ version: 1, creditos: 'muchos' }))).toBeNull();
  });
});
