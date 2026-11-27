import { formatCredits, formatInt } from './formulas';
import { PALETTE, type FloatingText, type Particle, type Shockwave } from './types';

const MAX_PARTICLES = 360;
const MAX_SHOCKWAVES = 28;
const MAX_FLOATING_TEXTS = 64;

export class ParticleManager {
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingTexts: FloatingText[] = [];

  clear(): void {
    this.particles.length = 0;
    this.shockwaves.length = 0;
    this.floatingTexts.length = 0;
  }

  private pushParticle(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  emitParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    speedMax = 150,
    shape: 'circle' | 'shard' = 'circle',
    minSize = 1.5,
    sizeSpan = 2.5
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 28 + Math.random() * speedMax;
      const maxLife = 0.25 + Math.random() * 0.42;
      this.pushParticle({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: minSize + Math.random() * sizeSpan,
        color,
        alpha: 1,
        life: maxLife,
        maxLife,
        shape,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12,
      });
    }
  }

  emitShockwave(
    x: number,
    y: number,
    maxRadius: number,
    color: string,
    lineWidth = 2.5,
    duration = 0.38
  ): void {
    if (this.shockwaves.length >= MAX_SHOCKWAVES) {
      this.shockwaves.shift();
    }
    this.shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius,
      color,
      lineWidth,
      life: duration,
      maxLife: duration,
    });
  }

  emitHitSparks(x: number, y: number, color: string, isCrit = false): void {
    // Sparks
    this.emitParticles(x, y, isCrit ? PALETTE.warning : color, isCrit ? 8 : 5, isCrit ? 145 : 95, 'circle', 1.4, 2.0);
    // Tiny white impact core flash
    this.pushParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      radius: isCrit ? 9 : 6,
      color: '#FFFFFF',
      alpha: 0.9,
      life: 0.08,
      maxLife: 0.08,
      shape: 'circle',
    });
  }

  emitAsteroidExplosion(x: number, y: number, rockColor: string, veinColor: string): void {
    // Expanding dust & mineral shockwave
    this.emitShockwave(x, y, 52, veinColor, 2.2, 0.34);
    // Core white flash
    this.pushParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 18,
      color: '#FFFFFF',
      alpha: 0.95,
      life: 0.11,
      maxLife: 0.11,
      shape: 'circle',
    });
    // Polygonal rock fragments
    this.emitParticles(x, y, rockColor, 12, 145, 'shard', 3.0, 3.8);
    // Golden/mineral ore shards & bright sparks
    this.emitParticles(x, y, veinColor, 10, 175, 'circle', 1.6, 2.4);
  }

  emitEnemyExplosion(x: number, y: number, accentColor: string): void {
    // Dual expanding plasma rings
    this.emitShockwave(x, y, 62, accentColor, 2.6, 0.36);
    this.emitShockwave(x, y, 36, '#FFFFFF', 1.6, 0.22);
    // Core flash
    this.pushParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 22,
      color: '#FFFFFF',
      alpha: 1,
      life: 0.13,
      maxLife: 0.13,
      shape: 'circle',
    });
    // Hull shards & fiery sparks
    this.emitParticles(x, y, accentColor, 15, 170, 'shard', 3.0, 3.5);
    this.emitParticles(x, y, PALETTE.warning, 12, 195, 'circle', 1.8, 2.5);
  }

  emitBossExplosion(x: number, y: number, bossColor: string): void {
    this.emitShockwave(x, y, 138, bossColor, 4.0, 0.55);
    this.emitShockwave(x, y, 90, PALETTE.warning, 2.8, 0.42);
    this.pushParticle({
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 42,
      color: '#FFFFFF',
      alpha: 1,
      life: 0.18,
      maxLife: 0.18,
      shape: 'circle',
    });
    this.emitParticles(x, y, bossColor, 34, 240, 'shard', 3.5, 4.5);
    this.emitParticles(x, y, PALETTE.warning, 24, 260, 'circle', 2.0, 3.0);
    this.emitParticles(x, y, '#FFFFFF', 14, 180, 'circle', 1.8, 2.2);
  }

  private lastNormalDmgTextAt = 0;

  emitFloatingText(x: number, y: number, text: string, color: string, scale = 1): void {
    if (this.floatingTexts.length >= MAX_FLOATING_TEXTS) {
      this.floatingTexts.shift();
    }
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 6,
      vy: -42,
      text,
      color,
      scale,
      life: 0.85,
      maxLife: 0.85,
    });
  }

  emitDamageNumber(x: number, y: number, damage: number, isCrit = false): void {
    if (!isCrit) {
      const now = performance.now();
      if (now - this.lastNormalDmgTextAt < 140) return;
      this.lastNormalDmgTextAt = now;
    }
    this.emitFloatingText(
      x,
      y - 10,
      isCrit ? `¡${formatInt(damage)}!` : `${formatInt(damage)}`,
      isCrit ? PALETTE.warning : '#CBD5E1',
      isCrit ? 1.18 : 0.86
    );
  }

  emitCreditGain(x: number, y: number, credits: number): void {
    this.emitFloatingText(x, y - 14, `+${formatCredits(credits)}`, PALETTE.positive, 1.12);
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      if (pt.rotation !== undefined && pt.rotSpeed !== undefined) {
        pt.rotation += pt.rotSpeed * dt;
      }
      pt.life -= dt;
      pt.alpha = Math.max(0, pt.life / pt.maxLife);
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      const progress = 1 - Math.max(0, sw.life / sw.maxLife);
      sw.radius = 8 + (sw.maxRadius - 8) * (1 - Math.pow(1 - progress, 2));
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.vy *= 0.97;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  renderShockwaves(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.globalAlpha = alpha * 0.45;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = sw.lineWidth * 2.4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, sw.lineWidth * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderParticles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = pt.alpha;
      if (pt.shape === 'shard') {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation || 0);
        ctx.strokeStyle = pt.color;
        ctx.fillStyle = pt.color;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pt.radius * 1.15, 0);
        ctx.lineTo(-pt.radius * 0.75, -pt.radius * 0.65);
        ctx.lineTo(-pt.radius * 0.45, pt.radius * 0.75);
        ctx.closePath();
        ctx.globalAlpha = pt.alpha * 0.35;
        ctx.fill();
        ctx.globalAlpha = pt.alpha;
        ctx.stroke();
      } else {
        const spd = Math.hypot(pt.vx, pt.vy);
        if (spd > 35) {
          ctx.strokeStyle = pt.color;
          ctx.lineWidth = Math.max(1.2, pt.radius * 0.85);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x - pt.vx * 0.045, pt.y - pt.vy * 0.045);
          ctx.stroke();
        }
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ft.life / ft.maxLife) * 1.35);
      ctx.font = `700 ${Math.round(12 * ft.scale)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(3, 5, 8, 0.94)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}
