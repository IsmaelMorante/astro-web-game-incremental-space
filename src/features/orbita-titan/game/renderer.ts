import type { FleetUnitState, MeteorStreak, WarpNode } from './entities';
import { formatInt } from './formulas';
import { ParticleManager } from './particles';
import {
  DEFLECTOR_PULSE_RADIUS,
  FLEET_DEFINITIONS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  PALETTE,
  PLANETS,
  RANDOM_EVENT_DEFINITIONS,
  SHIP_X,
  SHIP_Y,
  STANCE_DEFINITIONS,
  type AmbientMote,
  type CombatTarget,
  type LaserBeam,
  type LootOrb,
  type MejorasState,
  type PlanetId,
  type Projectile,
  type RandomEventKey,
  type ShipStance,
  type ShipStats,
  type Star,
  type TechNodeKey,
} from './types';

export interface RenderFrameState {
  planetaActual: PlanetId;
  objetivosPorPlaneta: Record<PlanetId, number>;
  anomaliaActiva: boolean;
  oleadaAnomalia: number;
  anomalyWaveKills: number;
  stars: Star[];
  ambientMotes: AmbientMote[];
  warpGrid: WarpNode[];
  meteorStreaks: MeteorStreak[];
  activeEvent: { key: RandomEventKey; remainingSec: number; durationSec: number } | null;
  visualTime: number;
  shakeIntensity: number;
  orbs: LootOrb[];
  targets: CombatTarget[];
  beams: LaserBeam[];
  projectiles: Projectile[];
  particleManager: ParticleManager;
  shipAngle: number;
  shipHitFlash: number;
  sobrecargaTimer: number;
  escudoActual: number;
  cascoActual: number;
  stats: ShipStats;
  mejoras: MejorasState;
  tecnologia: Record<TechNodeKey, boolean>;
  postura: ShipStance;
  deflectorCooldown: number;
  deflectorMaxCooldown: number;
  droneOrbitAngle: number;
  fleetUnits: FleetUnitState[];
  activeTarget: CombatTarget | null;
  lockedTargetId: number | null;
  pointerLogicalX: number | null;
  pointerLogicalY: number | null;
  orbCombo: number;
  orbComboTimer: number;
  bodegaLlenaAviso: boolean;
  alertaTexto: string | null;
  sectorTransitionFlash: number;
  sectorTransitionColor: string;
  disintegratorProgress: number;
}

