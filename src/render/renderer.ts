/**
 * Renderizador vectorial para Canvas 2D con soporte para devicePixelRatio.
 * Dibuja la escena de combate espacial basada fielmente en los diseños SVG del GDD:
 * siluetas detalladas para nave, asteroide, enemigo y jefe, 4 temas planetarios,
 * flota aliada en órbita y efectos de game feel (partículas, ondas de choque,
 * números flotantes, destello de impacto y sacudida de cámara).
 */

import type {
  AsteroidTarget,
  BossTarget,
  EnemyTarget,
  FleetCounts,
  GameState,
  PlanetId,
  Projectile,
  ShipState,
  Target,
  Vector2D,
} from '../engine/types';
import { ARENA_HEIGHT, ARENA_WIDTH, SHIP_POSITION } from '../engine/balance';
import { getFleetShipPosition } from '../engine/combat';

export const WORLD_WIDTH = ARENA_WIDTH;
export const WORLD_HEIGHT = ARENA_HEIGHT;

export const PALETTE = Object.freeze({
  spaceBackground: '#070b14',
  panelBackground: '#11182B',
  technicalBorder: '#263554',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  playerAndDrone: '#38BDF8',
  shield: '#22D3EE',
  asteroidRock: '#A88B68',
  mineralGold: '#F59E0B',
  enemy: '#FB7185',
  boss: '#EF4444',
  warning: '#FBBF24',
  positive: '#10B981',
});

export interface PlanetTheme {
  readonly background: string;
  readonly mineralPrimary: string;
  readonly mineralHighlight: string;
  readonly ambientAccent: string;
}

export const PLANET_THEMES: Readonly<Record<PlanetId, PlanetTheme>> = Object.freeze({
  1: Object.freeze({
    background: '#070b14',
    mineralPrimary: '#F59E0B',
    mineralHighlight: '#FBBF24',
    ambientAccent: '#F59E0B',
  }),
  2: Object.freeze({
    background: '#061224',
    mineralPrimary: '#38BDF8',
    mineralHighlight: '#7DD3FC',
    ambientAccent: '#1E3A8A',
  }),
  3: Object.freeze({
    background: '#120720',
    mineralPrimary: '#E879F9',
    mineralHighlight: '#F472B6',
    ambientAccent: '#A855F7',
  }),
  4: Object.freeze({
    background: '#17080a',
    mineralPrimary: '#FB923C',
    mineralHighlight: '#FDE047',
    ambientAccent: '#DC2626',
  }),
});

export interface CanvasLike {
  width: number;
  height: number;
}

export interface Canvas2DContextLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  font?: string;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;

  save(): void;
  restore(): void;
  setTransform?(a: number, b: number, c: number, d: number, e: number, f: number): void;
  scale?(x: number, y: number): void;
  translate?(x: number, y: number): void;
  rotate?(angle: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean
  ): void;
  fill(): void;
  stroke(): void;
  fillText?(text: string, x: number, y: number, maxWidth?: number): void;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  lineWidth: number;
  life: number;
  maxLife: number;
  alpha: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  alpha: number;
}

export class VisualEffectsState {
  readonly particles: Particle[] = [];
  readonly shockwaves: Shockwave[] = [];
  readonly floatingTexts: FloatingText[] = [];
  shakeTimer: number = 0;
  shakeIntensity: number = 0;

  addExplosion(x: number, y: number, color: string = '#F59E0B', count: number = 18): void {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 130;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() < 0.4 ? '#FBBF24' : color,
        size: 1.5 + Math.random() * 2.5,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.35,
        alpha: 1,
      });
    }
  }

  addShockwave(x: number, y: number, maxRadius: number = 42, color: string = '#22D3EE'): void {
    this.shockwaves.push({
      x,
      y,
      radius: 4,
      maxRadius,
      color,
      lineWidth: 2.5,
      life: 0,
      maxLife: 0.38,
      alpha: 1,
    });
  }

  addFloatingText(x: number, y: number, text: string, color: string = '#F1F5F9'): void {
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 14,
      y,
      vy: -32,
      text,
      color,
      life: 0,
      maxLife: 0.65,
      alpha: 1,
    });
  }

  addScreenShake(intensity: number = 5, duration: number = 0.22): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  update(dt: number): void {
    const safeDt = Math.max(0, dt);

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - safeDt);
      if (this.shakeTimer === 0) {
        this.shakeIntensity = 0;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life += safeDt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i -= 1) {
      const s = this.shockwaves[i];
      s.life += safeDt;
      if (s.life >= s.maxLife) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = s.life / s.maxLife;
      s.radius = 4 + (s.maxRadius - 4) * progress;
      s.alpha = Math.max(0, 1 - progress);
      s.lineWidth = Math.max(0.5, 2.5 * (1 - progress));
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i -= 1) {
      const t = this.floatingTexts[i];
      t.life += safeDt;
      if (t.life >= t.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      t.y += t.vy * safeDt;
      t.alpha = Math.max(0, 1 - t.life / t.maxLife);
    }
  }
}

