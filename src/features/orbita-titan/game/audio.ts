const PENTATONIC_FREQS = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66,// D6
  1318.51,// E6
  1567.98,// G6
  1760.0, // A6
];

class SpaceAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private lastShootAt = 0;
  private lastHitAt = 0;
  private lastOrbAt = 0;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  unlockFromUserGesture(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-16, ctx.currentTime);
        compressor.knee.setValueAtTime(12, ctx.currentTime);
        compressor.ratio.setValueAtTime(6, ctx.currentTime);
        compressor.attack.setValueAtTime(0.004, ctx.currentTime);
        compressor.release.setValueAtTime(0.14, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.9, ctx.currentTime);
        gain.connect(compressor);
        compressor.connect(ctx.destination);

        this.ctx = ctx;
        this.masterGain = gain;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private getReadyOutput(): { ctx: AudioContext; out: AudioNode } | null {
    if (this.muted || !this.ctx || !this.masterGain) return null;
    if (this.ctx.state === 'suspended') return null;
    return { ctx: this.ctx, out: this.masterGain };
  }

  playShoot(isDrone = false): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const minInterval = isDrone ? 0.09 : 0.065;
    if (now - this.lastShootAt < minInterval) return;
    this.lastShootAt = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isDrone ? 'triangle' : 'sine';
    const startFreq = isDrone ? 740 : 540;
    const endFreq = isDrone ? 340 : 210;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.06);

    gain.gain.setValueAtTime(isDrone ? 0.022 : 0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playManualPulse(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.1);

    gain.gain.setValueAtTime(0.052, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.115);
  }

  playLaserBeam(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.17);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playHit(isCrit = false): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    if (now - this.lastHitAt < (isCrit ? 0.035 : 0.06)) return;
    this.lastHitAt = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCrit ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 320 : 185, now);
    osc.frequency.exponentialRampToValueAtTime(isCrit ? 120 : 85, now + 0.055);

    gain.gain.setValueAtTime(isCrit ? 0.036 : 0.022, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playDestroy(isEnemyOrBoss = false): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isEnemyOrBoss ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isEnemyOrBoss ? 220 : 165, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.18);

    gain.gain.setValueAtTime(isEnemyOrBoss ? 0.065 : 0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playOrbCollect(comboStep: number, isCore = false): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    if (!isCore && now - this.lastOrbAt < 0.045) return;
    this.lastOrbAt = now;

    const clampedIndex = Math.max(0, Math.min(PENTATONIC_FREQS.length - 1, comboStep));
    const baseFreq = PENTATONIC_FREQS[clampedIndex];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCore ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * (isCore ? 1.5 : 1.12), now + 0.09);

    gain.gain.setValueAtTime(isCore ? 0.07 : 0.042, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isCore ? 0.18 : 0.1));

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + (isCore ? 0.19 : 0.11));
  }

  playRankUp(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const start = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.07, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  playPrestige(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const notes = [261.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const start = now + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.075, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.44);
    });
  }

  playEmp(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.42);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  playDeflectorPulse(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.14);

    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playContractComplete(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const notes = [587.33, 783.99, 1174.66];
    notes.forEach((freq, i) => {
      const start = now + i * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.065, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.23);
    });
  }

  playPlayerHit(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playSell(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const start = now + i * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  playUpgrade(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const notes = [392.0, 523.25, 659.25];
    notes.forEach((freq, i) => {
      const start = now + i * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.13);
    });
  }

  playMilestone(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const start = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.075, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  playBossAlert(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    [0, 0.22].forEach((offset) => {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(196, start);
      osc.frequency.linearRampToValueAtTime(146.83, start + 0.18);
      gain.gain.setValueAtTime(0.075, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  playVictory(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, i) => {
      const start = now + i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.07, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.46);
    });
  }

  playEventStart(isInterference = false): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const notes = isInterference ? [659.25, 493.88, 659.25] : [440, 659.25, 880];
    notes.forEach((freq, i) => {
      const start = now + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isInterference ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  playBossPhase2(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    [220, 311.13, 440].forEach((freq, i) => {
      const start = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, start + 0.14);
      gain.gain.setValueAtTime(0.065, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  playDeflectorCounter(): void {
    const ready = this.getReadyOutput();
    if (!ready) return;
    const { ctx, out } = ready;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.13);
  }
}

export const spaceAudio = new SpaceAudioEngine();
