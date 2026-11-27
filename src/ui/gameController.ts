/**
 * Controlador desacoplado del bucle y acciones de juego (R2, R3, R4, R6, R7, R8, R10, R11).
 * Orquesta motor de simulación, sintetizador de audio, efectos visuales de game feel,
 * renderizado Canvas 2D y persistencia en localStorage sin acoplamiento a happy-dom ni jsdom.
 */

import type {
  FleetShipType,
  GameState,
  PlanetId,
  SimulationEvent,
  UpgradeKey,
} from '../engine/types';
import {
  activateOverdrive,
  canActivateOverdrive,
  canEmergencyRepair,
  canFireEmpBlast,
  challengeBoss,
  dismissVictoryOverlay,
  emergencyRepair,
  fireEmpBlast,
  populateInitialTargets,
  resetGameState,
  stepSimulation,
  travelToPlanet,
  triggerManualPulse,
} from '../engine/simulation';
import {
  canPurchaseFleetShip,
  canPurchaseOverclock,
  purchaseFleetShip,
  purchaseOverclock,
  purchaseUpgrade,
  sellAllCargo,
} from '../engine/economy';
import { setLockedTarget } from '../engine/combat';
import { ARENA_HEIGHT, ARENA_WIDTH, SHIP_POSITION } from '../engine/balance';
import {
  clearSavedGame,
  loadGame,
  saveGame,
  type StorageLike,
} from '../persistence/saveStorage';
import { SynthAudio, type SoundKind } from '../audio/synthAudio';
import {
  renderGameScene,
  VisualEffectsState,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Canvas2DContextLike,
  type CanvasLike,
} from '../render/renderer';
import {
  clientToWorldPoint,
  hitTestTarget,
  type BoundingRectLike,
} from '../render/pointerHitTest';
import {
  createHudSnapshot,
  type HudSnapshot,
} from './hudFormatters';

export const MAX_TICK_DT_SECONDS = 0.1;
export const AUTOSAVE_INTERVAL_SECONDS = 10;

export interface AudioPlayerLike {
  unlock(): Promise<boolean>;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  toggleMute(): boolean;
  playForEvent(event: SimulationEvent): void;
  playSound?(kind: SoundKind): void;
}

export interface GameControllerDeps {
  readonly storage?: StorageLike | null;
  readonly audio?: AudioPlayerLike | null;
  readonly onStateChange?: (snapshot: HudSnapshot) => void;
  readonly canvas?: CanvasLike | null;
  readonly ctx?: Canvas2DContextLike | null;
  readonly effects?: VisualEffectsState | null;
}

export class GameController {
  private readonly storage: StorageLike | null;
  private readonly audio: AudioPlayerLike;
  private readonly effects: VisualEffectsState;
  private onStateChange?: (snapshot: HudSnapshot) => void;
  private canvas: CanvasLike | null;
  private ctx: Canvas2DContextLike | null;

  private state: GameState;
  private victoryActive: boolean = false;
  private autosaveAccumulatorSeconds: number = 0;

  constructor(deps: GameControllerDeps = {}) {
    this.storage =
      deps.storage !== undefined
        ? deps.storage
        : typeof localStorage !== 'undefined'
          ? localStorage
          : null;

    this.audio = deps.audio ?? new SynthAudio();
    this.effects = deps.effects ?? new VisualEffectsState();
    this.onStateChange = deps.onStateChange;
    this.canvas = deps.canvas ?? null;
    this.ctx = deps.ctx ?? null;

    const loaded = loadGame(this.storage);
    let initialState = loaded.state;

    // Poblar objetivos iniciales del planeta si se carga una partida sin objetivos vivos
    if (initialState.targets.length === 0 && !initialState.bossActive) {
      initialState = populateInitialTargets(initialState);
    }

    this.state = initialState;
    this.audio.setMuted(loaded.muted);
  }

  getState(): GameState {
    return this.state;
  }

  getEffects(): VisualEffectsState {
    return this.effects;
  }

  isMuted(): boolean {
    return this.audio.isMuted();
  }

  getCanvas(): CanvasLike | null {
    return this.canvas;
  }

  getHudSnapshot(): HudSnapshot {
    return createHudSnapshot(this.state, this.audio.isMuted(), this.victoryActive);
  }

