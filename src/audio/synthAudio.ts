/**
 * Sintetizador de audio procedural mediante la API Web Audio.
 * No utiliza activos externos y permite inyección de AudioContext para pruebas sin navegador.
 */

import type { SimulationEvent } from '../engine/types';

export type SoundKind =
  | 'shoot'
  | 'target_destroyed'
  | 'cargo_sold'
  | 'upgrade_purchased'
  | 'boss_spawned'
  | 'player_defeated'
  | 'victory';

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, startTime: number): void;
  linearRampToValueAtTime(value: number, endTime: number): void;
  exponentialRampToValueAtTime(value: number, endTime: number): void;
}

export interface AudioNodeLike {
  connect(destination: AudioNodeLike): AudioNodeLike;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: AudioContextState;
  readonly destination: AudioNodeLike;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  resume(): Promise<void>;
  close?(): Promise<void>;
}

export type AudioContextFactory = () => AudioContextLike | null;

/**
 * Factoría por defecto para entorno de navegador.
 */
export function defaultAudioContextFactory(): AudioContextLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Comprobación de compatibilidad con AudioContext estándar o prefijo WebKit
  const windowWithAudio = window as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };

  const ContextConstructor = windowWithAudio.AudioContext ?? windowWithAudio.webkitAudioContext;
  if (!ContextConstructor) {
    return null;
  }

  return new ContextConstructor();
}

/**
 * Traduce eventos de simulación a tipos de sonido procedurales.
 */
export function mapEventToSound(event: SimulationEvent): SoundKind | null {
  switch (event.type) {
    case 'shoot':
      return 'shoot';
    case 'target_destroyed':
      return 'target_destroyed';
    case 'cargo_sold':
      return 'cargo_sold';
    case 'upgrade_purchased':
      return 'upgrade_purchased';
    case 'boss_spawned':
      return 'boss_spawned';
    case 'player_defeated':
      return 'player_defeated';
    case 'victory':
      return 'victory';
    default:
      return null;
  }
}

export class SynthAudio {
  private unlocked: boolean = false;
  private muted: boolean;
  private ctx: AudioContextLike | null = null;
  private readonly factory: AudioContextFactory;

  constructor(
    factory: AudioContextFactory = defaultAudioContextFactory,
    initialMuted: boolean = false
  ) {
    this.factory = factory;
    this.muted = initialMuted;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Desbloquea el contexto de audio tras el primer gesto del usuario.
   */
  async unlock(): Promise<boolean> {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') {
        try {
          await this.ctx.resume();
        } catch {
          // El navegador mantiene suspendido el contexto si no hubo gesto válido
        }
      }
      return true;
    }

    try {
      const created = this.factory();
      if (!created) {
        return false;
      }

      this.ctx = created;
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.unlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reproduce un sonido procedural si el audio no está silenciado ni bloqueado.
   * Si está silenciado o no desbloqueado, no instancia ningún oscilador.
   */
  playSound(kind: SoundKind): void {
    if (this.muted || !this.unlocked || !this.ctx) {
      return;
    }

    try {
      this.synthesizeTone(this.ctx, kind);
    } catch {
      // Evita interrupciones en el bucle principal si falla una llamada de Web Audio
    }
  }

  /**
   * Reproduce el sonido correspondiente a un evento de simulación si aplica.
   */
  playForEvent(event: SimulationEvent): void {
    const sound = mapEventToSound(event);
    if (sound) {
      this.playSound(sound);
    }
  }

  /**
   * Genera los tonos sintéticos usando osciladores y curvas de ganancia.
   */
  private synthesizeTone(ctx: AudioContextLike, kind: SoundKind): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;

    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (kind) {
      case 'shoot': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(540, t);
        osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        osc.start(t);
        osc.stop(t + 0.08);
        break;
      }
      case 'target_destroyed': {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.18);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      }
      case 'cargo_sold': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.setValueAtTime(659.25, t + 0.07);
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        osc.start(t);
        osc.stop(t + 0.18);
        break;
      }
      case 'upgrade_purchased': {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(554.37, t + 0.06);
        osc.frequency.setValueAtTime(659.25, t + 0.13);
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.start(t);
        osc.stop(t + 0.24);
        break;
      }
      case 'boss_spawned': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.linearRampToValueAtTime(120, t + 0.18);
        osc.frequency.linearRampToValueAtTime(75, t + 0.38);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        osc.start(t);
        osc.stop(t + 0.42);
        break;
      }
      case 'player_defeated': {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.32);
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.start(t);
        osc.stop(t + 0.32);
        break;
      }
      case 'victory': {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, t);
        osc.frequency.setValueAtTime(659.25, t + 0.1);
        osc.frequency.setValueAtTime(783.99, t + 0.2);
        osc.frequency.setValueAtTime(1046.5, t + 0.32);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
        osc.start(t);
        osc.stop(t + 0.55);
        break;
      }
    }
  }
}

/**
 * Crea una nueva instancia del sintetizador de audio.
 */
export function createSynthAudio(
  factory?: AudioContextFactory,
  initialMuted?: boolean
): SynthAudio {
  return new SynthAudio(factory, initialMuted);
}
