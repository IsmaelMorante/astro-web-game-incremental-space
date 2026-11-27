/**
 * Pruebas de integración del flujo completo de juego (R2, R3, R4, R5, R6, R7, R8, R9, R10, R11).
 * Valida GameController y createGameController con dobles inyectados en memoria:
 * - StorageLike para persistencia sin navegador.
 * - AudioPlayerLike y AudioContextLike para sintetizador procedural sin Web Audio nativo.
 * - CanvasLike y Canvas2DContextLike para renderizado 2D desacoplado de DOM.
 * Cero dependencias de happy-dom o jsdom.
 */

import { describe, expect, it } from 'vitest';
import {
  createGameController,
  type AudioPlayerLike,
} from '../ui/gameController';
import {
  SAVE_STORAGE_KEY,
  saveGame,
  type StorageLike,
} from '../persistence/saveStorage';
import {
  createInitialState,
} from '../engine/balance';
import type {
  GameState,
  SimulationEvent,
} from '../engine/types';
import type {
  Canvas2DContextLike,
  CanvasLike,
} from '../render/renderer';
import type { BoundingRectLike } from '../render/pointerHitTest';
import {
  SynthAudio,
  type AudioContextFactory,
  type AudioNodeLike,
  type SoundKind,
} from '../audio/synthAudio';
import type { HudSnapshot } from '../ui/hudFormatters';

// ============================================================================
// DOBLES DE PRUEBA EN MEMORIA (Sin DOM ni APIs nativas del navegador)
// ============================================================================

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

  has(key: string): boolean {
    return this.store.has(key);
  }
}

class MockAudioPlayer implements AudioPlayerLike {
  unlocked = false;
  muted = false;
  readonly playedEvents: SimulationEvent[] = [];
  readonly playedSounds: SoundKind[] = [];

  async unlock(): Promise<boolean> {
    this.unlocked = true;
    return true;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  playForEvent(event: SimulationEvent): void {
    this.playedEvents.push(event);
  }

  playSound(kind: SoundKind): void {
    this.playedSounds.push(kind);
  }
}

class MockCanvas implements CanvasLike {
  width = 900;
  height = 600;
}

class MockCanvas2DContext implements Canvas2DContextLike {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  lineWidth = 1;
  globalAlpha = 1;
  font?: string;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;

  readonly calls: Array<{ name: string; args: unknown[] }> = [];

  save(): void {
    this.calls.push({ name: 'save', args: [] });
  }

  restore(): void {
    this.calls.push({ name: 'restore', args: [] });
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ name: 'fillRect', args: [x, y, w, h] });
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ name: 'clearRect', args: [x, y, w, h] });
  }

  beginPath(): void {
    this.calls.push({ name: 'beginPath', args: [] });
  }

  closePath(): void {
    this.calls.push({ name: 'closePath', args: [] });
  }

  moveTo(x: number, y: number): void {
    this.calls.push({ name: 'moveTo', args: [x, y] });
  }

  lineTo(x: number, y: number): void {
    this.calls.push({ name: 'lineTo', args: [x, y] });
  }

  arc(x: number, y: number, r: number, start: number, end: number): void {
    this.calls.push({ name: 'arc', args: [x, y, r, start, end] });
  }

  stroke(): void {
    this.calls.push({ name: 'stroke', args: [] });
  }

  fill(): void {
    this.calls.push({ name: 'fill', args: [] });
  }

  fillText(text: string, x: number, y: number): void {
    this.calls.push({ name: 'fillText', args: [text, x, y] });
  }

  setLineDash(segments: number[]): void {
    this.calls.push({ name: 'setLineDash', args: [segments] });
  }
}