interface Star {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly alpha: number;
}

function generateDeterministicStars(count: number, width: number, height: number): readonly Star[] {
  const stars: Star[] = [];
  let seed = 987654321;

  function nextRandom(): number {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: nextRandom() * width,
      y: nextRandom() * height,
      radius: nextRandom() < 0.75 ? 1 : 1.6,
      alpha: 0.25 + nextRandom() * 0.6,
    });
  }

  return Object.freeze(stars);
}

const DETERMINISTIC_STARS = generateDeterministicStars(60, WORLD_WIDTH, WORLD_HEIGHT);

/**
 * Rota un punto relativo matemáticamente alrededor de un origen.
 * Garantiza rotación idéntica en canvas reales y en entornos de test sin ctx.rotate.
 */
function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  cos: number,
  sin: number
): [number, number] {
  const dx = px - cx;
  const dy = py - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

export function syncCanvasSize(
  canvas: CanvasLike,
  ctx: Canvas2DContextLike,
  cssWidth: number,
  cssHeight: number,
  dpr: number = 1,
  worldWidth: number = WORLD_WIDTH,
  worldHeight: number = WORLD_HEIGHT
): { width: number; height: number; dpr: number; scaleX: number; scaleY: number } {
  const safeDpr = Math.max(1, dpr);
  const safeWidth = Math.max(1, cssWidth);
  const safeHeight = Math.max(1, cssHeight);
  const pixelWidth = Math.round(safeWidth * safeDpr);
  const pixelHeight = Math.round(safeHeight * safeDpr);

  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  const scaleX = (safeWidth / worldWidth) * safeDpr;
  const scaleY = (safeHeight / worldHeight) * safeDpr;

  if (typeof ctx.setTransform === 'function') {
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  } else if (typeof ctx.scale === 'function') {
    ctx.scale(scaleX, scaleY);
  }

  return {
    width: pixelWidth,
    height: pixelHeight,
    dpr: safeDpr,
    scaleX,
    scaleY,
  };
}

export function renderGameScene(
  ctx: Canvas2DContextLike,
  state: GameState,
  worldWidth: number = WORLD_WIDTH,
  worldHeight: number = WORLD_HEIGHT,
  effects?: VisualEffectsState
): void {
  ctx.save();

  // Sacudida de cámara si el temporizador de impacto está activo
  if (effects && effects.shakeTimer > 0 && typeof ctx.translate === 'function') {
    const factor = effects.shakeIntensity * (effects.shakeTimer / 0.22);
    const offsetX = Math.sin(state.tiempoJugadoSegundos * 95) * factor;
    const offsetY = Math.cos(state.tiempoJugadoSegundos * 80) * factor;
    ctx.translate(offsetX, offsetY);
  }

  drawSpaceBackground(ctx, worldWidth, worldHeight, state.planetActual, state.tiempoJugadoSegundos);
  drawAlliedFleet(ctx, state.fleet, state.tiempoJugadoSegundos);
  drawTargets(ctx, state.targets, state.planetActual);
  drawLockedReticle(ctx, state.targets, state.lockedTargetId);
  drawProjectiles(ctx, state.projectiles);
  drawPlayerAndDrone(
    ctx,
    state.ship,
    SHIP_POSITION,
    state.upgrades.supportDrone,
    state.tiempoJugadoSegundos,
    state.droneAngle,
    state.overdriveTimer
  );
  drawBossOverlay(ctx, state.targets, worldWidth);

  if (effects) {
    drawVisualEffects(ctx, effects);
  }

  ctx.restore();
}

function drawSpaceBackground(
  ctx: Canvas2DContextLike,
  width: number,
  height: number,
  planetId: PlanetId = 1,
  time: number = 0
): void {
  const theme = PLANET_THEMES[planetId] ?? PLANET_THEMES[1];

  // Fondo espacial adaptado al tema del planeta actual
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // Características temáticas sutiles de fondo (anillos / nebulosa / resplandor solar)
  ctx.save();
  if (planetId === 2) {
    // Órbita de Cobalto: anillos orbitales sutiles
    ctx.strokeStyle = theme.ambientAccent;
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.45, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.45, 260, 0, Math.PI * 2);
    ctx.stroke();
  } else if (planetId === 3) {
    // Nebulosa de Plasma: halos violeta y magenta difusos
    ctx.fillStyle = theme.ambientAccent;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(width * 0.35, height * 0.35, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E879F9';
    ctx.beginPath();
    ctx.arc(width * 0.65, height * 0.4, 110, 0, Math.PI * 2);
    ctx.fill();
  } else if (planetId === 4) {
    // Núcleo Estelar: resplandor solar radial sutil
    ctx.fillStyle = theme.ambientAccent;
    ctx.globalAlpha = 0.09;
    ctx.beginPath();
    ctx.arc(width * 0.5, -40, 280, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Estrellas deterministas con titileo tenue
  ctx.fillStyle = PALETTE.textPrimary;
  for (let i = 0; i < DETERMINISTIC_STARS.length; i += 1) {
    const star = DETERMINISTIC_STARS[i];
    const twinkle = 0.8 + 0.2 * Math.sin(time * 3 + i * 1.5);
    ctx.globalAlpha = star.alpha * twinkle;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}

function drawPlayerAndDrone(
  ctx: Canvas2DContextLike,
  ship: ShipState,
  pos: Vector2D,
  droneLevel: number,
  time: number,
  droneAngle?: number,
  overdriveTimer?: number
): void {
  ctx.save();

  const isOverdriven = (overdriveTimer ?? 0) > 0;

  // Aura dorada radiante si la sobremarcha táctica está activa
  if (isOverdriven) {
    ctx.save();
    const auraPulse = 30 + Math.sin(time * 18) * 3;
    ctx.strokeStyle = PALETTE.warning;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 14);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, auraPulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Propulsores animados (tres toberas con pluma sinusoide)
  ctx.fillStyle = isOverdriven ? PALETTE.warning : PALETTE.mineralGold;
  const plumeOffset = Math.sin(time * 26) * 3.5;

  // Pluma izquierda
  ctx.beginPath();
  ctx.moveTo(pos.x - 7, pos.y + 14);
  ctx.lineTo(pos.x - 5, pos.y + 22 + plumeOffset * 0.8);
  ctx.lineTo(pos.x - 3, pos.y + 14);
  ctx.closePath();
  ctx.fill();

  // Pluma central principal
  ctx.beginPath();
  ctx.moveTo(pos.x - 2.5, pos.y + 15);
  ctx.lineTo(pos.x, pos.y + 26 + plumeOffset);
  ctx.lineTo(pos.x + 2.5, pos.y + 15);
  ctx.closePath();
  ctx.fill();

  // Pluma derecha
  ctx.beginPath();
  ctx.moveTo(pos.x + 3, pos.y + 14);
  ctx.lineTo(pos.x + 5, pos.y + 22 + plumeOffset * 0.8);
  ctx.lineTo(pos.x + 7, pos.y + 14);
  ctx.closePath();
  ctx.fill();

  // Alas exteriores angulares fieles a nave.svg
  ctx.fillStyle = PALETTE.panelBackground;
  ctx.strokeStyle = isOverdriven ? PALETTE.warning : PALETTE.playerAndDrone;
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - 12);
  ctx.lineTo(pos.x - 20, pos.y + 8);
  ctx.lineTo(pos.x - 14, pos.y + 12);
  ctx.lineTo(pos.x - 7, pos.y + 5);
  ctx.lineTo(pos.x + 7, pos.y + 5);
  ctx.lineTo(pos.x + 14, pos.y + 12);
  ctx.lineTo(pos.x + 20, pos.y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cañones laterales y toberas
  ctx.strokeStyle = PALETTE.shield;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pos.x - 13, pos.y - 2);
  ctx.lineTo(pos.x - 13, pos.y + 9);
  ctx.moveTo(pos.x + 13, pos.y - 2);
  ctx.lineTo(pos.x + 13, pos.y + 9);
  ctx.stroke();

  // Fuselaje central angular
  ctx.fillStyle = '#0F172A';
  ctx.strokeStyle = isOverdriven ? PALETTE.warning : PALETTE.shield;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - 26);
  ctx.lineTo(pos.x + 7, pos.y - 4);
  ctx.lineTo(pos.x + 8, pos.y + 14);
  ctx.lineTo(pos.x - 8, pos.y + 14);
  ctx.lineTo(pos.x - 7, pos.y - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cabina cian angular
  ctx.fillStyle = isOverdriven ? '#FEF08A' : PALETTE.shield;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - 17);
  ctx.lineTo(pos.x - 3.5, pos.y - 7);
  ctx.lineTo(pos.x, pos.y - 3);
  ctx.lineTo(pos.x + 3.5, pos.y - 7);
  ctx.closePath();
  ctx.fill();

  // Escudo energético sutil con radio y opacidad proporcionales
  if (ship.currentShield > 0) {
    const shieldRatio = ship.maxShield > 0 ? ship.currentShield / ship.maxShield : 0;
    ctx.globalAlpha = 0.2 + 0.45 * shieldRatio;
    ctx.strokeStyle = PALETTE.shield;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 27, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // Indicadores de casco y escudo bajo la nave
  drawMiniBar(ctx, pos.x, pos.y + 28, 34, 3, ship.currentHull, ship.maxHull, PALETTE.positive);
  if (ship.maxShield > 0) {
    drawMiniBar(ctx, pos.x, pos.y + 33, 34, 2.5, ship.currentShield, ship.maxShield, PALETTE.shield);
  }

  // Dron de apoyo orbitando en state.droneAngle con silueta angular fiel al SVG
  if (droneLevel > 0) {
    const orbit = droneAngle !== undefined ? droneAngle : (time * 1.8) % (Math.PI * 2);
    const droneX = pos.x + Math.cos(orbit) * 40;
    const droneY = pos.y + Math.sin(orbit) * 40;

    // Órbita sutil
    ctx.strokeStyle = PALETTE.technicalBorder;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Cuerpo angular del dron
    ctx.fillStyle = PALETTE.panelBackground;
    ctx.strokeStyle = PALETTE.playerAndDrone;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(droneX, droneY - 7);
    ctx.lineTo(droneX + 6, droneY);
    ctx.lineTo(droneX + 3.5, droneY + 6);
    ctx.lineTo(droneX - 3.5, droneY + 6);
    ctx.lineTo(droneX - 6, droneY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Núcleo brillante y propulsor
    ctx.fillStyle = PALETTE.shield;
    ctx.beginPath();
    ctx.arc(droneX, droneY - 1, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.mineralGold;
    ctx.beginPath();
    ctx.moveTo(droneX - 1.5, droneY + 6);
    ctx.lineTo(droneX, droneY + 10 + Math.sin(time * 24) * 2);
    ctx.lineTo(droneX + 1.5, droneY + 6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawAlliedFleet(ctx: Canvas2DContextLike, fleet: FleetCounts | undefined, time: number): void {
  if (!fleet) {
    return;
  }

  const shipTypes: readonly ('interceptor' | 'corvette' | 'frigate')[] = [
    'interceptor',
    'corvette',
    'frigate',
  ];

  for (const type of shipTypes) {
    const count = fleet[type] ?? 0;
    for (let i = 0; i < count; i += 1) {
      const basePos = getFleetShipPosition(type, i, SHIP_POSITION);
      // Flotación táctica en formación
      const hoverY = Math.sin(time * 3 + i * 1.3) * 2.2;
      const x = basePos.x;
      const y = basePos.y + hoverY;

      ctx.save();
      if (type === 'interceptor') {
        // Caza interceptor ágil en flecha
        ctx.fillStyle = PALETTE.panelBackground;
        ctx.strokeStyle = PALETTE.playerAndDrone;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 6, y + 6);
        ctx.lineTo(x, y + 3);
        ctx.lineTo(x - 6, y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = PALETTE.shield;
        ctx.beginPath();
        ctx.arc(x, y - 1, 1.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 'corvette') {
        // Corbeta escolta estilizada con doble cañón
        ctx.fillStyle = PALETTE.panelBackground;
        ctx.strokeStyle = PALETTE.shield;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 10);
        ctx.lineTo(x + 3, y - 10);
        ctx.lineTo(x + 7, y + 7);
        ctx.lineTo(x + 2, y + 5);
        ctx.lineTo(x - 2, y + 5);
        ctx.lineTo(x - 7, y + 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = PALETTE.warning;
        ctx.beginPath();
        ctx.arc(x, y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Fragata pesada angular con torretas
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#818CF8';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x, y - 13);
        ctx.lineTo(x + 8, y - 4);
        ctx.lineTo(x + 9, y + 9);
        ctx.lineTo(x + 4, y + 11);
        ctx.lineTo(x - 4, y + 11);
        ctx.lineTo(x - 9, y + 9);
        ctx.lineTo(x - 8, y - 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = PALETTE.shield;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawTargets(
  ctx: Canvas2DContextLike,
  targets: readonly Target[],
  planetId: PlanetId = 1
): void {
  for (const target of targets) {
    if (target.currentHp <= 0) {
      continue;
    }

    switch (target.type) {
      case 'asteroid':
        drawAsteroid(ctx, target, planetId);
        break;
      case 'enemy':
        drawEnemy(ctx, target);
        break;
      case 'boss':
        drawBoss(ctx, target);
        break;
    }
  }
}

function drawAsteroid(
  ctx: Canvas2DContextLike,
  asteroid: AsteroidTarget,
  planetId: PlanetId = 1
): void {
  ctx.save();

  const theme = PLANET_THEMES[planetId] ?? PLANET_THEMES[1];
  const angle = asteroid.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = asteroid.x;
  const cy = asteroid.y;
  const scale = asteroid.radius / 76;

  // Facetas angulares del cuerpo principal basadas fielmente en asteroide.svg
  const rawPolygons = [
    {
      fill: '#A88B68',
      points: [
        [-6, -76],
        [48, -62],
        [16, -22],
        [-30, -34],
      ],
    },
    {
      fill: '#8D7456',
      points: [
        [48, -62],
        [78, -16],
        [34, 6],
        [16, -22],
      ],
    },
    {
      fill: '#9A8060',
      points: [
        [-44, -64],
        [-6, -76],
        [-30, -34],
        [-64, -24],
      ],
    },
    {
      fill: '#6E5B43',
      points: [
        [-76, -22],
        [-44, -64],
        [-64, -24],
        [-42, 16],
        [-72, 34],
      ],
    },
    {
      fill: '#7D674C',
      points: [
        [-30, -34],
        [16, -22],
        [6, 24],
        [-42, 16],
      ],
    },
    {
      fill: '#504130',
      points: [
        [16, -22],
        [34, 6],
        [68, 38],
        [26, 76],
        [6, 24],
      ],
    },
    {
      fill: '#433627',
      points: [
        [34, 6],
        [78, -16],
        [68, 38],
      ],
    },
    {
      fill: '#46392A',
      points: [
        [-42, 16],
        [6, 24],
        [26, 76],
        [-32, 72],
        [-72, 34],
      ],
    },
  ];

  ctx.lineWidth = 1.4;
  ctx.strokeStyle = PALETTE.asteroidRock;

  for (const facet of rawPolygons) {
    ctx.fillStyle = facet.fill;
    ctx.beginPath();
    for (let i = 0; i < facet.points.length; i += 1) {
      const pt = facet.points[i];
      const [rx, ry] = rotatePoint(cx + pt[0] * scale, cy + pt[1] * scale, cx, cy, cos, sin);
      if (i === 0) {
        ctx.moveTo(rx, ry);
      } else {
        ctx.lineTo(rx, ry);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Vetas minerales luminosas adaptadas al planeta actual
  ctx.strokeStyle = theme.mineralPrimary;
  ctx.lineWidth = 2.4;
  const vein1 = [
    [-24, -50],
    [-12, -24],
    [14, -18],
    [24, 12],
    [54, 26],
  ];
  ctx.beginPath();
  for (let i = 0; i < vein1.length; i += 1) {
    const pt = vein1[i];
    const [rx, ry] = rotatePoint(cx + pt[0] * scale, cy + pt[1] * scale, cx, cy, cos, sin);
    if (i === 0) {
      ctx.moveTo(rx, ry);
    } else {
      ctx.lineTo(rx, ry);
    }
  }
  ctx.stroke();

  const vein2 = [
    [-12, -24],
    [-34, 2],
    [-56, 14],
  ];
  ctx.beginPath();
  for (let i = 0; i < vein2.length; i += 1) {
    const pt = vein2[i];
    const [rx, ry] = rotatePoint(cx + pt[0] * scale, cy + pt[1] * scale, cx, cy, cos, sin);
    if (i === 0) {
      ctx.moveTo(rx, ry);
    } else {
      ctx.lineTo(rx, ry);
    }
  }
  ctx.stroke();

  // Nodos cristalinos de mineral brillante
  ctx.fillStyle = theme.mineralHighlight;
  const crystalNodes = [
    [14, -18],
    [-34, 2],
    [24, 12],
  ];
  for (const pt of crystalNodes) {
    const [rx, ry] = rotatePoint(cx + pt[0] * scale, cy + pt[1] * scale, cx, cy, cos, sin);
    ctx.beginPath();
    ctx.arc(rx, ry, Math.max(2, 3.5 * scale), 0, Math.PI * 2);
    ctx.fill();
  }

  // Destello blanco en impacto
  if ((asteroid.hitFlashTimer ?? 0) > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = Math.min(0.75, (asteroid.hitFlashTimer ?? 0) * 8);
    ctx.beginPath();
    ctx.arc(cx, cy, asteroid.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  drawMiniBar(
    ctx,
    asteroid.x,
    asteroid.y - asteroid.radius - 8,
    30,
    3,
    asteroid.currentHp,
    asteroid.maxHp,
    theme.mineralPrimary
  );

  ctx.restore();
}

function drawEnemy(ctx: Canvas2DContextLike, enemy: EnemyTarget): void {
  ctx.save();

  const cx = enemy.x;
  const cy = enemy.y;
  const scale = enemy.radius / 55;

  ctx.lineWidth = 1.6;

  // Pinzas exteriores agresivas fieles a enemigo.svg
  ctx.fillStyle = PALETTE.panelBackground;
  ctx.strokeStyle = PALETTE.enemy;

  // Pinza izquierda
  ctx.beginPath();
  ctx.moveTo(cx - 40 * scale, cy - 38 * scale);
  ctx.lineTo(cx - 70 * scale, cy + 12 * scale);
  ctx.lineTo(cx - 56 * scale, cy + 50 * scale);
  ctx.lineTo(cx - 34 * scale, cy + 16 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Pinza derecha
  ctx.beginPath();
  ctx.moveTo(cx + 40 * scale, cy - 38 * scale);
  ctx.lineTo(cx + 70 * scale, cy + 12 * scale);
  ctx.lineTo(cx + 56 * scale, cy + 50 * scale);
  ctx.lineTo(cx + 34 * scale, cy + 16 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Aletas traseras
  ctx.fillStyle = '#1A1222';
  ctx.beginPath();
  ctx.moveTo(cx - 34 * scale, cy - 48 * scale);
  ctx.lineTo(cx - 16 * scale, cy - 30 * scale);
  ctx.lineTo(cx - 26 * scale, cy - 2 * scale);
  ctx.lineTo(cx - 46 * scale, cy - 24 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + 34 * scale, cy - 48 * scale);
  ctx.lineTo(cx + 16 * scale, cy - 30 * scale);
  ctx.lineTo(cx + 26 * scale, cy - 2 * scale);
  ctx.lineTo(cx + 46 * scale, cy - 24 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Casco central agresivo apuntando hacia abajo
  ctx.fillStyle = PALETTE.panelBackground;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 58 * scale);
  ctx.lineTo(cx + 28 * scale, cy - 14 * scale);
  ctx.lineTo(cx + 18 * scale, cy + 38 * scale);
  ctx.lineTo(cx, cy + 56 * scale);
  ctx.lineTo(cx - 18 * scale, cy + 38 * scale);
  ctx.lineTo(cx - 28 * scale, cy - 14 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Núcleo brillante
  ctx.fillStyle = PALETTE.warning;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 16 * scale);
  ctx.lineTo(cx + 12 * scale, cy);
  ctx.lineTo(cx, cy + 18 * scale);
  ctx.lineTo(cx - 12 * scale, cy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.arc(cx, cy, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Destello blanco en impacto
  if ((enemy.hitFlashTimer ?? 0) > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = Math.min(0.75, (enemy.hitFlashTimer ?? 0) * 8);
    ctx.beginPath();
    ctx.arc(cx, cy, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  drawMiniBar(
    ctx,
    cx,
    cy - enemy.radius - 8,
    30,
    3,
    enemy.currentHp,
    enemy.maxHp,
    PALETTE.enemy
  );

  ctx.restore();
}

function drawBoss(ctx: Canvas2DContextLike, boss: BossTarget): void {
  ctx.save();

  const cx = boss.x;
  const cy = boss.y;
  const scale = boss.radius / 110;

  // Propulsores traseros del jefe con resplandor
  ctx.fillStyle = PALETTE.boss;
  ctx.fillRect(cx - 44 * scale, cy - 102 * scale, 16 * scale, 14 * scale);
  ctx.fillRect(cx + 28 * scale, cy - 102 * scale, 16 * scale, 14 * scale);
  ctx.fillStyle = PALETTE.warning;
  ctx.fillRect(cx - 10 * scale, cy - 106 * scale, 20 * scale, 18 * scale);

  // Alas pesadas laterales
  ctx.fillStyle = PALETTE.panelBackground;
  ctx.strokeStyle = PALETTE.boss;
  ctx.lineWidth = 2.2;

  // Ala izquierda
  ctx.beginPath();
  ctx.moveTo(cx - 72 * scale, cy - 56 * scale);
  ctx.lineTo(cx - 128 * scale, cy - 24 * scale);
  ctx.lineTo(cx - 134 * scale, cy + 30 * scale);
  ctx.lineTo(cx - 92 * scale, cy + 62 * scale);
  ctx.lineTo(cx - 54 * scale, cy + 34 * scale);
  ctx.lineTo(cx - 54 * scale, cy - 40 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Ala derecha
  ctx.beginPath();
  ctx.moveTo(cx + 72 * scale, cy - 56 * scale);
  ctx.lineTo(cx + 128 * scale, cy - 24 * scale);
  ctx.lineTo(cx + 134 * scale, cy + 30 * scale);
  ctx.lineTo(cx + 92 * scale, cy + 62 * scale);
  ctx.lineTo(cx + 54 * scale, cy + 34 * scale);
  ctx.lineTo(cx + 54 * scale, cy - 40 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Casco central segmentado
  ctx.beginPath();
  ctx.moveTo(cx, cy - 90 * scale);
  ctx.lineTo(cx + 54 * scale, cy - 58 * scale);
  ctx.lineTo(cx + 62 * scale, cy + 24 * scale);
  ctx.lineTo(cx + 28 * scale, cy + 92 * scale);
  ctx.lineTo(cx, cy + 106 * scale);
  ctx.lineTo(cx - 28 * scale, cy + 92 * scale);
  ctx.lineTo(cx - 62 * scale, cy + 24 * scale);
  ctx.lineTo(cx - 54 * scale, cy - 58 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Costillas y divisiones internas
  ctx.strokeStyle = PALETTE.technicalBorder;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - 52 * scale, cy - 30 * scale);
  ctx.lineTo(cx, cy - 50 * scale);
  ctx.lineTo(cx + 52 * scale, cy - 30 * scale);
  ctx.moveTo(cx - 58 * scale, cy + 20 * scale);
  ctx.lineTo(cx, cy + 44 * scale);
  ctx.lineTo(cx + 58 * scale, cy + 20 * scale);
  ctx.stroke();

  // 4 torretas simétricas con cañones dobles
  const turrets = [
    [-96 * scale, 0],
    [96 * scale, 0],
    [-38 * scale, 50 * scale],
    [38 * scale, 50 * scale],
  ];
  ctx.strokeStyle = PALETTE.boss;
  ctx.lineWidth = 2.4;
  for (const [tx, ty] of turrets) {
    ctx.fillStyle = PALETTE.panelBackground;
    ctx.beginPath();
    ctx.arc(cx + tx, cy + ty, 9 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cañones apuntando hacia abajo
    ctx.beginPath();
    ctx.moveTo(cx + tx - 3.5 * scale, cy + ty + 8 * scale);
    ctx.lineTo(cx + tx - 3.5 * scale, cy + ty + 20 * scale);
    ctx.moveTo(cx + tx + 3.5 * scale, cy + ty + 8 * scale);
    ctx.lineTo(cx + tx + 3.5 * scale, cy + ty + 20 * scale);
    ctx.stroke();
  }

  // Núcleo central de energía
  ctx.fillStyle = PALETTE.boss;
  ctx.beginPath();
  ctx.arc(cx, cy, 26 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE.warning;
  ctx.beginPath();
  ctx.arc(cx, cy, 18 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F1F5F9';
  ctx.beginPath();
  ctx.arc(cx, cy, 7 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Destello blanco en impacto
  if ((boss.hitFlashTimer ?? 0) > 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = Math.min(0.75, (boss.hitFlashTimer ?? 0) * 8);
    ctx.beginPath();
    ctx.arc(cx, cy, boss.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  ctx.restore();
}

function drawBossOverlay(ctx: Canvas2DContextLike, targets: readonly Target[], worldWidth: number): void {
  const boss = targets.find((t): t is BossTarget => t.type === 'boss' && t.currentHp > 0);
  if (!boss) {
    return;
  }

  const barWidth = 320;
  const barHeight = 12;
  const barX = (worldWidth - barWidth) / 2;
  const barY = 22;

  ctx.save();

  ctx.fillStyle = PALETTE.panelBackground;
  ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

  const hpRatio = boss.maxHp > 0 ? Math.max(0, boss.currentHp / boss.maxHp) : 0;
  ctx.fillStyle = PALETTE.boss;
  ctx.fillRect(barX, barY, Math.round(barWidth * hpRatio), barHeight);

  if (typeof ctx.fillText === 'function') {
    ctx.fillStyle = PALETTE.textPrimary;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${boss.name} - ${boss.currentHp} / ${boss.maxHp} PV`, worldWidth / 2, barY - 4);
  }

  ctx.restore();
}

function drawLockedReticle(
  ctx: Canvas2DContextLike,
  targets: readonly Target[],
  lockedTargetId: string | null
): void {
  if (!lockedTargetId) {
    return;
  }

  const target = targets.find((t) => t.id === lockedTargetId && t.currentHp > 0);
  if (!target) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = PALETTE.shield;
  ctx.lineWidth = 2;

  const ringRadius = target.radius + 8;
  const quarter = Math.PI / 4;

  for (let i = 0; i < 4; i += 1) {
    const centerAngle = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, ringRadius, centerAngle - quarter * 0.5, centerAngle + quarter * 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function drawProjectiles(ctx: Canvas2DContextLike, projectiles: readonly Projectile[]): void {
  for (const proj of projectiles) {
    const isAlly = proj.shooter === 'player' || proj.shooter === 'drone' || proj.shooter === 'fleet';
    ctx.fillStyle = isAlly ? PALETTE.playerAndDrone : PALETTE.enemy;

    ctx.beginPath();
    ctx.arc(proj.x, proj.y, isAlly ? 3 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVisualEffects(ctx: Canvas2DContextLike, effects: VisualEffectsState): void {
  // Partículas y fragmentos de explosión
  for (const p of effects.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Ondas de choque expansivas
  for (const s of effects.shockwaves) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.alpha);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.lineWidth;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Números flotantes de daño y créditos
  if (typeof ctx.fillText === 'function') {
    for (const t of effects.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, t.alpha);
      ctx.fillStyle = t.color;
      ctx.font = 'bold 12px sans-serif';
      if (ctx.textAlign) {
        ctx.textAlign = 'center';
      }
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }
}

function drawMiniBar(
  ctx: Canvas2DContextLike,
  centerX: number,
  y: number,
  width: number,
  height: number,
  current: number,
  max: number,
  fillColor: string
): void {
  const left = centerX - width / 2;
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;

  ctx.fillStyle = PALETTE.technicalBorder;
  ctx.fillRect(left, y, width, height);

  ctx.fillStyle = fillColor;
  ctx.fillRect(left, y, Math.round(width * ratio), height);
}