export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  state: RenderFrameState,
  showHudOverlay = true
): void {
  const backingW = Math.max(1, Math.round(cssWidth * dpr));
  const backingH = Math.max(1, Math.round(cssHeight * dpr));

  const planet = PLANETS[state.anomaliaActiva ? 4 : state.planetaActual];
  const theme = planet.theme;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = state.anomaliaActiva ? '#06020C' : theme.bgEdge;
  ctx.fillRect(0, 0, backingW, backingH);

  const scale = Math.min(backingW / LOGICAL_WIDTH, backingH / LOGICAL_HEIGHT);
  const offsetX = (backingW - LOGICAL_WIDTH * scale) / 2;
  const offsetY = (backingH - LOGICAL_HEIGHT * scale) / 2;
  const visLeft = -offsetX / scale;
  const visTop = -offsetY / scale;
  const visWidth = backingW / scale;
  const visHeight = backingH / scale;

  const shakeX = state.shakeIntensity > 0 ? (Math.random() - 0.5) * state.shakeIntensity * 2 : 0;
  const shakeY = state.shakeIntensity > 0 ? (Math.random() - 0.5) * state.shakeIntensity * 2 : 0;

  ctx.save();
  ctx.translate(offsetX + shakeX * scale, offsetY + shakeY * scale);
  ctx.scale(scale, scale);

  // Full-bleed pitch-black vector arena with center sector radial glow
  const bgRadius = Math.max(540, Math.hypot(visWidth, visHeight) * 0.55);
  const bgGrad = ctx.createRadialGradient(SHIP_X, SHIP_Y, 35, SHIP_X, SHIP_Y, bgRadius);
  bgGrad.addColorStop(0, state.anomaliaActiva ? '#19062C' : theme.bgCenter);
  bgGrad.addColorStop(1, state.anomaliaActiva ? '#040108' : theme.bgEdge);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(visLeft - 24, visTop - 24, visWidth + 48, visHeight + 48);

  // Reactive Elastic Vector Warp Grid extended seamlessly across the entire viewport
  drawWarpGrid(ctx, state.warpGrid, theme.particleColor, state.anomaliaActiva, visLeft, visTop, visWidth, visHeight);

  drawPlanetAtmosphere(
    ctx,
    state.anomaliaActiva ? 3 : planet.id,
    visLeft,
    visTop,
    visWidth,
    visHeight
  );

  // Crisp multi-layer vector starfield mapped proportionally to fill full viewport
  for (const star of state.stars) {
    const sx = visLeft + (star.x / LOGICAL_WIDTH) * visWidth;
    const sy = visTop + (star.y / LOGICAL_HEIGHT) * visHeight;
    const twinkle = 0.6 + 0.4 * Math.sin(star.twinklePhase);
    ctx.fillStyle = `rgba(248, 250, 252, ${star.alpha * twinkle * 0.78})`;
    ctx.fillRect(sx, sy, star.size, star.size);
  }

  // Ambient vector motes mapped proportionally to fill full viewport
  for (const mote of state.ambientMotes) {
    const mx = visLeft + (mote.x / LOGICAL_WIDTH) * visWidth;
    const my = visTop + (mote.y / LOGICAL_HEIGHT) * visHeight;
    ctx.fillStyle = state.anomaliaActiva ? PALETTE.stellarCore : theme.particleColor;
    ctx.globalAlpha = mote.alpha * 0.7;
    ctx.fillRect(mx, my, mote.size, mote.size);
  }
  ctx.globalAlpha = 1;

  // Subtle synth-radar orbital rings
  ctx.strokeStyle = state.anomaliaActiva ? 'rgba(224, 64, 251, 0.2)' : 'rgba(0, 240, 255, 0.1)';
  ctx.lineWidth = 1;
  [135, 215, 295].forEach((r) => {
    ctx.beginPath();
    ctx.ellipse(SHIP_X, SHIP_Y, r * 1.24, r * 0.86, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Random event atmospheric overlays
  if (state.activeEvent?.key === 'lluviaOro') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.mineralGold;
    ctx.lineCap = 'square';
    for (const m of state.meteorStreaks) {
      const mx = visLeft + (m.x / LOGICAL_WIDTH) * visWidth;
      const my = visTop + (m.y / LOGICAL_HEIGHT) * visHeight;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      const spd = Math.hypot(m.vx, m.vy) || 1;
      ctx.lineTo(mx - (m.vx / spd) * m.len, my - (m.vy / spd) * m.len);
      ctx.stroke();
    }
    ctx.restore();
  } else if (state.activeEvent?.key === 'fisuraNucleos') {
    ctx.save();
    const rift = ctx.createRadialGradient(SHIP_X, SHIP_Y, 240, SHIP_X, SHIP_Y, bgRadius);
    rift.addColorStop(0, 'rgba(224, 64, 251, 0)');
    rift.addColorStop(1, 'rgba(224, 64, 251, 0.24)');
    ctx.fillStyle = rift;
    ctx.fillRect(visLeft - 24, visTop - 24, visWidth + 48, visHeight + 48);
    ctx.restore();
  }

  // Subtle magnet radius ring & pointer sweep reticle
  if (showHudOverlay) {
    const isInterference = state.activeEvent?.key === 'interferenciaMagnetica';
    const sweepRadius = isInterference ? 145 : 115;

    ctx.save();
    ctx.strokeStyle = isInterference
      ? 'rgba(0, 240, 255, 0.5)'
      : state.tecnologia.imanCuantico
        ? 'rgba(224, 64, 251, 0.18)'
        : 'rgba(0, 240, 255, 0.1)';
    ctx.setLineDash(isInterference ? [4, 4] : [3, 9]);
    ctx.lineWidth = isInterference ? 1.5 : 1;
    ctx.beginPath();
    ctx.arc(SHIP_X, SHIP_Y, Math.min(340, state.stats.radioIman), 0, Math.PI * 2);
    ctx.stroke();

    if (
      state.pointerLogicalX !== null &&
      state.pointerLogicalY !== null &&
      (state.orbs.length > 0 || isInterference)
    ) {
      ctx.strokeStyle = isInterference ? 'rgba(0, 240, 255, 0.55)' : 'rgba(255, 214, 0, 0.22)';
      ctx.lineWidth = isInterference ? 1.6 : 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(state.pointerLogicalX, state.pointerLogicalY, sweepRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Reactive Deflector Pulse interception ring when ready and enemy fire enters danger radius
    if (state.deflectorCooldown <= 0) {
      const threatNear = state.projectiles.some(
        (p) => !p.fromPlayer && Math.hypot(p.x - SHIP_X, p.y - SHIP_Y) <= DEFLECTOR_PULSE_RADIUS + 42
      );
      if (threatNear) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.34)';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(SHIP_X, SHIP_Y, DEFLECTOR_PULSE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Aim vector line
  if (showHudOverlay && state.activeTarget) {
    ctx.save();
    ctx.strokeStyle =
      state.lockedTargetId === state.activeTarget.id
        ? 'rgba(0, 240, 255, 0.42)'
        : 'rgba(139, 155, 180, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(SHIP_X, SHIP_Y);
    ctx.lineTo(state.activeTarget.x, state.activeTarget.y);
    ctx.stroke();
    ctx.restore();
  }

  // Additive Shockwaves
  state.particleManager.renderShockwaves(ctx);

  // Physical Loot Orbs with additive neon aura
  drawLootOrbs(ctx, state.orbs, state.visualTime);

  // Targets
  for (const t of state.targets) {
    drawTarget(ctx, t, showHudOverlay && state.lockedTargetId === t.id, state);
  }

  // Instant Laser Beams with additive bloom
  if (state.beams.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const beam of state.beams) {
      const alpha = Math.max(0, beam.life / beam.maxLife);
      ctx.globalAlpha = alpha * 0.55;
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = beam.width * 3.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = beam.width * 0.75;
      ctx.beginPath();
      ctx.moveTo(beam.x1, beam.y1);
      ctx.lineTo(beam.x2, beam.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Electric Vector Projectiles (differentiated silhouettes for fleet ships)
  if (state.projectiles.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of state.projectiles) {
      if (p.fleetKind === 'corbeta') {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4.6;
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.globalAlpha = 0.98;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-14, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      if (p.fleetKind === 'fragata') {
        const ang = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(0, -5);
        ctx.lineTo(-7, 0);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        continue;
      }

      const tailFactor = p.fromPlayer ? 0.036 : 0.048;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.radius * 2.1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * tailFactor, p.y - p.vy * tailFactor);
      ctx.stroke();

      ctx.globalAlpha = 0.95;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1.2, p.radius * 0.8);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * (tailFactor * 0.55), p.y - p.vy * (tailFactor * 0.55));
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Player Ship, Drones & Allied Fleet
  drawPlayerShip(ctx, state);
  drawSupportDrones(ctx, state);
  drawFleetShips(ctx, state);

  // Particles & Floating Texts
  state.particleManager.renderParticles(ctx);
  state.particleManager.renderFloatingTexts(ctx);

  if (state.sectorTransitionFlash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.28, state.sectorTransitionFlash * 0.28);
    ctx.fillStyle = state.sectorTransitionColor;
    ctx.fillRect(visLeft - 24, visTop - 24, visWidth + 48, visHeight + 48);
    ctx.restore();
  }

  if (showHudOverlay) {
    drawCanvasHud(ctx, state, visLeft, visTop, visWidth, visHeight);
  }

  ctx.restore();
}

function drawWarpGrid(
  ctx: CanvasRenderingContext2D,
  warpGrid: WarpNode[],
  accentColor: string,
  isAnomaly: boolean,
  visLeft: number,
  visTop: number,
  visWidth: number,
  visHeight: number
): void {
  if (warpGrid.length === 0) return;
  const cols = 19;
  const rows = 13;
  const cellSize = 50;
  const visRight = visLeft + visWidth;
  const visBottom = visTop + visHeight;

  ctx.save();
  ctx.strokeStyle = isAnomaly ? '#E040FB' : accentColor;
  ctx.globalAlpha = isAnomaly ? 0.14 : 0.11;
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    const firstNode = warpGrid[r * cols];
    if (visLeft < firstNode.x) {
      ctx.moveTo(visLeft - 24, firstNode.y);
      ctx.lineTo(firstNode.x, firstNode.y);
    } else {
      ctx.moveTo(firstNode.x, firstNode.y);
    }
    for (let c = 1; c < cols; c++) {
      const node = warpGrid[r * cols + c];
      ctx.lineTo(node.x, node.y);
    }
    const lastNode = warpGrid[r * cols + (cols - 1)];
    if (visRight > lastNode.x) {
      ctx.lineTo(visRight + 24, lastNode.y);
    }
  }
  for (let c = 0; c < cols; c++) {
    const firstNode = warpGrid[c];
    if (visTop < firstNode.y) {
      ctx.moveTo(firstNode.x, visTop - 24);
      ctx.lineTo(firstNode.x, firstNode.y);
    } else {
      ctx.moveTo(firstNode.x, firstNode.y);
    }
    for (let r = 1; r < rows; r++) {
      const node = warpGrid[r * cols + c];
      ctx.lineTo(node.x, node.y);
    }
    const lastNode = warpGrid[(rows - 1) * cols + c];
    if (visBottom > lastNode.y) {
      ctx.lineTo(lastNode.x, visBottom + 24);
    }
  }
  for (let y = -cellSize; y >= visTop - cellSize; y -= cellSize) {
    ctx.moveTo(visLeft - 24, y);
    ctx.lineTo(visRight + 24, y);
  }
  for (let y = LOGICAL_HEIGHT + cellSize; y <= visBottom + cellSize; y += cellSize) {
    ctx.moveTo(visLeft - 24, y);
    ctx.lineTo(visRight + 24, y);
  }
  for (let x = -cellSize; x >= visLeft - cellSize; x -= cellSize) {
    ctx.moveTo(x, visTop - 24);
    ctx.lineTo(x, visBottom + 24);
  }
  for (let x = LOGICAL_WIDTH + cellSize; x <= visRight + cellSize; x += cellSize) {
    ctx.moveTo(x, visTop - 24);
    ctx.lineTo(x, visBottom + 24);
  }
  ctx.stroke();

  ctx.fillStyle = isAnomaly ? '#E040FB' : accentColor;
  ctx.globalAlpha = 0.22;
  for (let r = 2; r < rows - 1; r += 2) {
    for (let c = 2; c < cols - 1; c += 2) {
      const node = warpGrid[r * cols + c];
      ctx.fillRect(node.x - 1, node.y - 1, 2, 2);
    }
  }
  ctx.restore();
}

function drawLootOrbs(
  ctx: CanvasRenderingContext2D,
  orbs: LootOrb[],
  visualTime: number
): void {
  for (const orb of orbs) {
    const pulse = 1 + 0.16 * Math.sin(visualTime * 8 + orb.id);
    ctx.save();
    ctx.translate(orb.x, orb.y);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = orb.color;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, orb.radius * 2.15 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (orb.kind === 'nucleo') {
      ctx.rotate(visualTime * 2.8 + orb.id);
      ctx.fillStyle = '#2A0838';
      ctx.strokeStyle = PALETTE.stellarCore;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -orb.radius * 1.1);
      ctx.lineTo(orb.radius * 0.9, 0);
      ctx.lineTo(0, orb.radius * 1.1);
      ctx.lineTo(-orb.radius * 0.9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = orb.color;
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.arc(0, 0, orb.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawPlanetAtmosphere(
  ctx: CanvasRenderingContext2D,
  planetId: PlanetId,
  visLeft: number,
  visTop: number,
  visWidth: number,
  visHeight: number
): void {
  ctx.save();
  if (planetId === 2) {
    const ringX = visLeft + visWidth * 0.85;
    const ringY = visTop + visHeight * 0.18;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.14)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(ringX, ringY, 280, 95, -0.35, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(ringX, ringY, 305, 108, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  } else if (planetId === 3) {
    const n1x = visLeft + visWidth * 0.2;
    const n1y = visTop + visHeight * 0.23;
    const neb1 = ctx.createRadialGradient(n1x, n1y, 20, n1x, n1y, 260);
    neb1.addColorStop(0, 'rgba(224, 64, 251, 0.14)');
    neb1.addColorStop(1, 'rgba(224, 64, 251, 0)');
    ctx.fillStyle = neb1;
    ctx.fillRect(visLeft - 24, visTop - 24, visWidth + 48, visHeight + 48);

    const n2x = visLeft + visWidth * 0.82;
    const n2y = visTop + visHeight * 0.8;
    const neb2 = ctx.createRadialGradient(n2x, n2y, 20, n2x, n2y, 280);
    neb2.addColorStop(0, 'rgba(0, 240, 255, 0.1)');
    neb2.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(visLeft - 24, visTop - 24, visWidth + 48, visHeight + 48);
  } else if (planetId === 4) {
    const outerR = Math.max(540, Math.hypot(visWidth, visHeight) * 0.55);
    const corona = ctx.createRadialGradient(SHIP_X, SHIP_Y, 220, SHIP_X, SHIP_Y, outerR);
    corona.addColorStop(0, 'rgba(255, 107, 0, 0)');
    corona.addColorStop(0.75, 'rgba(255, 30, 86, 0.14)');
    corona.addColorStop(1, 'rgba(255, 158, 0, 0.25)');
    ctx.fillStyle = corona;
    ctx.fillRect(visLeft - 24, visTop - 24, visWidth + 48, visHeight + 48);
  }
  ctx.restore();
}

function drawPlayerShip(ctx: CanvasRenderingContext2D, state: RenderFrameState): void {
  const { stats, visualTime, mejoras, tecnologia, postura } = state;

  ctx.save();
  ctx.translate(SHIP_X, SHIP_Y);

  // Pure time-based Stance Aura (pixelfx-style loop)
  if (postura === 'asalto') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(visualTime * 1.4);
    ctx.strokeStyle = PALETTE.enemy;
    ctx.globalAlpha = 0.28 + 0.14 * Math.sin(visualTime * 6);
    ctx.lineWidth = 1.6;
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (postura === 'escudo') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.rotate(-visualTime * 0.8);
    ctx.strokeStyle = PALETTE.positive;
    ctx.globalAlpha = 0.25 + 0.12 * Math.sin(visualTime * 4);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sx = Math.cos(a) * 35;
      const sy = Math.sin(a) * 35;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  if (state.sobrecargaTimer > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = PALETTE.warning;
    ctx.globalAlpha = 0.45 + 0.25 * Math.sin(visualTime * 12);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (state.escudoActual > 0) {
    const shieldRatio = Math.max(0.25, state.escudoActual / Math.max(1, stats.escudoMax));
    const shieldColor =
      postura === 'escudo'
        ? PALETTE.positive
        : tecnologia.escudoReflector
          ? '#67E8F9'
          : PALETTE.shield;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = shieldColor;
    ctx.globalAlpha = 0.22 + shieldRatio * 0.28;
    ctx.lineWidth = mejoras.cascoEscudo >= 15 ? 7 : 5.5;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.55 + shieldRatio * 0.4;
    ctx.strokeStyle = '#E0F2FE';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = shieldColor;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();

    if (mejoras.cascoEscudo >= 10) {
      ctx.save();
      ctx.rotate(visualTime * 0.75);
      ctx.strokeStyle = shieldColor;
      ctx.globalAlpha = 0.35 + shieldRatio * 0.25;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const hx = Math.cos(a) * 32;
        const hy = Math.sin(a) * 32;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  ctx.rotate(state.shipAngle);

  const cadBoost = mejoras.cadencia >= 10 ? 5 : 0;
  const flicker = 6 + cadBoost + ((Math.sin(visualTime * 52) + 1) * 0.5) * 6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle =
    state.sobrecargaTimer > 0
      ? PALETTE.warning
      : postura === 'asalto'
        ? PALETTE.enemy
        : PALETTE.shipAndDrone;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(-13, -7);
  ctx.lineTo(-22 - flicker, -4.5);
  ctx.lineTo(-13, -2);
  ctx.moveTo(-13, 2);
  ctx.lineTo(-22 - flicker, 4.5);
  ctx.lineTo(-13, 7);
  ctx.fill();
  ctx.restore();

  if (mejoras.danoCanon >= 10) {
    ctx.fillStyle = '#00F0FF';
    ctx.fillRect(2, -14, 13, 2.5);
    ctx.fillRect(2, 11.5, 13, 2.5);
  }

  ctx.fillStyle = state.shipHitFlash > 0 ? '#FFFFFF' : '#CBD5E1';
  ctx.strokeStyle = postura === 'asalto' ? PALETTE.enemy : PALETTE.shipAndDrone;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-13, -17);
  ctx.lineTo(-9, -4);
  ctx.lineTo(-9, 4);
  ctx.lineTo(-13, 17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (mejoras.cascoEscudo >= 5) {
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(4, -12);
    ctx.lineTo(-10, -15);
    ctx.moveTo(4, 12);
    ctx.lineTo(-10, 15);
    ctx.stroke();
  }

  ctx.fillStyle = state.shipHitFlash > 0 ? '#FFFFFF' : '#F8FAFC';
  ctx.strokeStyle = '#00F0FF';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-4, -10);
  ctx.lineTo(-13, -7);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-13, 7);
  ctx.lineTo(-4, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (mejoras.danoCanon >= 20) {
    ctx.fillStyle = PALETTE.mineralGold;
    ctx.beginPath();
    ctx.arc(22, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (tecnologia.hazDesintegrador && state.disintegratorProgress > 0) {
    const readySoon = state.disintegratorProgress >= 5 / 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = readySoon ? '#FFFFFF' : PALETTE.stellarCore;
    ctx.globalAlpha = 0.45 + state.disintegratorProgress * 0.55;
    ctx.beginPath();
    ctx.arc(23, 0, readySoon ? 3.4 : 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#030508';
  ctx.strokeStyle = PALETTE.shipAndDrone;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(5, 0, 5.5, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawSupportDrones(ctx: CanvasRenderingContext2D, state: RenderFrameState): void {
  const count = state.stats.cantidadDrones;

  for (let d = 0; d < count; d++) {
    const offset = (d / count) * Math.PI * 2;
    const dx = SHIP_X + Math.cos(state.droneOrbitAngle + offset) * 44;
    const dy = SHIP_Y + Math.sin(state.droneOrbitAngle + offset) * 44;
    const droneAngle = state.activeTarget
      ? Math.atan2(state.activeTarget.y - dy, state.activeTarget.x - dx)
      : state.droneOrbitAngle + offset + Math.PI / 2;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(droneAngle);

    ctx.strokeStyle = PALETTE.shipAndDrone;
    ctx.fillStyle = '#030508';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(6.5, 0);
    ctx.lineTo(-3.5, -4);
    ctx.lineTo(-1.5, 0);
    ctx.lineTo(-3.5, 4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = PALETTE.shipAndDrone;
    ctx.beginPath();
    ctx.arc(1, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawFleetShips(ctx: CanvasRenderingContext2D, state: RenderFrameState): void {
  for (const unit of state.fleetUnits) {
    const def = FLEET_DEFINITIONS.find((f) => f.key === unit.key)!;
    const fx = SHIP_X + Math.cos(unit.angle) * def.radioOrbita;
    const fy = SHIP_Y + Math.sin(unit.angle) * def.radioOrbita;
    const angle = state.activeTarget
      ? Math.atan2(state.activeTarget.y - fy, state.activeTarget.x - fx)
      : unit.angle + Math.PI / 2;

    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(angle);
    ctx.fillStyle = '#060A12';
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.6;

    if (unit.key === 'caza') {
      ctx.beginPath();
      ctx.moveTo(11, 0);
      ctx.lineTo(-6, -6.5);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 6.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (unit.key === 'corbeta') {
      ctx.beginPath();
      ctx.moveTo(13, -3);
      ctx.lineTo(13, 3);
      ctx.lineTo(-4, 7.5);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-4, -7.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(4, -9.5);
      ctx.lineTo(-10, -8);
      ctx.lineTo(-10, 8);
      ctx.lineTo(4, 9.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(2, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTarget(
  ctx: CanvasRenderingContext2D,
  t: CombatTarget,
  isLocked: boolean,
  state: RenderFrameState
): void {
  const theme = PLANETS[state.anomaliaActiva ? 4 : state.planetaActual].theme;

  ctx.save();
  ctx.translate(t.x, t.y);

  if (isLocked) {
    ctx.save();
    ctx.rotate(state.visualTime * 2.0);
    ctx.strokeStyle = PALETTE.shipAndDrone;
    ctx.lineWidth = 1.8;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, t.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (t.kind === 'asteroide') {
    const isGoldMeteor = t.name === 'Meteorito de oro';
    const isCoreCrystal = t.name === 'Cristal Estelar';
    const rockFill = isGoldMeteor ? '#1F1404' : isCoreCrystal ? '#1D062C' : theme.asteroidBase;
    const rockEdge = isGoldMeteor ? '#FFD600' : isCoreCrystal ? '#E040FB' : theme.asteroidVein;
    const facetWire = isGoldMeteor ? '#FDE047' : isCoreCrystal ? '#F0ABFC' : theme.asteroidShade;

    if (isGoldMeteor || isCoreCrystal) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rockEdge;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.rotate(t.rotation);
    const count = t.vertices.length;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = t.radius * t.vertices[i];
      pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    ctx.fillStyle = t.hitFlash > 0 ? '#FFFFFF' : rockFill;
    ctx.globalAlpha = t.hitFlash > 0 ? 0.92 : 0.94;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    const ridgeX = -t.radius * 0.16;
    const ridgeY = t.radius * 0.12;
    ctx.strokeStyle = facetWire;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const next = pts[(i + 2) % count];
      ctx.moveTo(ridgeX, ridgeY);
      ctx.lineTo(pts[i].x, pts[i].y);
      if (i % 2 === 0) {
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(next.x, next.y);
      }
    }
    ctx.stroke();

    ctx.strokeStyle = rockEdge;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    pts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = '#FFFBEB';
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * 0.5, pts[0].y * 0.5);
    ctx.lineTo(ridgeX, ridgeY);
    ctx.lineTo(pts[4].x * 0.55, pts[4].y * 0.55);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  } else if (t.kind === 'enemigo') {
    if (t.eliteTrait) {
      const eliteColor =
        t.eliteTrait === 'blindado'
          ? PALETTE.warning
          : t.eliteTrait === 'veloz'
            ? PALETTE.stellarCore
            : PALETTE.boss;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.rotate(-state.visualTime * 1.5);
      ctx.strokeStyle = eliteColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const r = k % 2 === 0 ? t.radius + 7 : t.radius + 2;
        const ex = Math.cos(a) * r;
        const ey = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(ex, ey);
        else ctx.lineTo(ex, ey);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (t.telegraph > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = PALETTE.warning;
      ctx.globalAlpha = t.telegraph * 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (t.eliteTrait === 'blindado') {
      ctx.save();
      ctx.rotate(t.rotation);
      ctx.strokeStyle = PALETTE.warning;
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius + 3, -0.85, 0.85);
      ctx.stroke();
      ctx.restore();
    }

    if (t.empStunTimer > 0) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.save();
    ctx.rotate(t.rotation);
    const scale = t.eliteTrait ? 1.24 : 1;
    ctx.scale(scale, scale);

    const hullStroke =
      t.eliteTrait === 'veloz'
        ? PALETTE.stellarCore
        : t.eliteTrait === 'blindado'
          ? PALETTE.warning
          : theme.enemyAccent;

    ctx.fillStyle = t.hitFlash > 0 ? '#FFFFFF' : hullStroke;
    ctx.strokeStyle = t.hitFlash > 0 ? '#FFFFFF' : '#FFE4E6';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-9, -16);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-17, 0);
    ctx.lineTo(-4, 5);
    ctx.lineTo(-9, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#030508';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-6, -7.5);
    ctx.lineTo(-6, 7.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = t.telegraph > 0 ? '#FFFFFF' : PALETTE.warning;
    ctx.beginPath();
    ctx.arc(3, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  } else {
    const isPhase2 = t.hp < t.maxHp * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = isPhase2
      ? PALETTE.warning
      : state.anomaliaActiva
        ? PALETTE.stellarCore
        : PALETTE.boss;
    ctx.globalAlpha = isPhase2 ? 0.55 + 0.2 * Math.sin(state.visualTime * 10) : 0.42;
    ctx.lineWidth = isPhase2 ? 4 : 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, t.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (t.telegraph > 0) {
      ctx.strokeStyle = PALETTE.warning;
      ctx.globalAlpha = t.telegraph * 0.9;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (t.telegraph > 0.15) {
        const aimAngle = Math.atan2(SHIP_Y - t.y, SHIP_X - t.x);
        const bossId = t.bossPlanetId ?? 1;
        const deltas =
          bossId === 1
            ? isPhase2
              ? [-0.14, 0, 0.14]
              : [0]
            : bossId === 2
              ? isPhase2
                ? [-0.36, -0.18, 0, 0.18, 0.36]
                : [-0.21, 0, 0.21]
              : bossId === 3
                ? isPhase2
                  ? [-0.42, -0.1, 0.1, 0.42]
                  : [-0.1, 0.1]
                : isPhase2
                  ? [-0.36, -0.18, 0, 0.18, 0.36]
                  : [-0.26, -0.13, 0, 0.13, 0.26];

        ctx.save();
        ctx.strokeStyle = PALETTE.boss;
        ctx.globalAlpha = 0.2 + t.telegraph * 0.36;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([7, 7]);
        for (const d of deltas) {
          const a = aimAngle + d;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (t.radius + 8), Math.sin(a) * (t.radius + 8));
          ctx.lineTo(Math.cos(a) * 260, Math.sin(a) * 260);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    if (t.empStunTimer > 0) {
      ctx.strokeStyle = PALETTE.shield;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, t.radius + 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.save();
    ctx.rotate(t.rotation);

    ctx.fillStyle = t.hitFlash > 0 ? '#FFFFFF' : state.anomaliaActiva ? '#4C1D95' : '#9F1239';
    ctx.strokeStyle = state.anomaliaActiva ? '#F0ABFC' : '#FF2E63';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, -16);
    ctx.lineTo(-26, -32);
    ctx.lineTo(-34, -12);
    ctx.lineTo(-34, 12);
    ctx.lineTo(-26, 32);
    ctx.lineTo(22, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = t.hitFlash > 0 ? '#FFFFFF' : state.anomaliaActiva ? '#E040FB' : PALETTE.boss;
    ctx.strokeStyle = '#FFF1F2';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(39, 0);
    ctx.lineTo(14, -20);
    ctx.lineTo(-22, -20);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-22, 20);
    ctx.lineTo(14, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#030508';
    ctx.strokeStyle = state.anomaliaActiva ? '#E040FB' : '#FF2E63';
    ctx.lineWidth = 1.4;
    ctx.fillRect(-6, -24, 16, 8);
    ctx.strokeRect(-6, -24, 16, 8);
    ctx.fillRect(-6, 16, 16, 8);
    ctx.strokeRect(-6, 16, 16, 8);

    ctx.fillStyle = t.telegraph > 0 ? '#FFFFFF' : PALETTE.warning;
    ctx.beginPath();
    ctx.arc(8, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  if (t.kind !== 'jefe' && (t.hp < t.maxHp || t.eliteTrait)) {
    const barW = t.eliteTrait ? 50 : 40;
    const barH = 3.5;
    const ratio = Math.max(0, t.hp / t.maxHp);
    ctx.fillStyle = 'rgba(3, 5, 8, 0.92)';
    ctx.fillRect(-barW / 2, -t.radius - 13, barW, barH);
    ctx.fillStyle = t.eliteTrait ? PALETTE.warning : t.kind === 'enemigo' ? theme.enemyAccent : theme.asteroidVein;
    ctx.fillRect(-barW / 2, -t.radius - 13, barW * ratio, barH);

    if (t.eliteTrait) {
      ctx.font = '700 10px "Oxanium", sans-serif';
      ctx.fillStyle = PALETTE.warning;
      ctx.textAlign = 'center';
      ctx.fillText('ÉLITE', 0, -t.radius - 18);
    }
  }

  ctx.restore();
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  len = 8
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);

  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);

  ctx.moveTo(x, y + h - len);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + len, y + h);

  ctx.moveTo(x + w - len, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - len);
  ctx.stroke();
}

function drawSegmentedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  fillColor: string,
  segments = 10
): void {
  const gap = 2;
  const segW = (w - gap * (segments - 1)) / segments;
  const filledFloat = pct * segments;
  for (let i = 0; i < segments; i++) {
    const sx = x + i * (segW + gap);
    ctx.fillStyle = 'rgba(26, 39, 66, 0.55)';
    ctx.fillRect(sx, y, segW, h);
    if (filledFloat > i) {
      const frac = Math.min(1, filledFloat - i);
      ctx.fillStyle = fillColor;
      ctx.fillRect(sx, y, segW * frac, h);
    }
  }
}

function drawCanvasHud(
  ctx: CanvasRenderingContext2D,
  state: RenderFrameState,
  visLeft: number,
  visTop: number,
  visWidth: number,
  visHeight: number
): void {
  const { stats } = state;
  const planet = PLANETS[state.planetaActual];
  const boss = state.targets.find((t) => t.kind === 'jefe');
  const pad = visWidth < 560 ? 10 : 14;
  const leftX = visLeft + pad;
  const topY = visTop + pad;
  const centerX = visLeft + visWidth / 2;
  const bottomY = visTop + visHeight;
  const stackedTopHud = visWidth < 820;

  const leftBoxW = stackedTopHud
    ? Math.max(170, Math.min(220, Math.floor((visWidth - pad * 3) * 0.54)))
    : 224;
  const rightBoxW = stackedTopHud
    ? Math.max(132, Math.min(204, visWidth - pad * 3 - leftBoxW))
    : 212;
  const rightBoxX = visLeft + visWidth - pad - rightBoxW;
  const rightCenterX = rightBoxX + rightBoxW / 2;

  const stanceDef =
    STANCE_DEFINITIONS.find((s) => s.key === state.postura) ?? STANCE_DEFINITIONS[1];

  // Top-left: Hull, Shield, Stance & Deflector Pulse
  ctx.save();
  ctx.fillStyle = 'rgba(3, 5, 8, 0.74)';
  ctx.fillRect(leftX, topY, leftBoxW, 72);
  drawCornerBrackets(ctx, leftX, topY, leftBoxW, 72, PALETTE.shipAndDrone, 7);

  const barW = leftBoxW - 20;
  const shieldPct = Math.max(0, Math.min(1, state.escudoActual / Math.max(1, stats.escudoMax)));
  ctx.font = '600 10.5px "JetBrains Mono", monospace';
  ctx.fillStyle = PALETTE.shield;
  ctx.textAlign = 'left';
  ctx.fillText(`ESC ${formatInt(state.escudoActual)}/${formatInt(stats.escudoMax)}`, leftX + 10, topY + 16);
  drawSegmentedBar(ctx, leftX + 10, topY + 20, barW, 5, shieldPct, PALETTE.shield, 12);

  const hullPct = Math.max(0, Math.min(1, state.cascoActual / Math.max(1, stats.cascoMax)));
  ctx.fillStyle = hullPct < 0.35 ? PALETTE.boss : PALETTE.textPrimary;
  ctx.fillText(`CAS ${formatInt(state.cascoActual)}/${formatInt(stats.cascoMax)}`, leftX + 10, topY + 39);
  drawSegmentedBar(
    ctx,
    leftX + 10,
    topY + 43,
    barW,
    5,
    hullPct,
    hullPct < 0.35 ? PALETTE.boss : '#F8FAFC',
    12
  );

  // Stance & Deflector status row inside top-left bracket
  ctx.font = '700 9.5px "JetBrains Mono", monospace';
  ctx.fillStyle = stanceDef.color;
  ctx.textAlign = 'left';
  ctx.fillText(`[${stanceDef.atajo}] ${stanceDef.nombre.slice(0, 6).toUpperCase()}`, leftX + 10, topY + 63);

  ctx.textAlign = 'right';
  if (state.deflectorCooldown <= 0) {
    ctx.fillStyle = PALETTE.positive;
    ctx.fillText(leftBoxW < 195 ? 'DEFL LISTO' : 'DEFLECTOR [ESP]', leftX + leftBoxW - 10, topY + 63);
  } else {
    ctx.fillStyle = PALETTE.textSecondary;
    ctx.fillText(`DEFL ${state.deflectorCooldown.toFixed(1)}s`, leftX + leftBoxW - 10, topY + 63);
  }
  ctx.restore();

  // Center Boss bar / Anomaly Wave / Planet progress (row 2 on narrow viewports so boxes never collide)
  const centerTopY = stackedTopHud ? topY + 78 : topY;
  const maxCenterW = stackedTopHud
    ? Math.max(220, Math.min(360, visWidth - pad * 2))
    : Math.max(220, Math.min(350, visWidth - leftBoxW - rightBoxW - pad * 4));
  let centerBottomY = centerTopY;

  ctx.save();
  if (boss) {
    const bossW = maxCenterW;
    const bossX = centerX - bossW / 2;
    const isPhase2 = boss.hp < boss.maxHp * 0.5;
    ctx.fillStyle = 'rgba(3, 5, 8, 0.82)';
    ctx.fillRect(bossX, centerTopY, bossW, 44);
    drawCornerBrackets(ctx, bossX, centerTopY, bossW, 44, isPhase2 ? PALETTE.warning : PALETTE.boss, 9);

    ctx.font = '700 12.5px "Oxanium", sans-serif';
    ctx.fillStyle = PALETTE.textPrimary;
    ctx.textAlign = 'left';
    ctx.fillText(
      isPhase2 ? `JEFE: ${boss.name} · FASE 2` : `JEFE: ${boss.name}`,
      bossX + 12,
      centerTopY + 18
    );

    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = isPhase2 ? PALETTE.warning : PALETTE.boss;
    ctx.textAlign = 'right';
    ctx.fillText(`${formatInt(Math.max(0, boss.hp))} / ${formatInt(boss.maxHp)}`, bossX + bossW - 12, centerTopY + 18);

    const bossRatio = Math.max(0, boss.hp / boss.maxHp);
    ctx.fillStyle = '#0D1322';
    ctx.fillRect(bossX + 12, centerTopY + 26, bossW - 24, 7);
    ctx.fillStyle = isPhase2 ? PALETTE.warning : PALETTE.boss;
    ctx.fillRect(bossX + 12, centerTopY + 26, (bossW - 24) * bossRatio, 7);

    // 50% Phase 2 threshold tick
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(bossX + bossW / 2 - 0.5, centerTopY + 25, 1.5, 9);
    centerBottomY = centerTopY + 44;
  } else if (state.anomaliaActiva) {
    const boxW = Math.min(290, maxCenterW);
    const boxX = centerX - boxW / 2;
    ctx.fillStyle = 'rgba(3, 5, 8, 0.78)';
    ctx.fillRect(boxX, centerTopY, boxW, 36);
    drawCornerBrackets(ctx, boxX, centerTopY, boxW, 36, PALETTE.stellarCore, 7);

    ctx.font = '700 12.5px "Oxanium", sans-serif';
    ctx.fillStyle = PALETTE.stellarCore;
    ctx.textAlign = 'center';
    ctx.fillText(`Anomalía Infinita · Oleada ${state.oleadaAnomalia}`, centerX, centerTopY + 17);

    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = PALETTE.textPrimary;
    ctx.fillText(`Bajas de oleada: ${state.anomalyWaveKills} / 15`, centerX, centerTopY + 31);
    centerBottomY = centerTopY + 36;
  } else {
    const progress = state.objetivosPorPlaneta[state.planetaActual];
    const boxW = Math.min(290, maxCenterW);
    const boxX = centerX - boxW / 2;
    ctx.fillStyle = 'rgba(3, 5, 8, 0.72)';
    ctx.fillRect(boxX, centerTopY, boxW, 36);
    drawCornerBrackets(ctx, boxX, centerTopY, boxW, 36, '#1A2742', 7);

    ctx.font = '700 12.5px "Oxanium", sans-serif';
    ctx.fillStyle = PALETTE.textPrimary;
    ctx.textAlign = 'center';
    ctx.fillText(`${planet.id}. ${planet.nombre}`, centerX, centerTopY + 17);

    ctx.font = '500 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = progress >= planet.umbralJefe ? PALETTE.positive : PALETTE.textSecondary;
    ctx.fillText(`Objetivos: ${formatInt(progress)} / ${formatInt(planet.umbralJefe)}`, centerX, centerTopY + 31);
    centerBottomY = centerTopY + 36;
  }
  ctx.restore();

  // Active Random Space Event Banner
  if (state.activeEvent) {
    const evDef = RANDOM_EVENT_DEFINITIONS.find((d) => d.key === state.activeEvent!.key);
    if (evDef) {
      const bannerW = Math.min(320, maxCenterW);
      const bannerX = centerX - bannerW / 2;
      const bannerY = centerBottomY + 6;
      const pct = Math.max(0, Math.min(1, state.activeEvent.remainingSec / state.activeEvent.durationSec));
      ctx.save();
      ctx.fillStyle = 'rgba(3, 5, 8, 0.85)';
      ctx.fillRect(bannerX, bannerY, bannerW, 32);
      drawCornerBrackets(ctx, bannerX, bannerY, bannerW, 32, evDef.color, 6);

      ctx.font = '700 11px "Oxanium", sans-serif';
      ctx.fillStyle = evDef.color;
      ctx.textAlign = 'left';
      ctx.fillText(evDef.nombre, bannerX + 10, bannerY + 15);

      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillStyle = PALETTE.textPrimary;
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.ceil(state.activeEvent.remainingSec)}s`, bannerX + bannerW - 10, bannerY + 15);

      ctx.fillStyle = '#0D1322';
      ctx.fillRect(bannerX + 10, bannerY + 21, bannerW - 20, 3);
      ctx.fillStyle = evDef.color;
      ctx.fillRect(bannerX + 10, bannerY + 21, (bannerW - 20) * pct, 3);
      ctx.restore();
    }
  }

  // Top-right: Vector Aim status & Streak / Overdrive alerts
  ctx.save();
  const isManual = state.lockedTargetId !== null;
  ctx.fillStyle = 'rgba(3, 5, 8, 0.72)';
  ctx.fillRect(rightBoxX, topY, rightBoxW, 32);
  drawCornerBrackets(ctx, rightBoxX, topY, rightBoxW, 32, isManual ? PALETTE.shipAndDrone : '#1A2742', 6);

  ctx.font = '600 10.5px "JetBrains Mono", monospace';
  ctx.fillStyle = isManual ? PALETTE.shipAndDrone : PALETTE.textSecondary;
  ctx.textAlign = 'center';
  ctx.fillText(
    isManual
      ? rightBoxW < 170
        ? 'OBJ. FIJADO'
        : 'FIJACIÓN MANUAL · PULSO'
      : 'AUTOAPUNTADO',
    rightCenterX,
    topY + 20
  );

  let rightY = topY + 38;
  if (state.orbCombo >= 2 && state.orbComboTimer > 0) {
    ctx.fillStyle = 'rgba(3, 5, 8, 0.8)';
    ctx.fillRect(rightBoxX, rightY, rightBoxW, 24);
    drawCornerBrackets(ctx, rightBoxX, rightY, rightBoxW, 24, PALETTE.stellarCore, 5);
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = PALETTE.stellarCore;
    ctx.fillText(`RACHA ×${state.orbCombo}`, rightCenterX, rightY + 16);
    rightY += 29;
  }

  if (state.sobrecargaTimer > 0) {
    ctx.fillStyle = 'rgba(3, 5, 8, 0.8)';
    ctx.fillRect(rightBoxX, rightY, rightBoxW, 24);
    drawCornerBrackets(ctx, rightBoxX, rightY, rightBoxW, 24, PALETTE.warning, 5);
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = PALETTE.warning;
    ctx.fillText(
      rightBoxW < 175
        ? `SOBREC. ${Math.ceil(state.sobrecargaTimer)}s`
        : `SOBRECARGA +50% · ${Math.ceil(state.sobrecargaTimer)}s`,
      rightCenterX,
      rightY + 16
    );
    rightY += 29;
  }

  if (state.bodegaLlenaAviso && !state.mejoras.autoventa) {
    ctx.fillStyle = 'rgba(3, 5, 8, 0.85)';
    ctx.fillRect(rightBoxX, rightY, rightBoxW, 24);
    drawCornerBrackets(ctx, rightBoxX, rightY, rightBoxW, 24, PALETTE.warning, 5);

    ctx.font = '700 10.5px "Oxanium", sans-serif';
    ctx.fillStyle = PALETTE.warning;
    ctx.fillText(rightBoxW < 175 ? 'Bodega llena' : 'Bodega llena · Vende carga', rightCenterX, rightY + 16);
  }
  ctx.restore();

  if (state.alertaTexto) {
    const alertW = Math.max(220, Math.min(460, visWidth - pad * 2));
    const alertX = centerX - alertW / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(3, 5, 8, 0.88)';
    ctx.fillRect(alertX, bottomY - 44, alertW, 30);
    ctx.strokeStyle = PALETTE.warning;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(alertX, bottomY - 44);
    ctx.lineTo(alertX + alertW, bottomY - 44);
    ctx.moveTo(alertX, bottomY - 14);
    ctx.lineTo(alertX + alertW, bottomY - 14);
    ctx.stroke();

    ctx.font = '600 11.5px "Oxanium", sans-serif';
    ctx.fillStyle = PALETTE.warning;
    ctx.textAlign = 'center';
    ctx.fillText(state.alertaTexto, centerX, bottomY - 25, alertW - 18);
    ctx.restore();
  }
}
