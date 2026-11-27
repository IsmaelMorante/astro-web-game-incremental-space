import { describe, expect, it } from 'vitest';
import {
  createSynthAudio,
  defaultAudioContextFactory,
  mapEventToSound,
  SynthAudio,
  type AudioContextFactory,
  type AudioContextLike,
  type AudioNodeLike,
  type AudioParamLike,
  type GainNodeLike,
  type OscillatorNodeLike,
  type SoundKind,
} from '../synthAudio';
import type { SimulationEvent } from '../../engine/types';

class MockAudioParam implements AudioParamLike {
  value = 0;
  readonly setCalls: Array<{ value: number; time: number }> = [];
  readonly linearCalls: Array<{ value: number; time: number }> = [];
  readonly expCalls: Array<{ value: number; time: number }> = [];

  setValueAtTime(value: number, startTime: number): void {
    this.value = value;
    this.setCalls.push({ value, time: startTime });
  }

  linearRampToValueAtTime(value: number, endTime: number): void {
    this.value = value;
    this.linearCalls.push({ value, time: endTime });
  }

  exponentialRampToValueAtTime(value: number, endTime: number): void {
    this.value = value;
    this.expCalls.push({ value, time: endTime });
  }
}

class MockNode implements AudioNodeLike {
  readonly connections: AudioNodeLike[] = [];

  connect(destination: AudioNodeLike): AudioNodeLike {
    this.connections.push(destination);
    return destination;
  }
}

class MockGainNode extends MockNode implements GainNodeLike {
  readonly gain = new MockAudioParam();
}

class MockOscillatorNode extends MockNode implements OscillatorNodeLike {
  type: OscillatorType = 'sine';
  readonly frequency = new MockAudioParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  start(when = 0): void {
    this.startedAt = when;
  }

  stop(when = 0): void {
    this.stoppedAt = when;
  }
}

class MockAudioContext implements AudioContextLike {
  currentTime = 5.0;
  state: AudioContextState = 'suspended';
  readonly destination = new MockNode();
  readonly oscillators: MockOscillatorNode[] = [];
  readonly gains: MockGainNode[] = [];
  resumeCalls = 0;

  createOscillator(): MockOscillatorNode {
    const osc = new MockOscillatorNode();
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): MockGainNode {
    const gain = new MockGainNode();
    this.gains.push(gain);
    return gain;
  }

  async resume(): Promise<void> {
    this.resumeCalls += 1;
    this.state = 'running';
  }
}