function createMockAudioContextFactory(): AudioContextFactory {
  const dummyNode: AudioNodeLike = {
    connect: (dest: AudioNodeLike) => dest,
  };
  const dummyParam = {
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
  };

  return () => ({
    currentTime: 0,
    state: 'running' as AudioContextState,
    destination: dummyNode,
    createGain: () => ({
      ...dummyNode,
      gain: { ...dummyParam },
    }),
    createOscillator: () => ({
      ...dummyNode,
      type: 'sine' as OscillatorType,
      frequency: { ...dummyParam },
      start: () => {},
      stop: () => {},
    }),
    resume: async () => {},
  });
}

const DEFAULT_BOUNDS: BoundingRectLike = Object.freeze({
  left: 0,
  top: 0,
  width: 900,
  height: 600,
});

// ============================================================================
// SUITE DE INTEGRACIÓN
// ============================================================================

describe('Flujo de juego completo con createGameController (R2, R3, R4, R5, R6, R7, R8, R9, R10, R11)', () => {
  // --------------------------------------------------------------------------
  // COTA DE DT Y VALORES ANÓMALOS (R2)
  // --------------------------------------------------------------------------
  describe('Cota de dt y robustez temporal [R2]', () => {
    it('[R2] acota dt a 100 ms (0.1 s) cuando recibe deltas elevados como 5.0 s o 100 s', () => {
      const storage = new MemoryStorage();
      const controller = createGameController({ storage });
      const initialTime = controller.getState().tiempoJugadoSegundos;
      expect(initialTime).toBe(0);

      // dt = 5.0 segundos debe acotarse a MAX_TICK_DT_SECONDS (0.1 s)
      controller.tick(5.0);
      expect(controller.getState().tiempoJugadoSegundos).toBeCloseTo(0.1, 5);

      // dt = 100.0 segundos debe avanzar exactamente otros 0.1 s
      controller.tick(100.0);
      expect(controller.getState().tiempoJugadoSegundos).toBeCloseTo(0.2, 5);
    });

    it('[R2] ignora de forma segura valores negativos, NaN, Infinity y no numéricos sin romper el estado', () => {
      const storage = new MemoryStorage();
      const controller = createGameController({ storage });

      // Delta negativo (-10 s, -0.5 s)
      controller.tick(-10);
      expect(controller.getState().tiempoJugadoSegundos).toBe(0);

      controller.tick(-0.5);
      expect(controller.getState().tiempoJugadoSegundos).toBe(0);

      // Valores no finitos (NaN, Infinity, -Infinity)
      controller.tick(NaN);
      expect(controller.getState().tiempoJugadoSegundos).toBe(0);

      controller.tick(Infinity);
      expect(controller.getState().tiempoJugadoSegundos).toBe(0);

      controller.tick(-Infinity);
      expect(controller.getState().tiempoJugadoSegundos).toBe(0);

      // Tras entradas anómalas, un tick válido normal funciona a la perfección
      controller.tick(0.05);
      expect(controller.getState().tiempoJugadoSegundos).toBeCloseTo(0.05, 5);
    });
  });

  // --------------------------------------------------------------------------
  // PERSISTENCIA, RECARGA SIN PROGRESO OFFLINE Y REINICIO (R10, R11)
  // --------------------------------------------------------------------------
  describe('Persistencia, guardado automático y recarga sin progreso offline [R10, R11]', () => {
    it('[R10, R11] guarda automáticamente en acciones clave (venta, mejora, silencio) y recarga sin progreso offline', () => {
      const storage = new MemoryStorage();
      const audio = new MockAudioPlayer();
      const controller = createGameController({ storage, audio });

      // Sembrar minerales en bodega y créditos para verificar guardado
      const seededState: GameState = {
        ...controller.getState(),
        credits: 200,
        cargo: { units: 4, value: 80, maxCapacity: 10 },
      };
      saveGame(storage, seededState, false);

      // Nueva instancia cargando el estado sembrado
      const loadedController = createGameController({ storage, audio });
      expect(loadedController.getState().credits).toBe(200);
      expect(loadedController.getState().cargo.units).toBe(4);

      // Acción clave 1: Venta de carga -> debe guardar al instante
      const sold = loadedController.sellCargo();
      expect(sold).toBe(true);
      expect(loadedController.getState().credits).toBe(280);
      expect(loadedController.getState().cargo.units).toBe(0);
      expect(storage.has(SAVE_STORAGE_KEY)).toBe(true);

      // Acción clave 2: Compra de mejora -> debe guardar al instante
      const bought = loadedController.buyUpgrade('cannonDamage');
      expect(bought).toBe(true);
      expect(loadedController.getState().upgrades.cannonDamage).toBe(1);
      expect(loadedController.getState().credits).toBe(280 - 25); // Coste nivel 0 = 25

      // Acción clave 3: Alternar silencio -> debe guardar al instante
      const isMuted = loadedController.toggleMute();
      expect(isMuted).toBe(true);

      // Guardar el tiempo jugado simulado antes de cerrar la sesión
      const simulatedTimeBefore = loadedController.getState().tiempoJugadoSegundos;

      // Recarga en una nueva instancia a partir del almacenamiento local
      const reloadedController = createGameController({ storage, audio });
      const reloadedState = reloadedController.getState();

      // Comprobación de fidelidad sin progreso offline:
      // - Los créditos, mejoras y silencio se preservan con exactitud
      expect(reloadedState.credits).toBe(255);
      expect(reloadedState.upgrades.cannonDamage).toBe(1);
      expect(reloadedController.isMuted()).toBe(true);
      // - El tiempo jugado NO salta por tiempo de reloj real transcurrido
      expect(reloadedState.tiempoJugadoSegundos).toBe(simulatedTimeBefore);
      // - No se generaron recursos offline ficticios en la bodega
      expect(reloadedState.cargo.units).toBe(0);
      // - Los objetivos del planeta se repueblan al reiniciar la sesión
      expect(reloadedState.targets.length).toBeGreaterThan(0);
    });

    it('[R10] guardado periódico de respaldo se dispara tras acumular 10 s de simulación en tick', () => {
      const storage = new MemoryStorage();
      const controller = createGameController({ storage });
      expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();

      // 90 ticks de 0.1 s = 9.0 segundos (no alcanza 10 s)
      for (let i = 0; i < 90; i += 1) {
        controller.tick(0.1);
      }
      expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();

      // Superar los 10.0 s acumulados (15 ticks adicionales) -> dispara autosave
      for (let i = 0; i < 15; i += 1) {
        controller.tick(0.1);
      }
      expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
    });

    it('[R10] confirmReset() limpia completamente el almacenamiento y restablece el estado inicial', () => {
      const storage = new MemoryStorage();
      const audio = new MockAudioPlayer();
      const controller = createGameController({ storage, audio });

      // Modificar el estado comprando y silenciando
      controller.toggleMute();
      expect(storage.has(SAVE_STORAGE_KEY)).toBe(true);
      expect(controller.isMuted()).toBe(true);

      // Confirmar reinicio
      controller.confirmReset();

      // El almacenamiento debe estar completamente vacío
      expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();

      // El estado debe volver a los valores iniciales limpios
      const resetState = controller.getState();
      expect(resetState.credits).toBe(0);
      expect(resetState.planetActual).toBe(1);
      expect(resetState.planetasDesbloqueados).toBe(1);
      expect(resetState.upgrades.cannonDamage).toBe(0);
      expect(resetState.cargo.units).toBe(0);
      expect(controller.isMuted()).toBe(false);
      expect(resetState.targets.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // INTERACCIÓN POR PUNTERO Y FIJACIÓN MANUAL (R3)
  // --------------------------------------------------------------------------
  describe('Interacción por puntero [R3]', () => {
    it('[R3] handlePointerDown selecciona objetivo bajo el clic y libera la fijación al pulsar en vacío', () => {
      const audio = new MockAudioPlayer();
      const controller = createGameController({ audio });
      const targets = controller.getState().targets;
      expect(targets.length).toBeGreaterThan(0);

      const target = targets[0];
      expect(controller.getState().lockedTargetId).toBeNull();

      // Clic directo sobre las coordenadas del objetivo
      controller.handlePointerDown(target.x, target.y, DEFAULT_BOUNDS);
      expect(controller.getState().lockedTargetId).toBe(target.id);
      expect(audio.unlocked).toBe(true);

      // Clic en una coordenada vacía distante (0, 0)
      controller.handlePointerDown(0, 0, DEFAULT_BOUNDS);
      expect(controller.getState().lockedTargetId).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // CICLO COMPLETO DE ECONOMÍA Y MEJORAS (R6, R7)
  // --------------------------------------------------------------------------
  describe('Economía y mejoras [R6, R7]', () => {
    it('[R6] sellCargo devuelve false con bodega vacía y true liquidando minerales cuando hay carga', () => {
      const audio = new MockAudioPlayer();
      const controller = createGameController({ audio });

      // Venta con bodega vacía
      expect(controller.sellCargo()).toBe(false);

      // Sembrar carga en bodega mediante estado guardado
      const storage = new MemoryStorage();
      const initial = createInitialState();
      const stateWithCargo: GameState = {
        ...initial,
        cargo: { units: 5, value: 120, maxCapacity: 10 },
      };
      saveGame(storage, stateWithCargo, false);

      const loadedController = createGameController({ storage, audio });
      expect(loadedController.sellCargo()).toBe(true);
      expect(loadedController.getState().credits).toBe(120);
      expect(loadedController.getState().cargo.units).toBe(0);
      expect(audio.playedEvents.some((e) => e.type === 'cargo_sold')).toBe(true);
    });

    it('[R7] buyUpgrade rechaza compras sin fondos y procesa compras válidas descontando créditos y emitiendo sonido', () => {
      const audio = new MockAudioPlayer();
      const storage = new MemoryStorage();
      const controller = createGameController({ storage, audio });

      // Intento de comprar cañón sin créditos (coste 25, créditos 0)
      expect(controller.buyUpgrade('cannonDamage')).toBe(false);
      expect(controller.getState().upgrades.cannonDamage).toBe(0);

      // Sembrar créditos suficientes (100 cr)
      const stateWithCredits: GameState = {
        ...createInitialState(),
        credits: 100,
      };
      saveGame(storage, stateWithCredits, false);

      const fundedController = createGameController({ storage, audio });
      const success = fundedController.buyUpgrade('cannonDamage');
      expect(success).toBe(true);
      expect(fundedController.getState().upgrades.cannonDamage).toBe(1);
      expect(fundedController.getState().credits).toBe(75);
      expect(audio.playedEvents.some((e) => e.type === 'upgrade_purchased')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // VIAJE ENTRE PLANETAS Y COMBATE CONTRA JEFE (R4, R8)
  // --------------------------------------------------------------------------
  describe('Viaje planetario y combate contra jefes [R4, R8]', () => {
    it('[R4] selectPlanet rechaza planetas bloqueados y permite viaje bidireccional entre planetas desbloqueados', () => {
      const storage = new MemoryStorage();
      const initial = createInitialState();
      // Desbloquear hasta planeta 2
      const stateWith2Planets: GameState = {
        ...initial,
        planetasDesbloqueados: 2,
      };
      saveGame(storage, stateWith2Planets, false);

      const controller = createGameController({ storage });
      expect(controller.getState().planetActual).toBe(1);

      // Intento de viajar a planeta 3 (bloqueado)
      expect(controller.selectPlanet(3)).toBe(false);
      expect(controller.getState().planetActual).toBe(1);

      // Viaje válido a planeta 2
      expect(controller.selectPlanet(2)).toBe(true);
      expect(controller.getState().planetActual).toBe(2);
      expect(controller.getState().targets.length).toBeGreaterThan(0);

      // Viaje de regreso a planeta 1
      expect(controller.selectPlanet(1)).toBe(true);
      expect(controller.getState().planetActual).toBe(1);
    });

    it('[R8] derrota ante el jefe repara íntegramente la nave conservando créditos, bodega y mejoras intactas', () => {
      const storage = new MemoryStorage();
      const audio = new MockAudioPlayer();
      const initial = createInitialState();

      // Sembrar estado con umbral del jefe cumplido (25 destruidos), créditos y carga acumulada
      const stateReadyForBoss: GameState = {
        ...initial,
        credits: 350,
        cargo: { units: 7, value: 140, maxCapacity: 10 },
        upgrades: {
          ...initial.upgrades,
          cannonDamage: 2,
          cargoCapacity: 1,
        },
        objetivosPorPlaneta: { 1: 25, 2: 0, 3: 0, 4: 0 },
      };
      saveGame(storage, stateReadyForBoss, false);

      const controller = createGameController({ storage, audio });
      expect(controller.getState().bossActive).toBe(false);

      // Desafiar al jefe del Planeta 1
      const bossStarted = controller.startBoss();
      expect(bossStarted).toBe(true);
      expect(controller.getState().bossActive).toBe(true);
      expect(audio.playedEvents.some((e) => e.type === 'boss_spawned')).toBe(true);

      // Simular ticks hasta que el daño del jefe (10 de daño cada 2 s) destruya la nave (total 120 PV)
      // 240 ticks de 0.1 s = 24 segundos de combate
      for (let i = 0; i < 250; i += 1) {
        controller.tick(0.1);
        if (!controller.getState().bossActive) {
          break;
        }
      }

      // Verificaciones estrictas tras la derrota ante el jefe (R8):
      // 1. El evento de derrota del jugador fue emitido
      expect(audio.playedEvents.some((e) => e.type === 'player_defeated')).toBe(true);
      // 2. El combate contra el jefe se canceló y volvieron los objetivos normales
      const postDefeatState = controller.getState();
      expect(postDefeatState.bossActive).toBe(false);
      expect(postDefeatState.targets.length).toBeGreaterThan(0);
      expect(postDefeatState.targets.every((t) => t.type !== 'boss')).toBe(true);
      // 3. La nave fue reparada al 100 % de su casco y escudo máximos
      expect(postDefeatState.ship.currentHull).toBe(postDefeatState.ship.maxHull);
      expect(postDefeatState.ship.currentShield).toBe(postDefeatState.ship.maxShield);
      // 4. Se conservan todas las mejoras, créditos y bodega sin pérdidas ni penalizaciones
      expect(postDefeatState.credits).toBe(350);
      expect(postDefeatState.cargo.units).toBe(7);
      expect(postDefeatState.cargo.value).toBe(140);
      expect(postDefeatState.upgrades.cannonDamage).toBe(2);
      expect(postDefeatState.upgrades.cargoCapacity).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // VICTORIA FINAL EN PLANETA 4 Y CONTINUIDAD INDEFINIDA (R9)
  // --------------------------------------------------------------------------
  describe('Victoria final en planeta 4 y confirmación de continuidad [R9]', () => {
    it('[R9] derrotar al cuarto jefe activa la victoria y continuePlaying permite seguir jugando', () => {
      const storage = new MemoryStorage();
      const audio = new MockAudioPlayer();
      const initial = createInitialState();

      // Sembrar partida avanzada en Planeta 4 con mejoras al máximo para vencer al jefe
      const statePlanet4: GameState = {
        ...initial,
        planetActual: 4,
        planetasDesbloqueados: 4,
        credits: 5000,
        objetivosPorPlaneta: { 1: 25, 2: 35, 3: 50, 4: 50 },
        upgrades: {
          cannonDamage: 20,
          fireRate: 15,
          hullShield: 15,
          cargoCapacity: 10,
          supportDrone: 10,
          autoSell: true,
        },
      };
      saveGame(storage, statePlanet4, false);

      const controller = createGameController({ storage, audio });
      expect(controller.getState().planetActual).toBe(4);

      // Iniciar el combate contra el Guardián Solar (jefe 4)
      const bossStarted = controller.startBoss();
      expect(bossStarted).toBe(true);
      expect(controller.getState().bossActive).toBe(true);

      // Avanzar simulación hasta que el DPS de la nave (642 DPS) venza al jefe (30 000 PV ~ 47 s)
      // 550 ticks de 0.1 s = 55 segundos de simulación
      for (let i = 0; i < 550; i += 1) {
        controller.tick(0.1);
        if (!controller.getState().bossActive) {
          break;
        }
      }

      // Verificaciones de victoria (R9):
      expect(audio.playedEvents.some((e) => e.type === 'boss_defeated')).toBe(true);
      expect(audio.playedEvents.some((e) => e.type === 'victory')).toBe(true);

      // La superposición de victoria debe estar activa en el HUD
      const victorySnapshot = controller.getHudSnapshot();
      expect(victorySnapshot.victory.active).toBe(true);

      // El jugador pulsa continuar jugando
      controller.continuePlaying();

      // La superposición de victoria desaparece y la confirmación queda registrada en la sesión
      const continuedSnapshot = controller.getHudSnapshot();
      expect(continuedSnapshot.victory.active).toBe(false);
      expect(controller.getState().victoryAcknowledged).toBe(true);

      // La partida se guarda en almacenamiento conservando planetas desbloqueados y estadísticas
      const reloaded = createGameController({ storage, audio });
      expect(reloaded.getState().planetActual).toBe(4);
      expect(reloaded.getState().planetasDesbloqueados).toBe(4);
      expect(reloaded.getState().stats.bossesDefeated).toBeGreaterThanOrEqual(1);
      expect(reloaded.getHudSnapshot().victory.active).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // INTEGRACIÓN VISUAL (CANVAS 2D) Y SINTETIZADOR PROCEDURAL (AUDIO)
  // --------------------------------------------------------------------------
  describe('Integración con Canvas 2D y SynthAudio procedural', () => {
    it('renderiza la escena visual en el contexto 2D inyectado en cada tick y actualización', () => {
      const canvas = new MockCanvas();
      const ctx = new MockCanvas2DContext();
      let snapshotReceived: HudSnapshot | null = null;

      const controller = createGameController({
        canvas,
        ctx,
        onStateChange: (snap) => {
          snapshotReceived = snap;
        },
      });

      expect(ctx.calls.length).toBe(0);

      // Tick activa renderizado y notificación al suscriptor HUD
      controller.tick(0.1);
      expect(ctx.calls.length).toBeGreaterThan(0);
      expect(snapshotReceived).not.toBeNull();
      const nonNullSnapshot = snapshotReceived as unknown as HudSnapshot;
      expect(nonNullSnapshot.ship.hullText).toBeDefined();

      // Render manual directo
      const callsBefore = ctx.calls.length;
      controller.render();
      expect(ctx.calls.length).toBeGreaterThan(callsBefore);
    });

    it('funciona correctamente con la instancia SynthAudio inyectando factoría de AudioContext', async () => {
      const mockAudioFactory = createMockAudioContextFactory();
      const synth = new SynthAudio(mockAudioFactory);
      const storage = new MemoryStorage();

      const controller = createGameController({
        audio: synth,
        storage,
      });

      expect(controller.isMuted()).toBe(false);
      expect(controller.toggleMute()).toBe(true);
      expect(controller.isMuted()).toBe(true);

      // Desbloqueo y reproducción procedural sin fallos
      controller.sellCargo();
      controller.tick(0.1);
      expect(controller.getState().silencio).toBe(true);
    });
  });
});
