import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpaceGameEngine } from '../../src/features/orbita-titan/game/engine';
import {
  MAX_SIM_DT_SEC,
  SAVE_STORAGE_KEY,
  createInitialSaveData,
} from '../../src/features/orbita-titan/game/types';

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

describe('Órbita Titán — Motor SpaceGameEngine', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inicializa el motor con casco y escudo al máximo, contrato activo y snapshot consistente', () => {
    const initial = createInitialSaveData();
    initial.mejoras.cascoEscudo = 2; // cascoMax = 130, escudoMax = 90
    initial.silencio = true;

    const engine = new SpaceGameEngine(initial);
    const snapshot = engine.getSnapshot();

    expect(snapshot.creditos).toBe(0);
    expect(snapshot.planetaActual).toBe(1);
    expect(snapshot.silencio).toBe(true);
    expect(snapshot.cascoActual).toBe(130);
    expect(snapshot.escudoActual).toBe(90);
    expect(snapshot.stats.cascoMax).toBe(130);
    expect(snapshot.stats.escudoMax).toBe(90);
    expect(snapshot.stats.dpsTotal).toBe(10);
    expect(snapshot.jefeActivo).toBeNull();
    expect(snapshot.contratoActivo).not.toBeNull();
    expect(snapshot.anomaliaActiva).toBe(false);
  });

  it('avanza la simulación en step(dt) acotando deltas altos a MAX_SIM_DT_SEC e ignorando deltas negativos', () => {
    const engine = new SpaceGameEngine(createInitialSaveData());

    engine.step(-5);
    expect(engine.getSnapshot().tiempoJugadoSegundos).toBe(0);

    // Delta enorme debe acotarse exactamente a MAX_SIM_DT_SEC (0.1 s)
    engine.step(12.5);
    let snapshot = engine.getSnapshot();
    expect(snapshot.tiempoJugadoSegundos).toBeCloseTo(MAX_SIM_DT_SEC, 6);
    expect(snapshot.estadisticas.mejorDps).toBe(10);

    // Acumular 10 s de simulación (100 pasos de 0.1 s) dispara el autoguardado periódico
    for (let i = 0; i < 100; i++) {
      engine.step(MAX_SIM_DT_SEC);
    }

    snapshot = engine.getSnapshot();
    expect(snapshot.tiempoJugadoSegundos).toBeCloseTo(10.1, 5);
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
  });

  it('gestiona la compra de mejoras (buyUpgrade), descuenta créditos, actualiza estadísticas y guarda', () => {
    const onImmediateSave = vi.fn();
    const initial = createInitialSaveData();
    initial.creditos = 500;

    const engine = new SpaceGameEngine(initial, { onImmediateSave });

    // Compra unitaria de daño de cañón (nivel 0 -> 1, coste 25 cr)
    expect(engine.buyUpgrade('danoCanon', 1)).toBe(true);
    let snapshot = engine.getSnapshot();
    expect(snapshot.creditos).toBe(475);
    expect(snapshot.mejoras.danoCanon).toBe(1);
    expect(snapshot.stats.danoCanon).toBe(15);
    expect(onImmediateSave).toHaveBeenCalledTimes(1);
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();

    // Compra de Casco y Escudo aumenta también cascoActual y escudoActual
    const prevCasco = snapshot.cascoActual;
    const prevEscudo = snapshot.escudoActual;
    expect(engine.buyUpgrade('cascoEscudo', 1)).toBe(true); // coste 35 cr
    snapshot = engine.getSnapshot();
    expect(snapshot.creditos).toBe(440);
    expect(snapshot.mejoras.cascoEscudo).toBe(1);
    expect(snapshot.cascoActual).toBe(prevCasco + 25);
    expect(snapshot.escudoActual).toBe(prevEscudo + 25);

    // Compra múltiple ×5 falla si no alcanza para todos? No, compra los que pueda o 0 si no alcanza el primero
    // Con 440 cr y danoCanon en nivel 1 (costes: 50 + 75 + 100 + 125 + 150 = 500), compra 4 niveles (350 cr)
    expect(engine.buyUpgrade('danoCanon', 5)).toBe(true);
    snapshot = engine.getSnapshot();
    expect(snapshot.mejoras.danoCanon).toBe(5);
    expect(snapshot.creditos).toBe(90);

    // Sin créditos suficientes para el siguiente nivel (175 cr) devuelve false
    expect(engine.buyUpgrade('danoCanon', 1)).toBe(false);
    expect(engine.getSnapshot().mejoras.danoCanon).toBe(5);
  });

  it('devuelve snapshots desacoplados que reflejan cambios de estado y mutaciones externas no alteran el motor', () => {
    const initial = createInitialSaveData();
    initial.creditos = 2000;
    initial.bodega = { unidades: 3, valorCreditos: 120 };

    const engine = new SpaceGameEngine(initial);
    const snap1 = engine.getSnapshot();

    // Mutar el snapshot no debe alterar el estado interno del motor
    snap1.mejoras.danoCanon = 99;
    snap1.objetivosPorPlaneta[1] = 999;

    const snap2 = engine.getSnapshot();
    expect(snap2.mejoras.danoCanon).toBe(0);
    expect(snap2.objetivosPorPlaneta[1]).toBe(0);

    engine.sellAllCargo();
    engine.setStance('asalto');
    engine.buyFleetShip('caza', 1);

    const snap3 = engine.getSnapshot();
    expect(snap3.bodega).toEqual({ unidades: 0, valorCreditos: 0 });
    expect(snap3.postura).toBe('asalto');
    expect(snap3.flota.caza).toBe(1);
    expect(snap3.creditos).toBe(2000 + 120 - 350);
    expect(snap3.stats.dpsFlota).toBeGreaterThan(0);
  });
});