describe('SynthAudio - R10: sintetizador Web Audio procedural y silencio', () => {
  it('R10: permanece en silencio y no instancia osciladores antes de unlock()', () => {
    let factoryCalled = false;
    const factory: AudioContextFactory = () => {
      factoryCalled = true;
      return new MockAudioContext();
    };

    const synth = new SynthAudio(factory);

    expect(synth.isUnlocked()).toBe(false);
    expect(synth.isMuted()).toBe(false);

    // Intentos de reproducción antes de desbloqueo no deben invocar la factoría ni crear sonido
    synth.playSound('shoot');
    synth.playForEvent({
      type: 'shoot',
      shooter: 'player',
      origin: { x: 450, y: 300 },
    });

    expect(factoryCalled).toBe(false);
    expect(synth.isUnlocked()).toBe(false);
  });

  it('R10: unlock() inicializa el AudioContext inyectado y lo reanuda si estaba suspendido', async () => {
    const mockCtx = new MockAudioContext();
    expect(mockCtx.state).toBe('suspended');

    let factoryCallCount = 0;
    const factory: AudioContextFactory = () => {
      factoryCallCount += 1;
      return mockCtx;
    };

    const synth = createSynthAudio(factory);
    const unlockedFirst = await synth.unlock();

    expect(unlockedFirst).toBe(true);
    expect(synth.isUnlocked()).toBe(true);
    expect(factoryCallCount).toBe(1);
    expect(mockCtx.resumeCalls).toBe(1);
    expect(mockCtx.state).toBe('running');

    // Desbloqueo sucesivo reutiliza el contexto sin volver a llamar a la factoría
    const unlockedSecond = await synth.unlock();
    expect(unlockedSecond).toBe(true);
    expect(factoryCallCount).toBe(1);
  });

  it('R10: unlock() devuelve false y no propaga excepciones ante fallos de la factoría', async () => {
    const failingFactory: AudioContextFactory = () => {
      throw new Error('AudioContext bloqueado por política de permisos');
    };

    const nullFactory: AudioContextFactory = () => null;

    const synthFailing = new SynthAudio(failingFactory);
    const resultFailing = await synthFailing.unlock();
    expect(resultFailing).toBe(false);
    expect(synthFailing.isUnlocked()).toBe(false);

    const synthNull = new SynthAudio(nullFactory);
    const resultNull = await synthNull.unlock();
    expect(resultNull).toBe(false);
    expect(synthNull.isUnlocked()).toBe(false);
  });

  it('R10: reproduce cada uno de los 7 tipos de sonido sintético con sus osciladores y envolventes', async () => {
    const mockCtx = new MockAudioContext();
    const synth = new SynthAudio(() => mockCtx);
    await synth.unlock();

    const sounds: SoundKind[] = [
      'shoot',
      'target_destroyed',
      'cargo_sold',
      'upgrade_purchased',
      'boss_spawned',
      'player_defeated',
      'victory',
    ];

    for (const [index, sound] of sounds.entries()) {
      mockCtx.currentTime = 10.0 + index * 5.0;
      synth.playSound(sound);

      expect(mockCtx.oscillators.length).toBe(index + 1);
      expect(mockCtx.gains.length).toBe(index + 1);

      const osc = mockCtx.oscillators[index];
      const gain = mockCtx.gains[index];

      // El oscilador se conecta a la ganancia y la ganancia a destination
      expect(osc.connections).toContain(gain);
      expect(gain.connections).toContain(mockCtx.destination);
      expect(osc.startedAt).toBe(mockCtx.currentTime);
      expect(osc.stoppedAt).toBeGreaterThan(mockCtx.currentTime);

      // Verificación de formas de onda específicas por sonido
      if (sound === 'shoot' || sound === 'boss_spawned' || sound === 'player_defeated') {
        expect(osc.type).toBe('sawtooth');
      } else if (sound === 'target_destroyed' || sound === 'upgrade_purchased') {
        expect(osc.type).toBe('triangle');
      } else if (sound === 'cargo_sold' || sound === 'victory') {
        expect(osc.type).toBe('sine');
      }
    }
  });

  it('R10: mapEventToSound y playForEvent mapean correctamente los eventos de simulación', async () => {
    const mockCtx = new MockAudioContext();
    const synth = new SynthAudio(() => mockCtx);
    await synth.unlock();

    const testMappings: Array<{ event: SimulationEvent; expectedSound: SoundKind }> = [
      {
        event: {
          type: 'shoot',
          shooter: 'player',
          origin: { x: 450, y: 300 },
        },
        expectedSound: 'shoot',
      },
      {
        event: {
          type: 'target_destroyed',
          targetId: 't1',
          targetType: 'asteroid',
          rewardCredits: 5,
          wasCargoCollected: true,
        },
        expectedSound: 'target_destroyed',
      },
      {
        event: { type: 'cargo_sold', unitsSold: 5, creditsEarned: 50 },
        expectedSound: 'cargo_sold',
      },
      {
        event: {
          type: 'upgrade_purchased',
          upgradeKey: 'cannonDamage',
          newLevel: 2,
          cost: 100,
        },
        expectedSound: 'upgrade_purchased',
      },
      {
        event: { type: 'boss_spawned', bossName: 'Centinela', planetId: 1 },
        expectedSound: 'boss_spawned',
      },
      { event: { type: 'player_defeated', planetId: 1 }, expectedSound: 'player_defeated' },
      {
        event: {
          type: 'victory',
          totalTimeSeconds: 600,
          stats: {
            targetsDestroyed: 60,
            bossesDefeated: 4,
            totalCreditsEarned: 1000,
          },
        },
        expectedSound: 'victory',
      },
    ];

    let expectedOscCount = 0;
    for (const { event, expectedSound } of testMappings) {
      expect(mapEventToSound(event)).toBe(expectedSound);
      synth.playForEvent(event);
      expectedOscCount += 1;
      expect(mockCtx.oscillators.length).toBe(expectedOscCount);
    }

    // Eventos no mapeados no deben disparar sonido
    const unknownEvent = { type: 'otro_evento_inexistente' } as unknown as SimulationEvent;
    expect(mapEventToSound(unknownEvent)).toBeNull();
    synth.playForEvent(unknownEvent);
    expect(mockCtx.oscillators.length).toBe(expectedOscCount);
  });

  it('R10: setMuted y toggleMute silencian e impiden crear osciladores en playSound', async () => {
    const mockCtx = new MockAudioContext();
    const synth = new SynthAudio(() => mockCtx, true); // Inicia silenciado
    await synth.unlock();

    expect(synth.isMuted()).toBe(true);

    // Con mute activo, playSound no crea osciladores
    synth.playSound('shoot');
    expect(mockCtx.oscillators.length).toBe(0);

    // toggleMute activa sonido
    const unmuted = synth.toggleMute();
    expect(unmuted).toBe(false);
    expect(synth.isMuted()).toBe(false);

    synth.playSound('shoot');
    expect(mockCtx.oscillators.length).toBe(1);

    // setMuted(true) vuelve a silenciar
    synth.setMuted(true);
    expect(synth.isMuted()).toBe(true);
    synth.playSound('shoot');
    expect(mockCtx.oscillators.length).toBe(1); // No incrementa
  });

  it('R10: captura fallos inesperados de Web Audio en playSound sin lanzar error', async () => {
    const mockCtx = new MockAudioContext();
    const synth = new SynthAudio(() => mockCtx);
    await synth.unlock();

    // Simular error al crear oscilador
    mockCtx.createOscillator = () => {
      throw new Error('Fallo interno de Web Audio');
    };

    expect(() => synth.playSound('shoot')).not.toThrow();
  });

  it('R10: defaultAudioContextFactory devuelve null en entorno Node / Vitest sin window', () => {
    const context = defaultAudioContextFactory();
    expect(context).toBeNull();
  });
});