  setCanvas(canvas: CanvasLike | null, ctx: Canvas2DContextLike | null): void {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  setOnStateChange(listener: ((snapshot: HudSnapshot) => void) | undefined): void {
    this.onStateChange = listener;
  }

  render(): void {
    if (this.ctx) {
      renderGameScene(this.ctx, this.state, WORLD_WIDTH, WORLD_HEIGHT, this.effects);
    }
  }

  /**
   * Avanza la simulación acotando dt a un máximo de 100 ms (0.1 s).
   * Actualiza efectos visuales, reproduce audio, gestiona guardados críticos y notifica cambios.
   */
  tick(rawDtSeconds: number): void {
    const safeDt = Number.isFinite(rawDtSeconds) ? rawDtSeconds : 0;
    const dt = Math.min(Math.max(safeDt, 0), MAX_TICK_DT_SECONDS);

    if (dt > 0) {
      this.effects.update(dt);

      const stepResult = stepSimulation(this.state, dt);
      this.state = stepResult.state;

      for (const event of stepResult.events) {
        this.audio.playForEvent(event);
        this.processSimulationEventForEffects(event);
        if (event.type === 'victory') {
          this.victoryActive = true;
        }
      }

      this.autosaveAccumulatorSeconds += dt;

      const hasCriticalEvent = stepResult.events.some(
        (ev) =>
          ev.type === 'boss_defeated' ||
          ev.type === 'planet_unlocked' ||
          ev.type === 'victory'
      );

      if (hasCriticalEvent || this.autosaveAccumulatorSeconds >= AUTOSAVE_INTERVAL_SECONDS) {
        this.save();
        this.autosaveAccumulatorSeconds = 0;
      }
    }

    this.renderAndNotify();
  }

  /**
   * Resuelve la interacción por puntero del jugador:
   * Al pulsar un objetivo, emite un pulso manual y lo fija; al pulsar en vacío, libera la fijación.
   */
  handlePointerDown(
    clientX: number,
    clientY: number,
    rect: BoundingRectLike
  ): void {
    void this.audio.unlock();
    const worldPoint = clientToWorldPoint(clientX, clientY, rect);
    const hitTargetId = hitTestTarget(worldPoint, this.state.targets);

    if (hitTargetId) {
      const pulseResult = triggerManualPulse(this.state, hitTargetId);
      this.state = pulseResult.state;
      for (const event of pulseResult.events) {
        this.audio.playForEvent(event);
        this.processSimulationEventForEffects(event);
      }
    } else {
      this.state = setLockedTarget(this.state, null);
    }

    this.renderAndNotify();
  }

  /**
   * Vende toda la carga de la bodega, reproduce sonido y guarda al instante.
   */
  sellCargo(): boolean {
    void this.audio.unlock();
    const result = sellAllCargo(this.state);
    if (result.state === this.state) {
      return false;
    }

    this.state = result.state;
    for (const event of result.events) {
      this.audio.playForEvent(event);
      this.processSimulationEventForEffects(event);
    }
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Adquiere la mejora indicada, reproduce sonido y guarda al instante.
   */
  buyUpgrade(key: UpgradeKey): boolean {
    void this.audio.unlock();
    const result = purchaseUpgrade(this.state, key);
    if (result.state === this.state) {
      return false;
    }

    this.state = result.state;
    for (const event of result.events) {
      this.audio.playForEvent(event);
      this.processSimulationEventForEffects(event);
    }
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Activa el combate contra el jefe del planeta actual, reproduce sonido y guarda al instante.
   */
  startBoss(): boolean {
    void this.audio.unlock();
    const result = challengeBoss(this.state);
    if (result.state === this.state) {
      return false;
    }

    this.state = result.state;
    for (const event of result.events) {
      this.audio.playForEvent(event);
      this.processSimulationEventForEffects(event);
    }
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Viaja al planeta seleccionado y guarda la partida al instante.
   */
  selectPlanet(planetId: PlanetId): boolean {
    void this.audio.unlock();
    const nextState = travelToPlanet(this.state, planetId);
    if (nextState === this.state) {
      return false;
    }

    this.state = nextState;
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Activa el consumible táctico de Sobrecarga (Overdrive), reproduce sonido y guarda al instante.
   */
  useOverdrive(): boolean {
    void this.audio.unlock();
    if (!canActivateOverdrive(this.state)) {
      return false;
    }

    const result = activateOverdrive(this.state);
    this.state = result.state;
    for (const event of result.events) {
      this.audio.playForEvent(event);
      this.processSimulationEventForEffects(event);
    }
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Activa el consumible táctico de Reparación de Emergencia, reproduce sonido y guarda al instante.
   */
  useEmergencyRepair(): boolean {
    void this.audio.unlock();
    if (!canEmergencyRepair(this.state)) {
      return false;
    }

    const result = emergencyRepair(this.state);
    this.state = result.state;
    for (const event of result.events) {
      this.audio.playForEvent(event);
      this.processSimulationEventForEffects(event);
    }
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Lanza un pulso EMP de área completa, reproduce sonido y guarda al instante.
   */
  useEmpBlast(): boolean {
    void this.audio.unlock();
    if (!canFireEmpBlast(this.state)) {
      return false;
    }

    const result = fireEmpBlast(this.state);
    this.state = result.state;
    for (const event of result.events) {
      this.audio.playForEvent(event);
      this.processSimulationEventForEffects(event);
    }
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Adquiere un nivel de sobremarcha del reactor, reproduce sonido y guarda al instante.
   */
  buyOverclock(): boolean {
    void this.audio.unlock();
    if (!canPurchaseOverclock(this.state)) {
      return false;
    }

    const result = purchaseOverclock(this.state);
    this.state = result.state;
    for (const event of result.events) {
      this.audio.playForEvent(event);
      this.processSimulationEventForEffects(event);
    }
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Adquiere una nave de combate para la flota aliada en órbita.
   */
  buyFleetShip(shipType: FleetShipType): boolean {
    void this.audio.unlock();
    if (!canPurchaseFleetShip(this.state, shipType)) {
      return false;
    }

    const result = purchaseFleetShip(this.state, shipType);
    this.state = result.state;
    for (const event of result.events) {
      this.audio.playForEvent(event);
      this.processSimulationEventForEffects(event);
    }
    this.save();
    this.renderAndNotify();
    return true;
  }

  /**
   * Alterna el estado de silencio del audio y guarda al instante.
   */
  toggleMute(): boolean {
    void this.audio.unlock();
    const nextMuted = this.audio.toggleMute();
    this.state = {
      ...this.state,
      silencio: nextMuted,
    };
    this.save();
    this.renderAndNotify();
    return nextMuted;
  }

  /**
   * Descarta la superposición de victoria y guarda la confirmación.
   */
  continuePlaying(): void {
    void this.audio.unlock();
    this.victoryActive = false;
    this.state = dismissVictoryOverlay(this.state);
    this.save();
    this.renderAndNotify();
  }

  /**
   * Elimina la partida guardada y restaura el estado inicial con objetivos poblados.
   */
  confirmReset(): void {
    void this.audio.unlock();
    clearSavedGame(this.storage);
    this.state = resetGameState();
    this.victoryActive = false;
    this.autosaveAccumulatorSeconds = 0;
    this.audio.setMuted(false);
    this.renderAndNotify();
  }

  private processSimulationEventForEffects(event: SimulationEvent): void {
    switch (event.type) {
      case 'hit': {
        const target = this.state.targets.find((t) => t.id === event.targetId);
        const tx = target ? target.x : ARENA_WIDTH / 2;
        const ty = target ? target.y : 150;
        this.effects.addFloatingText(tx, ty - 10, `-${event.damage}`, '#FBBF24');
        break;
      }
      case 'target_destroyed': {
        const target = this.state.targets.find((t) => t.id === event.targetId);
        const tx = target ? target.x : ARENA_WIDTH / 2;
        const ty = target ? target.y : 150;
        const color =
          event.targetType === 'boss'
            ? '#EF4444'
            : event.targetType === 'enemy'
              ? '#FB7185'
              : '#F59E0B';
        const count =
          event.targetType === 'boss' ? 44 : event.targetType === 'enemy' ? 22 : 14;
        this.effects.addExplosion(tx, ty, color, count);
        this.effects.addShockwave(
          tx,
          ty,
          event.targetType === 'boss' ? 95 : 44,
          color
        );
        this.effects.addFloatingText(tx, ty - 16, `+${event.rewardCredits} cr`, '#F59E0B');
        if (event.targetType === 'boss') {
          this.effects.addScreenShake(8, 0.4);
        }
        break;
      }
      case 'cargo_sold': {
        this.effects.addFloatingText(
          SHIP_POSITION.x,
          SHIP_POSITION.y - 18,
          `+${event.creditsEarned} cr`,
          '#10B981'
        );
        break;
      }
      case 'emp_blast': {
        this.effects.addShockwave(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 290, '#22D3EE');
        this.effects.addScreenShake(7, 0.35);
        break;
      }
      case 'player_hit': {
        const totalDamage = event.shieldDamage + event.hullDamage;
        this.effects.addFloatingText(
          SHIP_POSITION.x,
          SHIP_POSITION.y - 14,
          `-${totalDamage}`,
          '#FB7185'
        );
        this.effects.addExplosion(SHIP_POSITION.x, SHIP_POSITION.y, '#FB7185', 8);
        this.effects.addScreenShake(4.5, 0.18);
        break;
      }
      case 'overdrive_activated': {
        this.effects.addShockwave(SHIP_POSITION.x, SHIP_POSITION.y, 65, '#F59E0B');
        break;
      }
      case 'emergency_repair': {
        this.effects.addShockwave(SHIP_POSITION.x, SHIP_POSITION.y, 50, '#10B981');
        const restored = event.hullRestored + event.shieldRestored;
        this.effects.addFloatingText(
          SHIP_POSITION.x,
          SHIP_POSITION.y - 20,
          `+${restored}`,
          '#10B981'
        );
        break;
      }
      case 'boss_defeated': {
        this.effects.addScreenShake(9, 0.5);
        this.effects.addShockwave(ARENA_WIDTH / 2, 140, 140, '#EF4444');
        break;
      }
    }
  }

  private save(): boolean {
    if (!this.storage) {
      return false;
    }
    return saveGame(this.storage, this.state, this.audio.isMuted());
  }

  private renderAndNotify(): void {
    if (this.ctx) {
      renderGameScene(this.ctx, this.state, WORLD_WIDTH, WORLD_HEIGHT, this.effects);
    }
    if (this.onStateChange) {
      this.onStateChange(this.getHudSnapshot());
    }
  }
}

/**
 * Factoría para crear una instancia de GameController con dependencias inyectadas.
 */
export function createGameController(
  deps: GameControllerDeps = {}
): GameController {
  return new GameController(deps);
}
