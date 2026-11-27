import { spaceAudio } from './audio';
import {
  applyWarpGridImpulse,
  createBonusEventAsteroid,
  createBossTarget,
  createInitialMotes,
  createInitialStars,
  createNormalTarget,
  createSectorContract,
  createWarpGrid,
  spawnBossAttackProjectiles,
  updateWarpGrid,
  type FleetUnitState,
  type MeteorStreak,
  type WarpNode,
} from './entities';
import {
  computeInterceptVelocity,
  formatCredits,
  getConsumableCost,
  getFleetDamageMultiplier,
  getFleetShipCost,
  getPrestigeCoreReward,
  getPrestigeLootMultiplier,
  getShipStats,
  getUpgradeCost,
  getUpgradeLevel,
  getXpForNextRank,
  isOverdriveSupported,
  selectAutoAimTarget,
} from './formulas';
import { ParticleManager } from './particles';
import { renderGameFrame } from './renderer';
import { clearSaveData, persistSaveData } from './storage';
import {
  CONSUMABLE_DEFINITIONS,
  DEFLECTOR_PULSE_COOLDOWN_SEC,
  DEFLECTOR_PULSE_RADIUS,
  ENEMY_PROJECTILE_SPEED,
  FLEET_DEFINITIONS,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  MANUAL_PULSE_COOLDOWN_SEC,
  MAX_SIMULTANEOUS_TARGETS,
  MAX_SIM_DT_SEC,
  PALETTE,
  PLANETS,
  PLAYER_PROJECTILE_SPEED,
  RANDOM_EVENT_DEFINITIONS,
  RESPAWN_DELAY_SEC,
  SHIELD_REGEN_DELAY_SEC,
  SHIP_X,
  SHIP_Y,
  STANCE_DEFINITIONS,
  TALENT_DEFINITIONS,
  TECH_TREE_NODES,
  UPGRADE_DEFINITIONS,
  createInitialSaveData,
  type AmbientMote,
  type CombatTarget,
  type ConsumableKey,
  type ContractType,
  type FleetShipKey,
  type HudSnapshot,
  type LaserBeam,
  type LinearUpgradeKey,
  type LootOrb,
  type OverdriveKey,
  type PlanetId,
  type Projectile,
  type RandomEventKey,
  type SaveDataV1,
  type ShipStance,
  type ShipStats,
  type Star,
  type TalentKey,
  type TechNodeKey,
  type UpgradeBuyAmount,
  type UpgradeKey,
} from './types';

export interface EngineCallbacks {
  onVictory?: (snapshot: HudSnapshot) => void;
  onImmediateSave?: () => void;
  onRankUp?: (choices: TalentKey[], newRank: number) => void;
}

export class SpaceGameEngine {
  private save: SaveDataV1;
  private callbacks: EngineCallbacks;

  private cascoActual: number;
  private escudoActual: number;
  private timeSinceLastHit = SHIELD_REGEN_DELAY_SEC;
  private shipHitFlash = 0;
  private shipAngle = -Math.PI / 2;

  private targets: CombatTarget[] = [];
  private projectiles: Projectile[] = [];
  private orbs: LootOrb[] = [];
  private beams: LaserBeam[] = [];
  private particleManager = new ParticleManager();
  private stars: Star[] = [];
  private ambientMotes: AmbientMote[] = [];
  private warpGrid: WarpNode[] = [];

  private nextEntityId = 1;
  private nextSpawnOrder = 1;
  private spawnCycleIndex = 0;
  private enemySpawnCount = 0;
  private respawnQueue: number[] = [];

  private lockedTargetId: number | null = null;
  private pointerLogicalX: number | null = null;
  private pointerLogicalY: number | null = null;
  private playerFireCooldown = 0;
  private shotCounter = 0;
  private droneFireCooldowns: number[] = [0, 0, 0];
  private droneOrbitAngle = 0;
  private fleetUnits: FleetUnitState[] = [];

  private orbCombo = 0;
  private orbComboTimer = 0;
  private pendingRankUp = false;

  private anomaliaActiva = false;
  private oleadaAnomalia = 1;
  private anomalyWaveKills = 0;

  private sobrecargaTimer = 0;
  private consumableCooldowns: Record<ConsumableKey, number> = {
    sobrecarga: 0,
    reparacion: 0,
    emp: 0,
  };
  private manualPulseCooldown = 0;
  private deflectorCooldown = 0;

  private hitstopTimer = 0;
  private shakeIntensity = 0;
  private bodegaLlenaAviso = false;
  private alertaTexto: string | null = null;
  private alertaTimer = 0;
  private periodicSaveTimer = 0;
  private visualTime = 0;

  private activeEvent: { key: RandomEventKey; remainingSec: number; durationSec: number } | null = null;
  private eventCooldownTimer = 18 + Math.random() * 12;
  private lastEventKey: RandomEventKey | null = null;
  private meteorStreaks: MeteorStreak[] = [];
  private sectorTransitionTimer = 0;
  private sectorTransitionColor: string = PALETTE.shipAndDrone;

  constructor(initialSave: SaveDataV1, callbacks: EngineCallbacks = {}) {
    this.save = structuredClone(initialSave);
    this.callbacks = callbacks;
    this.ensureActiveContract();

    const stats = this.getCurrentStats();
    this.cascoActual = stats.cascoMax;
    this.escudoActual = stats.escudoMax;
    spaceAudio.setMuted(this.save.silencio);

    this.stars = createInitialStars();
    this.ambientMotes = createInitialMotes();
    this.warpGrid = createWarpGrid();
    this.syncFleetUnits();
    this.seedPlanetTargets(true);
  }

  private getCurrentStats(): ShipStats {
    return getShipStats(
      this.save.mejoras,
      this.save.sobremarcha,
      this.save.flota,
      this.sobrecargaTimer > 0,
      this.save.tecnologia,
      this.save.talentos,
      this.save.prestigioNivel,
      this.activeEvent?.key ?? null,
      this.save.postura
    );
  }

  private ensureActiveContract(): void {
    if (!this.save.contratoActivo) {
      this.save.contratoActivo = createSectorContract(1, this.save.planetasDesbloqueados);
    }
  }

  private advanceContract(type: ContractType, amount: number, setExact = false): void {
    this.ensureActiveContract();
    const contract = this.save.contratoActivo;
    if (!contract || contract.type !== type) return;

    if (setExact) {
      contract.progreso = Math.max(contract.progreso, Math.min(contract.meta, amount));
    } else {
      contract.progreso = Math.min(contract.meta, contract.progreso + amount);
    }

    if (contract.progreso >= contract.meta) {
      this.save.creditos += contract.recompensaCreditos;
      this.save.estadisticas.creditosTotalesGanados += contract.recompensaCreditos;
      this.save.estadisticas.contratosCompletados += 1;
      if (contract.recompensaNucleos > 0) {
        this.save.nucleos += contract.recompensaNucleos;
        this.save.estadisticas.nucleosTotalesGanados += contract.recompensaNucleos;
      }

      const rewardLabel =
        contract.recompensaNucleos > 0
          ? `+${formatCredits(contract.recompensaCreditos)} y +${contract.recompensaNucleos} Núcleo`
          : `+${formatCredits(contract.recompensaCreditos)}`;

      this.showAlert(`Contrato completado: ${rewardLabel}`, 3.0);
      this.emitFloatingText(SHIP_X, SHIP_Y - 46, `Contrato ${rewardLabel}`, PALETTE.positive, 1.15);
      this.emitShockwave(SHIP_X, SHIP_Y, 88, PALETTE.positive, 2.2);
      spaceAudio.playContractComplete();

      this.save.contratoActivo = createSectorContract(
        contract.id + 1,
        this.save.planetasDesbloqueados
      );
    }
  }

  private syncFleetUnits(): void {
    const units: FleetUnitState[] = [];
    for (const def of FLEET_DEFINITIONS) {
      const count = this.save.flota[def.key] || 0;
      for (let i = 0; i < count; i++) {
        const existing = this.fleetUnits.find((u) => u.key === def.key && u.index === i);
        units.push({
          key: def.key,
          index: i,
          angle: existing ? existing.angle : (i / Math.max(1, count)) * Math.PI * 2 + def.radioOrbita * 0.1,
          cooldown: existing ? existing.cooldown : Math.random() * 0.5,
        });
      }
    }
    this.fleetUnits = units;
  }

  private seedPlanetTargets(initialInstant = false): void {
    this.targets = [];
    this.projectiles = [];
    this.beams = [];
    this.respawnQueue = [];
    this.lockedTargetId = null;
    this.spawnCycleIndex = 0;

    for (let i = 0; i < MAX_SIMULTANEOUS_TARGETS; i++) {
      this.spawnNextNormalTarget(initialInstant);
    }
  }

  private spawnNextNormalTarget(
    insideArena = false,
    forceKind?: 'asteroide' | 'enemigo'
  ): void {
    const { target, isEnemy } = createNormalTarget({
      id: this.nextEntityId++,
      spawnOrder: this.nextSpawnOrder++,
      planetId: this.save.planetaActual,
      anomaliaActiva: this.anomaliaActiva,
      oleadaAnomalia: this.oleadaAnomalia,
      spawnCycleIndex: this.spawnCycleIndex,
      enemySpawnCount: this.enemySpawnCount,
      insideArena,
      forceKind,
    });
    if (forceKind === undefined) {
      this.spawnCycleIndex++;
    }
    if (isEnemy && forceKind === undefined) {
      this.enemySpawnCount++;
    }
    this.targets.push(target);
  }

  private spawnBoss(isAnomalyBoss = false): void {
    const boss = createBossTarget({
      id: this.nextEntityId++,
      spawnOrder: this.nextSpawnOrder++,
      planetId: this.save.planetaActual,
      isAnomalyBoss,
      oleadaAnomalia: this.oleadaAnomalia,
    });

    this.targets = [boss];
    this.projectiles = [];
    this.respawnQueue = [];
    this.lockedTargetId = boss.id;
    this.showAlert(`Alerta de jefe: ${boss.name}`, 2.6);
    spaceAudio.playBossAlert();
  }

  private showAlert(text: string, duration = 2.2): void {
    this.alertaTexto = text;
    this.alertaTimer = duration;
  }

  private emitParticles(
    x: number,
    y: number,
    color: string,
    count: number,
    speedMax = 150,
    shape: 'circle' | 'shard' = 'circle'
  ): void {
    this.particleManager.emitParticles(x, y, color, count, speedMax, shape);
  }

  private emitShockwave(x: number, y: number, maxRadius: number, color: string, lineWidth = 2.5): void {
    this.particleManager.emitShockwave(x, y, maxRadius, color, lineWidth);
    applyWarpGridImpulse(this.warpGrid, x, y, Math.max(95, maxRadius * 1.45), Math.min(26, 6 + maxRadius * 0.14));
  }

  private emitFloatingText(x: number, y: number, text: string, color: string, scale = 1): void {
    this.particleManager.emitFloatingText(x, y, text, color, scale);
  }

  private hasActiveBoss(): boolean {
    return this.targets.some((t) => t.kind === 'jefe');
  }

  private getActiveTarget(): CombatTarget | null {
    if (this.lockedTargetId !== null) {
      const found = this.targets.find((t) => t.id === this.lockedTargetId);
      if (found) return found;
      this.lockedTargetId = null;
    }
    return selectAutoAimTarget(this.targets);
  }

  setPointerPosition(logicalX: number | null, logicalY: number | null): void {
    this.pointerLogicalX = logicalX;
    this.pointerLogicalY = logicalY;
  }

  setStance(postura: ShipStance): void {
    if (this.save.postura === postura) return;
    spaceAudio.unlockFromUserGesture();
    const prevStats = this.getCurrentStats();
    this.save.postura = postura;
    const nextStats = this.getCurrentStats();
    if (nextStats.escudoMax > prevStats.escudoMax) {
      this.escudoActual += nextStats.escudoMax - prevStats.escudoMax;
    }
    this.escudoActual = Math.min(this.escudoActual, nextStats.escudoMax);

    const def = STANCE_DEFINITIONS.find((s) => s.key === postura);
    if (def) {
      this.emitShockwave(SHIP_X, SHIP_Y, 56, def.color, 2);
    }
    spaceAudio.playUpgrade();
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
  }

  cycleTarget(): boolean {
    if (this.targets.length === 0) return false;
    spaceAudio.unlockFromUserGesture();

    const priorityRank = (t: CombatTarget) =>
      t.kind === 'jefe' ? 0 : t.kind === 'enemigo' ? (t.eliteTrait ? 1 : 2) : 3;

    const ordered = [...this.targets].sort((a, b) => {
      const pDiff = priorityRank(a) - priorityRank(b);
      if (pDiff !== 0) return pDiff;
      return a.spawnOrder - b.spawnOrder;
    });

    const curIdx =
      this.lockedTargetId !== null
        ? ordered.findIndex((t) => t.id === this.lockedTargetId)
        : -1;
    const nextTarget = ordered[(curIdx + 1) % ordered.length];
    if (!nextTarget) return false;

    this.lockedTargetId = nextTarget.id;
    this.emitParticles(nextTarget.x, nextTarget.y, PALETTE.shipAndDrone, 6, 85);
    spaceAudio.playHit(false);
    return true;
  }

  triggerDeflectorPulse(): boolean {
    spaceAudio.unlockFromUserGesture();
    if (this.deflectorCooldown > 0) return false;

    this.deflectorCooldown = DEFLECTOR_PULSE_COOLDOWN_SEC;
    const stats = this.getCurrentStats();
    let clearedCount = 0;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.fromPlayer) continue;
      const d = Math.hypot(p.x - SHIP_X, p.y - SHIP_Y);
      if (d <= DEFLECTOR_PULSE_RADIUS) {
        this.emitParticles(p.x, p.y, PALETTE.shield, 4, 80);
        this.projectiles.splice(i, 1);
        clearedCount += 1;
      }
    }

    for (const t of this.targets) {
      const d = Math.hypot(t.x - SHIP_X, t.y - SHIP_Y);
      if (d <= DEFLECTOR_PULSE_RADIUS + t.radius) {
        t.empStunTimer = Math.max(t.empStunTimer, 1.2);
        t.orbitRadius = Math.min(340, t.orbitRadius + 28);
      }
    }

    if (clearedCount > 0) {
      this.save.estadisticas.proyectilesDeflectados += clearedCount;
      const shieldGain = Math.round(stats.escudoMax * Math.min(0.24, clearedCount * 0.04));
      this.escudoActual = Math.min(stats.escudoMax, this.escudoActual + shieldGain);
      this.emitFloatingText(
        SHIP_X,
        SHIP_Y - 34,
        `Deflector: ${clearedCount} disp. (+${shieldGain} esc.)`,
        PALETTE.shield,
        1.0
      );

      if (this.save.tecnologia.escudoReflector && this.targets.length > 0) {
        const counterTarget = selectAutoAimTarget(this.targets);
        if (counterTarget) {
          const counterDmg = Math.round(stats.danoCanon * 1.1 * Math.min(3, clearedCount));
          this.beams.push({
            x1: SHIP_X,
            y1: SHIP_Y,
            x2: counterTarget.x,
            y2: counterTarget.y,
            color: PALETTE.shield,
            width: 3.4,
            life: 0.18,
            maxLife: 0.18,
          });
          this.particleManager.emitHitSparks(counterTarget.x, counterTarget.y, PALETTE.shield, true);
          this.applyDamageToTarget(counterTarget, counterDmg, counterTarget.x, counterTarget.y, false);
          spaceAudio.playDeflectorCounter();
        }
      }
    } else {
      this.emitFloatingText(SHIP_X, SHIP_Y - 34, 'Pulso deflector', PALETTE.shield, 0.95);
    }

    this.emitShockwave(SHIP_X, SHIP_Y, DEFLECTOR_PULSE_RADIUS, PALETTE.shield, 3.2);
    spaceAudio.playDeflectorPulse();
    return true;
  }

  private triggerRandomEvent(): void {
    const candidates = RANDOM_EVENT_DEFINITIONS.filter((d) => d.key !== this.lastEventKey);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)] || RANDOM_EVENT_DEFINITIONS[0];

    this.lastEventKey = chosen.key;
    this.activeEvent = {
      key: chosen.key,
      remainingSec: chosen.duracionSeg,
      durationSec: chosen.duracionSeg,
    };
    this.save.estadisticas.eventosCompletados += 1;

    spaceAudio.playEventStart(chosen.key === 'interferenciaMagnetica');
    this.emitShockwave(SHIP_X, SHIP_Y, 160, chosen.color, 2.5);
    this.showAlert(`Evento: ${chosen.nombre}`, 3.2);

    if (chosen.key === 'lluviaOro') {
      this.meteorStreaks = Array.from({ length: 14 }, () => ({
        x: Math.random() * (LOGICAL_WIDTH + 200),
        y: -40 - Math.random() * 240,
        vx: -260 - Math.random() * 140,
        vy: 280 + Math.random() * 140,
        len: 26 + Math.random() * 28,
      }));
      this.targets.push(
        createBonusEventAsteroid({
          id: this.nextEntityId++,
          spawnOrder: this.nextSpawnOrder++,
          planetId: this.save.planetaActual,
          anomaliaActiva: this.anomaliaActiva,
          oleadaAnomalia: this.oleadaAnomalia,
          name: 'Meteorito de oro',
          rewardMult: 2.4,
          coreDropCount: 0,
        })
      );
    } else if (chosen.key === 'fisuraNucleos') {
      this.targets.push(
        createBonusEventAsteroid({
          id: this.nextEntityId++,
          spawnOrder: this.nextSpawnOrder++,
          planetId: this.save.planetaActual,
          anomaliaActiva: this.anomaliaActiva,
          oleadaAnomalia: this.oleadaAnomalia,
          name: 'Cristal Estelar',
          rewardMult: 1.8,
          coreDropCount: 1,
        })
      );
    }
  }

  private spawnLootOrbs(target: CombatTarget): void {
    const planet = PLANETS[this.anomaliaActiva ? 4 : this.save.planetaActual];
    const orbCount =
      target.kind === 'jefe'
        ? 8
        : target.eliteTrait
          ? 5
          : target.kind === 'enemigo'
            ? 3
            : 2;

    const perOrbCredits = Math.max(1, Math.round(target.reward / orbCount));
    const perOrbXp = Math.max(1, Math.round(target.xpValue / orbCount));
    const orbKind = target.kind === 'asteroide' ? 'mineral' : 'valioso';
    const orbColor =
      target.kind === 'asteroide' ? planet.theme.asteroidVein : PALETTE.positive;

    for (let i = 0; i < orbCount; i++) {
      const angle = (i / orbCount) * Math.PI * 2 + Math.random() * 0.6;
      const speed = 70 + Math.random() * 95;
      this.orbs.push({
        id: this.nextEntityId++,
        kind: orbKind,
        x: target.x + Math.cos(angle) * 6,
        y: target.y + Math.sin(angle) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        credits: perOrbCredits,
        cores: 0,
        xp: perOrbXp,
        radius: target.kind === 'jefe' ? 7 : 5.5,
        color: orbColor,
        age: 0,
        magnetized: false,
      });
    }

    let coreDrops = target.coreDropCount;
    if (
      coreDrops === 0 &&
      target.kind === 'enemigo' &&
      !target.eliteTrait &&
      this.save.tecnologia.conversorEstelar &&
      Math.random() < 0.18
    ) {
      coreDrops = 1;
    }

    for (let c = 0; c < coreDrops; c++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 65;
      this.orbs.push({
        id: this.nextEntityId++,
        kind: 'nucleo',
        x: target.x,
        y: target.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        credits: 0,
        cores: 1,
        xp: 12,
        radius: 8,
        color: PALETTE.stellarCore,
        age: 0,
        magnetized: false,
      });
    }
  }

  private grantXp(amount: number): void {
    if (amount <= 0) return;
    this.save.xp += amount;
    this.checkPendingRankUp();
  }

  private checkPendingRankUp(): void {
    if (this.pendingRankUp) return;
    const needed = getXpForNextRank(this.save.rango);
    if (this.save.xp >= needed) {
      this.save.xp -= needed;
      this.save.rango += 1;
      this.pendingRankUp = true;

      const pool = [...TALENT_DEFINITIONS];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const choices = pool.slice(0, 3).map((t) => t.key);
      spaceAudio.playRankUp();
      this.emitShockwave(SHIP_X, SHIP_Y, 115, PALETTE.stellarCore, 3);
      this.emitFloatingText(SHIP_X, SHIP_Y - 42, `¡Rango ${this.save.rango}!`, PALETTE.stellarCore, 1.25);
      this.callbacks.onRankUp?.(choices, this.save.rango);
    }
  }

  chooseTalent(key: TalentKey): void {
    spaceAudio.unlockFromUserGesture();
    const prevStats = this.getCurrentStats();
    this.save.talentos[key] = (this.save.talentos[key] || 0) + 1;
    this.pendingRankUp = false;

    const nextStats = this.getCurrentStats();
    if (nextStats.escudoMax > prevStats.escudoMax) {
      this.escudoActual += nextStats.escudoMax - prevStats.escudoMax;
    }

    const def = TALENT_DEFINITIONS.find((t) => t.key === key);
    if (def) {
      this.showAlert(`Talento activo: ${def.nombre} (×${this.save.talentos[key]})`, 2.6);
      this.emitParticles(SHIP_X, SHIP_Y, def.color, 14, 150, 'shard');
    }
    spaceAudio.playUpgrade();
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    this.checkPendingRankUp();
  }

  private collectOrb(orb: LootOrb, stats: ShipStats): void {
    this.orbCombo = Math.min(12, this.orbCombo + 1);
    this.orbComboTimer = 1.65;
    if (this.orbCombo > this.save.estadisticas.mejorRachaOrbes) {
      this.save.estadisticas.mejorRachaOrbes = this.orbCombo;
    }
    this.advanceContract('orbes_racha', this.orbCombo, true);

    if (orb.xp > 0) {
      const xpGain =
        this.activeEvent?.key === 'fisuraNucleos' ? Math.round(orb.xp * 1.35) : orb.xp;
      this.grantXp(xpGain);
    }

    if (orb.cores > 0) {
      this.save.nucleos += orb.cores;
      this.save.estadisticas.nucleosTotalesGanados += orb.cores;
      this.emitFloatingText(
        SHIP_X + (Math.random() - 0.5) * 26,
        SHIP_Y - 34,
        `+${orb.cores} Núcleo`,
        PALETTE.stellarCore,
        1.15
      );
      spaceAudio.playOrbCollect(this.orbCombo - 1, true);
      return;
    }

    const effectiveCredits = Math.max(1, Math.round(orb.credits * stats.multBotin));
    if (this.save.mejoras.autoventa) {
      this.save.creditos += effectiveCredits;
      this.save.estadisticas.creditosTotalesGanados += effectiveCredits;
      this.bodegaLlenaAviso = false;
      this.emitFloatingText(
        SHIP_X + (Math.random() - 0.5) * 32,
        SHIP_Y - 26,
        `+${formatCredits(effectiveCredits)}`,
        PALETTE.positive,
        0.92
      );
    } else if (this.save.bodega.unidades < stats.capacidadBodega) {
      this.save.bodega.unidades += 1;
      this.save.bodega.valorCreditos += effectiveCredits;
      this.bodegaLlenaAviso = this.save.bodega.unidades >= stats.capacidadBodega;
      this.emitFloatingText(
        SHIP_X + (Math.random() - 0.5) * 28,
        SHIP_Y - 26,
        `+${effectiveCredits} cr`,
        orb.color,
        0.85
      );
    } else {
      this.bodegaLlenaAviso = true;
    }

    spaceAudio.playOrbCollect(this.orbCombo - 1, false);
  }

  private updateAmbientVisuals(dt: number): void {
    this.visualTime += dt;
    const planet = PLANETS[this.anomaliaActiva ? 4 : this.save.planetaActual];
    const style = planet.theme.ambientStyle;

    for (const star of this.stars) {
      star.x -= star.speed * dt;
      star.twinklePhase += star.twinkleSpeed * dt;
      if (star.x < 0) {
        star.x = LOGICAL_WIDTH;
        star.y = Math.random() * LOGICAL_HEIGHT;
      }
    }

    for (const mote of this.ambientMotes) {
      if (style === 'solar_embers') {
        mote.x += Math.sin(this.visualTime * 2 + mote.y * 0.02) * 14 * dt;
        mote.y -= 28 * dt;
      } else if (style === 'plasma_motes') {
        mote.x += Math.cos(this.visualTime + mote.y * 0.03) * 15 * dt;
        mote.y += Math.sin(this.visualTime + mote.x * 0.03) * 15 * dt;
      } else {
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
      }

      if (mote.x < -10) mote.x = LOGICAL_WIDTH + 10;
      if (mote.x > LOGICAL_WIDTH + 10) mote.x = -10;
      if (mote.y < -10) mote.y = LOGICAL_HEIGHT + 10;
      if (mote.y > LOGICAL_HEIGHT + 10) mote.y = -10;
    }
  }

  stepTitleBackdrop(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), MAX_SIM_DT_SEC);
    this.updateAmbientVisuals(dt);
    updateWarpGrid(this.warpGrid, dt);
    for (const t of this.targets) {
      t.orbitAngle += t.orbitSpeed * 0.45 * dt;
      t.orbitRadius += (t.desiredOrbitRadius - t.orbitRadius) * Math.min(1, dt * 1.5);
      t.x = SHIP_X + Math.cos(t.orbitAngle) * t.orbitRadius * 1.25;
      t.y = SHIP_Y + Math.sin(t.orbitAngle) * t.orbitRadius * 0.88;
      t.rotation += t.rotSpeed * dt;
    }
    this.droneOrbitAngle += 1.4 * dt;
  }

  step(rawDt: number): void {
    const dt = Math.min(Math.max(rawDt, 0), MAX_SIM_DT_SEC);
    this.save.tiempoJugadoSegundos += dt;

    this.periodicSaveTimer += dt;
    if (this.periodicSaveTimer >= 10) {
      this.periodicSaveTimer = 0;
      persistSaveData(this.save);
    }

    if (this.orbComboTimer > 0) {
      this.orbComboTimer -= dt;
      if (this.orbComboTimer <= 0) {
        this.orbCombo = 0;
      }
    }

    if (this.shakeIntensity > 0) {
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 30);
    }
    if (this.shipHitFlash > 0) {
      this.shipHitFlash = Math.max(0, this.shipHitFlash - dt * 5);
    }
    if (this.alertaTimer > 0) {
      this.alertaTimer -= dt;
      if (this.alertaTimer <= 0) this.alertaTexto = null;
    }
    if (this.sectorTransitionTimer > 0) {
      this.sectorTransitionTimer = Math.max(0, this.sectorTransitionTimer - dt * 2.2);
    }
    if (this.sobrecargaTimer > 0) {
      this.sobrecargaTimer = Math.max(0, this.sobrecargaTimer - dt);
    }
    if (this.manualPulseCooldown > 0) {
      this.manualPulseCooldown = Math.max(0, this.manualPulseCooldown - dt);
    }
    if (this.deflectorCooldown > 0) {
      this.deflectorCooldown = Math.max(0, this.deflectorCooldown - dt);
    }
    for (const key of ['sobrecarga', 'reparacion', 'emp'] as ConsumableKey[]) {
      if (this.consumableCooldowns[key] > 0) {
        this.consumableCooldowns[key] = Math.max(0, this.consumableCooldowns[key] - dt);
      }
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) {
        this.beams.splice(i, 1);
      }
    }

    if (this.activeEvent) {
      this.activeEvent.remainingSec -= dt;
      if (this.activeEvent.key === 'lluviaOro') {
        for (const m of this.meteorStreaks) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.y > LOGICAL_HEIGHT + 40 || m.x < -60) {
            m.x = Math.random() * (LOGICAL_WIDTH + 220);
            m.y = -30 - Math.random() * 80;
          }
        }
      }
      if (this.activeEvent.remainingSec <= 0) {
        this.activeEvent = null;
        this.meteorStreaks = [];
        this.eventCooldownTimer = 30 + Math.random() * 16;
      }
    } else {
      this.eventCooldownTimer -= dt;
      if (this.eventCooldownTimer <= 0) {
        this.triggerRandomEvent();
      }
    }

    // Keep VFX, warp grid & starfield smooth even during combat hitstop (game-feel isolation)
    this.updateAmbientVisuals(dt);
    updateWarpGrid(this.warpGrid, dt);
    this.particleManager.update(dt);

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    const stats = this.getCurrentStats();
    const roundedDps = Math.round(stats.dpsTotal * 10) / 10;
    if (roundedDps > this.save.estadisticas.mejorDps) {
      this.save.estadisticas.mejorDps = roundedDps;
    }

    this.timeSinceLastHit += dt;
    if (this.escudoActual < stats.escudoMax) {
      const regenRate =
        this.timeSinceLastHit >= SHIELD_REGEN_DELAY_SEC
          ? stats.regenFueraCombatePorSeg
          : stats.regenCombatePorSeg;
      this.escudoActual = Math.min(stats.escudoMax, this.escudoActual + regenRate * dt);
    }

    if (!this.hasActiveBoss()) {
      for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
        this.respawnQueue[i] -= dt;
        if (this.respawnQueue[i] <= 0) {
          this.respawnQueue.splice(i, 1);
          if (this.targets.length < MAX_SIMULTANEOUS_TARGETS) {
            this.spawnNextNormalTarget(false);
          }
        }
      }
    }

    const targetsSnapshot = [...this.targets];
    for (const t of targetsSnapshot) {
      const prevX = t.x;
      const prevY = t.y;

      const approachRate = t.kind === 'jefe' ? 1.4 : t.kind === 'enemigo' ? 1.6 : 0.85;
      t.orbitRadius += (t.desiredOrbitRadius - t.orbitRadius) * Math.min(1, dt * approachRate);
      t.orbitAngle += t.orbitSpeed * dt;

      const weave =
        t.eliteTrait === 'veloz'
          ? Math.sin(this.visualTime * 2.8 + t.spawnOrder) * 32
          : t.kind === 'enemigo'
            ? Math.sin(this.visualTime * 2.2 + t.spawnOrder) * 14
            : 0;
      const nextX = SHIP_X + Math.cos(t.orbitAngle) * (t.orbitRadius + weave) * 1.24;
      const nextY = SHIP_Y + Math.sin(t.orbitAngle) * (t.orbitRadius + weave) * 0.86;

      if (t.orbitRadius < 280) {
        t.x = Math.max(46, Math.min(LOGICAL_WIDTH - 46, nextX));
        t.y = Math.max(72, Math.min(LOGICAL_HEIGHT - 44, nextY));
      } else {
        t.x = nextX;
        t.y = nextY;
      }

      t.vx = dt > 0 ? (t.x - prevX) / dt : 0;
      t.vy = dt > 0 ? (t.y - prevY) / dt : 0;

      if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 6);
      if (t.empStunTimer > 0) t.empStunTimer = Math.max(0, t.empStunTimer - dt);

      if (t.kind === 'asteroide') {
        t.rotation += t.rotSpeed * dt;
      } else {
        t.rotation = Math.atan2(SHIP_Y - t.y, SHIP_X - t.x);

        if (t.empStunTimer <= 0) {
          const enemyCooldownScale = this.activeEvent?.key === 'tormentaIonica' ? 0.65 : 1;
          t.fireCooldown -= dt * enemyCooldownScale;
          t.telegraph = t.fireCooldown <= 0.38 ? Math.max(0, 1 - t.fireCooldown / 0.38) : 0;

          if (t.fireCooldown <= 0) {
            const isPhase2Boss = t.kind === 'jefe' && t.hp < t.maxHp * 0.5;
            t.fireCooldown += t.fireInterval * (isPhase2Boss && t.bossPlanetId === 3 ? 0.85 : 1);
            t.telegraph = 0;

            if (t.kind === 'jefe') {
              const bossShots = spawnBossAttackProjectiles(t, () => this.nextEntityId++);
              this.projectiles.push(...bossShots);

              if ((t.bossPlanetId === 4 || this.anomaliaActiva) && t.hp < t.maxHp * 0.55 && !t.bossSummonedEscorts) {
                t.bossSummonedEscorts = true;
                this.spawnNextNormalTarget(false, 'enemigo');
                this.spawnNextNormalTarget(false, 'enemigo');
                this.showAlert('El jefe despliega escoltas de ataque', 2.4);
              }
            } else {
              const angle = Math.atan2(SHIP_Y - t.y, SHIP_X - t.x);
              const activeTheme = PLANETS[this.anomaliaActiva ? 4 : this.save.planetaActual].theme;
              this.projectiles.push({
                id: this.nextEntityId++,
                fromPlayer: false,
                sourceKind: 'enemy',
                x: t.x + Math.cos(angle) * (t.radius + 4),
                y: t.y + Math.sin(angle) * (t.radius + 4),
                vx: Math.cos(angle) * ENEMY_PROJECTILE_SPEED,
                vy: Math.sin(angle) * ENEMY_PROJECTILE_SPEED,
                damage: t.damage,
                radius: t.eliteTrait === 'sobrecargado' ? 5.5 : 4,
                color: t.eliteTrait ? '#FBBF24' : activeTheme.enemyAccent,
                targetId: null,
                life: 4.0,
              });
            }
          }
        } else {
          t.telegraph = 0;
        }
      }
    }

    const activeTarget = this.getActiveTarget();
    if (activeTarget) {
      const lead = computeInterceptVelocity(
        SHIP_X,
        SHIP_Y,
        activeTarget.x,
        activeTarget.y,
        activeTarget.vx,
        activeTarget.vy,
        PLAYER_PROJECTILE_SPEED
      );
      let diff = lead.angle - this.shipAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.shipAngle += diff * Math.min(1, dt * 16);
    }

    this.playerFireCooldown -= dt;
    if (activeTarget && this.playerFireCooldown <= 0) {
      const firePeriod = 1 / stats.cadencia;
      this.playerFireCooldown = Math.max(0, this.playerFireCooldown + firePeriod);
      this.shotCounter++;

      const lead = computeInterceptVelocity(
        SHIP_X,
        SHIP_Y,
        activeTarget.x,
        activeTarget.y,
        activeTarget.vx,
        activeTarget.vy,
        PLAYER_PROJECTILE_SPEED
      );

      if (this.save.tecnologia.hazDesintegrador && this.shotCounter % 6 === 0) {
        const beamDmg = Math.round(stats.danoCanon * 3);
        const noseX = SHIP_X + Math.cos(this.shipAngle) * 22;
        const noseY = SHIP_Y + Math.sin(this.shipAngle) * 22;
        this.beams.push({
          x1: noseX,
          y1: noseY,
          x2: activeTarget.x,
          y2: activeTarget.y,
          color: '#E879F9',
          width: 4.5,
          life: 0.22,
          maxLife: 0.22,
        });
        this.emitShockwave(activeTarget.x, activeTarget.y, 34, '#E879F9', 2);
        this.applyDamageToTarget(activeTarget, beamDmg, activeTarget.x, activeTarget.y, true);
        spaceAudio.playLaserBeam();
      } else {
        const count = stats.proyectilesPorDisparo;
        const isPlasma = this.save.mejoras.danoCanon >= 15;
        const baseColor =
          this.sobrecargaTimer > 0
            ? PALETTE.warning
            : this.save.postura === 'asalto'
              ? PALETTE.enemy
              : isPlasma
                ? '#67E8F9'
                : PALETTE.shipAndDrone;
        const bounceCount = this.save.tecnologia.rebotes ? 1 : 0;

        for (let s = 0; s < count; s++) {
          const isCrit = Math.random() < stats.probCritico;
          const dmg = isCrit ? Math.round(stats.danoCanon * stats.multCritico) : stats.danoCanon;

          let spawnX = SHIP_X + Math.cos(lead.angle) * 20;
          let spawnY = SHIP_Y + Math.sin(lead.angle) * 20;
          let shotAngle = lead.angle;

          if (count === 2) {
            const perpAngle = lead.angle + Math.PI / 2;
            const lateral = s === 0 ? -7 : 7;
            spawnX += Math.cos(perpAngle) * lateral;
            spawnY += Math.sin(perpAngle) * lateral;
          } else if (count === 3) {
            shotAngle += (s - 1) * 0.08;
          }

          this.projectiles.push({
            id: this.nextEntityId++,
            fromPlayer: true,
            sourceKind: 'ship',
            x: spawnX,
            y: spawnY,
            vx: Math.cos(shotAngle) * PLAYER_PROJECTILE_SPEED,
            vy: Math.sin(shotAngle) * PLAYER_PROJECTILE_SPEED,
            damage: dmg,
            isCrit,
            bounceCount,
            hitTargetIds: bounceCount > 0 ? [] : undefined,
            radius: isCrit ? 4.8 : isPlasma ? 4 : 3.5,
            color: isCrit ? PALETTE.warning : baseColor,
            targetId: activeTarget.id,
            life: 2.0,
          });
        }
        spaceAudio.playShoot(false);
      }
    } else if (!activeTarget && this.playerFireCooldown < 0) {
      this.playerFireCooldown = 0;
    }

    this.droneOrbitAngle += 1.65 * dt;
    const droneCount = stats.cantidadDrones;
    if (droneCount > 0) {
      for (let d = 0; d < droneCount; d++) {
        const angleOffset = (d / droneCount) * Math.PI * 2;
        const dx = SHIP_X + Math.cos(this.droneOrbitAngle + angleOffset) * 44;
        const dy = SHIP_Y + Math.sin(this.droneOrbitAngle + angleOffset) * 44;
        this.droneFireCooldowns[d] -= dt;

        if (activeTarget && this.droneFireCooldowns[d] <= 0) {
          this.droneFireCooldowns[d] = Math.max(0, this.droneFireCooldowns[d] + 1 / stats.cadenciaDron);
          const lead = computeInterceptVelocity(
            dx,
            dy,
            activeTarget.x,
            activeTarget.y,
            activeTarget.vx,
            activeTarget.vy,
            PLAYER_PROJECTILE_SPEED
          );
          this.projectiles.push({
            id: this.nextEntityId++,
            fromPlayer: true,
            sourceKind: 'drone',
            x: dx + Math.cos(lead.angle) * 10,
            y: dy + Math.sin(lead.angle) * 10,
            vx: lead.vx,
            vy: lead.vy,
            damage: stats.danoDron,
            splashRadius: this.save.mejoras.dronApoyo >= 10 ? 42 : undefined,
            radius: this.save.mejoras.dronApoyo >= 10 ? 4 : 3.2,
            color: this.save.mejoras.dronApoyo >= 10 ? PALETTE.warning : PALETTE.shield,
            targetId: activeTarget.id,
            life: 2.0,
          });
          if (d === 0) spaceAudio.playShoot(true);
        } else if (!activeTarget && this.droneFireCooldowns[d] < 0) {
          this.droneFireCooldowns[d] = 0;
        }
      }
    }

    const fleetMult = getFleetDamageMultiplier(
      this.save.tecnologia,
      this.save.talentos,
      this.save.prestigioNivel,
      this.sobrecargaTimer > 0,
      this.save.postura
    );

    for (const unit of this.fleetUnits) {
      const def = FLEET_DEFINITIONS.find((f) => f.key === unit.key)!;
      const orbitSpeed = unit.key === 'caza' ? 1.15 : unit.key === 'corbeta' ? -0.75 : 0.45;
      unit.angle += orbitSpeed * dt;
      unit.cooldown -= dt;

      const fx = SHIP_X + Math.cos(unit.angle) * def.radioOrbita;
      const fy = SHIP_Y + Math.sin(unit.angle) * def.radioOrbita;

      const fleetTarget = activeTarget || selectAutoAimTarget(this.targets);
      if (fleetTarget && unit.cooldown <= 0) {
        unit.cooldown += 1 / def.cadencia;
        const projSpeed = unit.key === 'corbeta' ? 860 : unit.key === 'fragata' ? 560 : 760;
        const lead = computeInterceptVelocity(
          fx,
          fy,
          fleetTarget.x,
          fleetTarget.y,
          fleetTarget.vx,
          fleetTarget.vy,
          projSpeed
        );

        this.projectiles.push({
          id: this.nextEntityId++,
          fromPlayer: true,
          sourceKind: 'fleet',
          fleetKind: unit.key,
          x: fx + Math.cos(lead.angle) * 11,
          y: fy + Math.sin(lead.angle) * 11,
          vx: lead.vx,
          vy: lead.vy,
          damage: Math.round(def.danoBase * fleetMult),
          splashRadius: unit.key === 'fragata' ? 68 : undefined,
          pierceCount: unit.key === 'corbeta' ? 2 : undefined,
          hitTargetIds: unit.key === 'corbeta' ? [] : undefined,
          radius: unit.key === 'fragata' ? 5 : unit.key === 'corbeta' ? 4 : 3,
          color: def.color,
          targetId: fleetTarget.id,
          life: 2.2,
        });
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (p.fromPlayer && p.targetId !== null && p.sourceKind !== 'fleet') {
        const tgt = this.targets.find((t) => t.id === p.targetId);
        if (tgt) {
          const speed = Math.hypot(p.vx, p.vy);
          const desiredAngle = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          const curAngle = Math.atan2(p.vy, p.vx);
          let diff = desiredAngle - curAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const adjusted = curAngle + diff * Math.min(1, dt * 8);
          p.vx = Math.cos(adjusted) * speed;
          p.vy = Math.sin(adjusted) * speed;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (
        p.life <= 0 ||
        p.x < -60 ||
        p.x > LOGICAL_WIDTH + 60 ||
        p.y < -60 ||
        p.y > LOGICAL_HEIGHT + 60
      ) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        let hitTarget: CombatTarget | null = null;
        for (const t of this.targets) {
          if (p.hitTargetIds && p.hitTargetIds.includes(t.id)) continue;
          const dist = Math.hypot(p.x - t.x, p.y - t.y);
          if (dist <= t.radius + p.radius + 2) {
            hitTarget = t;
            break;
          }
        }
        if (hitTarget) {
          if (p.splashRadius) {
            this.emitShockwave(p.x, p.y, p.splashRadius, p.color, 2);
            const splashTargets = [...this.targets];
            for (const st of splashTargets) {
              const d = Math.hypot(st.x - p.x, st.y - p.y);
              if (d <= p.splashRadius + st.radius) {
                const factor = st.id === hitTarget.id ? 1 : 0.55;
                this.applyDamageToTarget(st, Math.round(p.damage * factor), p.x, p.y, Boolean(p.isCrit));
              }
            }
            this.projectiles.splice(i, 1);
          } else {
            this.applyDamageToTarget(hitTarget, p.damage, p.x, p.y, Boolean(p.isCrit));
            if (p.pierceCount && p.pierceCount > 1 && p.hitTargetIds) {
              p.pierceCount -= 1;
              p.hitTargetIds.push(hitTarget.id);
            } else if (p.bounceCount && p.bounceCount > 0 && p.hitTargetIds) {
              p.bounceCount -= 1;
              p.hitTargetIds.push(hitTarget.id);
              let nextBounce: CombatTarget | null = null;
              let bestDist = 260;
              for (const cand of this.targets) {
                if (p.hitTargetIds.includes(cand.id)) continue;
                const d = Math.hypot(cand.x - p.x, cand.y - p.y);
                if (d < bestDist) {
                  bestDist = d;
                  nextBounce = cand;
                }
              }
              if (nextBounce) {
                const speed = Math.hypot(p.vx, p.vy);
                const angle = Math.atan2(nextBounce.y - p.y, nextBounce.x - p.x);
                p.vx = Math.cos(angle) * speed;
                p.vy = Math.sin(angle) * speed;
                p.targetId = nextBounce.id;
                p.damage = Math.max(1, Math.round(p.damage * 0.85));
                p.life = Math.max(p.life, 0.8);
              } else {
                this.projectiles.splice(i, 1);
              }
            } else {
              this.projectiles.splice(i, 1);
            }
          }
        }
      } else {
        const distToShip = Math.hypot(p.x - SHIP_X, p.y - SHIP_Y);
        if (distToShip <= 19 + p.radius) {
          this.projectiles.splice(i, 1);
          const mitigated = Math.max(1, Math.round(p.damage * (1 - stats.reduccionDano)));
          this.applyDamageToPlayer(mitigated);
        }
      }
    }

    const pullAccel = this.save.tecnologia.imanCuantico ? 980 : 620;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.age += dt;

      const sweepRadius = this.activeEvent?.key === 'interferenciaMagnetica' ? 145 : 115;
      if (this.pointerLogicalX !== null && this.pointerLogicalY !== null) {
        const cursorDist = Math.hypot(orb.x - this.pointerLogicalX, orb.y - this.pointerLogicalY);
        if (cursorDist <= sweepRadius) {
          orb.magnetized = true;
        }
      }

      const dx = SHIP_X - orb.x;
      const dy = SHIP_Y - orb.y;
      const dist = Math.hypot(dx, dy);

      if (orb.age >= 0.18 && (dist <= stats.radioIman || (orb.kind === 'nucleo' && orb.age > 2.2) || orb.age > 5.0)) {
        orb.magnetized = true;
      }

      if (orb.magnetized && dist > 1) {
        const pullSpeed = 260 + Math.min(460, orb.age * pullAccel * 0.45);
        orb.vx += ((dx / dist) * pullSpeed - orb.vx) * Math.min(1, dt * 8.5);
        orb.vy += ((dy / dist) * pullSpeed - orb.vy) * Math.min(1, dt * 8.5);
      } else {
        const damping = Math.pow(0.08, dt);
        orb.vx *= damping;
        orb.vy *= damping;
      }

      orb.x = Math.max(16, Math.min(LOGICAL_WIDTH - 16, orb.x + orb.vx * dt));
      orb.y = Math.max(16, Math.min(LOGICAL_HEIGHT - 16, orb.y + orb.vy * dt));

      if (Math.hypot(SHIP_X - orb.x, SHIP_Y - orb.y) <= 24) {
        this.orbs.splice(i, 1);
        this.collectOrb(orb, stats);
      }
    }
  }

  private applyDamageToTarget(
    target: CombatTarget,
    damage: number,
    hitX: number,
    hitY: number,
    isCrit = false
  ): void {
    const effectiveDamage =
      target.eliteTrait === 'blindado' && !isCrit && damage > 1
        ? Math.max(1, Math.round(damage * 0.85))
        : damage;
    target.hp -= effectiveDamage;
    target.hitFlash = 1;

    const planet = PLANETS[this.anomaliaActiva ? 4 : this.save.planetaActual];
    this.particleManager.emitHitSparks(
      hitX,
      hitY,
      target.kind === 'asteroide' ? planet.theme.asteroidVein : PALETTE.shipAndDrone,
      isCrit
    );
    this.particleManager.emitDamageNumber(hitX, hitY, effectiveDamage, isCrit);

    if (target.hp > 0) {
      if (target.kind === 'jefe' && target.hp < target.maxHp * 0.5 && !target.bossPhase2Triggered) {
        target.bossPhase2Triggered = true;
        this.emitShockwave(target.x, target.y, 135, PALETTE.warning, 3.2);
        applyWarpGridImpulse(this.warpGrid, target.x, target.y, 210, 26);
        this.shakeIntensity = Math.max(this.shakeIntensity, 5.5);
        this.emitFloatingText(target.x, target.y - target.radius - 16, 'FASE 2', PALETTE.warning, 1.2);
        this.showAlert(`${target.name}: ¡Fase 2 activa!`, 2.6);
        spaceAudio.playBossPhase2();
      } else {
        spaceAudio.playHit(isCrit);
      }
      return;
    }

    const idx = this.targets.findIndex((t) => t.id === target.id);
    if (idx !== -1) this.targets.splice(idx, 1);
    if (this.lockedTargetId === target.id) this.lockedTargetId = null;

    if (target.kind === 'jefe') {
      this.particleManager.emitBossExplosion(target.x, target.y, PALETTE.boss);
      applyWarpGridImpulse(this.warpGrid, target.x, target.y, 290, 34);
    } else if (target.kind === 'enemigo') {
      this.particleManager.emitEnemyExplosion(
        target.x,
        target.y,
        target.eliteTrait ? '#FFD600' : planet.theme.enemyAccent
      );
      applyWarpGridImpulse(
        this.warpGrid,
        target.x,
        target.y,
        target.eliteTrait ? 190 : 140,
        target.eliteTrait ? 22 : 14
      );
    } else {
      this.particleManager.emitAsteroidExplosion(
        target.x,
        target.y,
        planet.theme.asteroidShade,
        planet.theme.asteroidVein
      );
      applyWarpGridImpulse(this.warpGrid, target.x, target.y, 125, 11);
    }

    spaceAudio.playDestroy(target.kind !== 'asteroide');

    if (target.kind === 'jefe') {
      this.hitstopTimer = 0.065;
      this.shakeIntensity = 10;
      this.spawnLootOrbs(target);
      this.handleBossDefeated(target);
      return;
    }

    if (target.kind === 'enemigo') {
      this.shakeIntensity = Math.max(this.shakeIntensity, target.eliteTrait ? 4.2 : 2.2);
      this.save.estadisticas.enemigosDestruidos += 1;
      this.advanceContract('enemigos', 1);
      if (target.eliteTrait) {
        this.save.estadisticas.elitesDestruidos += 1;
        this.advanceContract('elites', 1);
      }
    } else {
      this.save.estadisticas.asteroidesDestruidos += 1;
      this.advanceContract('asteroides', 1);
    }

    this.save.estadisticas.objetivosDestruidos += 1;

    if (this.anomaliaActiva) {
      this.anomalyWaveKills += 1;
      if (this.anomalyWaveKills >= 15) {
        this.anomalyWaveKills = 0;
        this.oleadaAnomalia += 1;
        this.save.maxOleadaAnomalia = Math.max(this.save.maxOleadaAnomalia, this.oleadaAnomalia);
        this.showAlert(`Anomalía · Oleada ${this.oleadaAnomalia}`, 2.6);
        if (this.oleadaAnomalia % 3 === 0) {
          this.spawnLootOrbs(target);
          this.spawnBoss(true);
          return;
        }
      }
    } else {
      this.save.objetivosPorPlaneta[this.save.planetaActual] += 1;
    }

    this.spawnLootOrbs(target);

    if (!this.hasActiveBoss()) {
      this.respawnQueue.push(RESPAWN_DELAY_SEC);
    }
  }

  private handleBossDefeated(boss: CombatTarget): void {
    const planetId = this.save.planetaActual;
    const isAnomalyBoss = this.anomaliaActiva;
    const prestigeLootMult = getPrestigeLootMultiplier(this.save.prestigioNivel);
    const directBonus = Math.round(boss.reward * 0.4 * prestigeLootMult);

    this.save.creditos += directBonus;
    this.save.estadisticas.creditosTotalesGanados += directBonus;
    this.save.estadisticas.jefesDerrotados += 1;

    if (!isAnomalyBoss) {
      const isFirstTimePlanetClear = planetId === this.save.planetasDesbloqueados && planetId < 4;
      if (isFirstTimePlanetClear) {
        this.save.planetasDesbloqueados = (planetId + 1) as PlanetId;
        this.showAlert(`Planeta ${planetId + 1} desbloqueado: ${PLANETS[(planetId + 1) as PlanetId].nombre}`, 3.5);
      } else {
        this.showAlert(`${boss.name} derrotado: +${formatCredits(directBonus)} y núcleos`, 3.0);
      }
      if (planetId === 4) {
        this.save.anomaliaDesbloqueada = true;
      }
    } else {
      this.showAlert(`${boss.name} eliminado · Oleada ${this.oleadaAnomalia}`, 3.0);
    }

    this.emitFloatingText(boss.x, boss.y - 18, `+${formatCredits(directBonus)}`, PALETTE.positive, 1.25);

    for (let i = 0; i < MAX_SIMULTANEOUS_TARGETS; i++) {
      this.respawnQueue.push(RESPAWN_DELAY_SEC * (i + 1) * 0.4);
    }

    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();

    if (!isAnomalyBoss && planetId === 4) {
      spaceAudio.playVictory();
      this.callbacks.onVictory?.(this.getSnapshot());
    }
  }

  private applyDamageToPlayer(damage: number): void {
    this.timeSinceLastHit = 0;
    this.shipHitFlash = 1;
    this.shakeIntensity = Math.min(9, this.shakeIntensity + 3.5);
    spaceAudio.playPlayerHit();

    let remaining = damage;
    let absorbedByShield = 0;
    if (this.escudoActual > 0) {
      absorbedByShield = Math.min(this.escudoActual, remaining);
      this.escudoActual -= absorbedByShield;
      remaining -= absorbedByShield;
      this.emitParticles(SHIP_X, SHIP_Y, PALETTE.shield, 5, 95);
    }

    if (absorbedByShield > 0 && this.save.tecnologia.escudoReflector && this.targets.length > 0) {
      const reflectTarget = selectAutoAimTarget(this.targets);
      if (reflectTarget) {
        const stats = this.getCurrentStats();
        const reflectDmg = Math.round(stats.danoCanon * 1.5);
        this.beams.push({
          x1: SHIP_X,
          y1: SHIP_Y,
          x2: reflectTarget.x,
          y2: reflectTarget.y,
          color: PALETTE.shield,
          width: 2.8,
          life: 0.16,
          maxLife: 0.16,
        });
        this.particleManager.emitHitSparks(reflectTarget.x, reflectTarget.y, PALETTE.shield, false);
        this.applyDamageToTarget(reflectTarget, reflectDmg, reflectTarget.x, reflectTarget.y, false);
        spaceAudio.playDeflectorCounter();
      }
    }

    if (remaining > 0) {
      this.cascoActual = Math.max(0, this.cascoActual - remaining);
      this.emitParticles(SHIP_X, SHIP_Y, PALETTE.boss, 6, 115);
    }

    if (this.cascoActual <= 0) {
      const stats = this.getCurrentStats();
      const wasBossActive = this.hasActiveBoss();
      this.cascoActual = stats.cascoMax;
      this.escudoActual = stats.escudoMax;
      this.timeSinceLastHit = SHIELD_REGEN_DELAY_SEC;
      this.hitstopTimer = 0.055;
      this.shakeIntensity = 9;
      this.projectiles = [];
      this.lockedTargetId = null;

      this.emitShockwave(SHIP_X, SHIP_Y, 95, PALETTE.shield, 3);
      if (wasBossActive) {
        this.seedPlanetTargets(true);
        this.showAlert('Nave reparada · Combate contra jefe reiniciado', 3.0);
      } else {
        this.showAlert('Nave reparada al 100 % en el sector actual', 2.5);
      }

      this.emitFloatingText(SHIP_X, SHIP_Y - 30, 'Nave reparada', PALETTE.shield, 1.1);
      persistSaveData(this.save);
      this.callbacks.onImmediateSave?.();
    }
  }

  handlePointerDown(logicalX: number, logicalY: number): void {
    spaceAudio.unlockFromUserGesture();

    let clickedTarget: CombatTarget | null = null;
    let bestClickDist = Infinity;

    for (const t of this.targets) {
      const dist = Math.hypot(logicalX - t.x, logicalY - t.y);
      const hitRadius = t.radius + 14;
      if (dist <= hitRadius && dist < bestClickDist) {
        bestClickDist = dist;
        clickedTarget = t;
      }
    }

    if (clickedTarget) {
      this.lockedTargetId = clickedTarget.id;
      this.emitParticles(clickedTarget.x, clickedTarget.y, PALETTE.shipAndDrone, 5, 75);

      if (this.manualPulseCooldown <= 0) {
        this.manualPulseCooldown = MANUAL_PULSE_COOLDOWN_SEC;
        this.save.estadisticas.pulsosManuales += 1;
        this.advanceContract('bajas_manuales', 1);

        const stats = this.getCurrentStats();
        const lead = computeInterceptVelocity(
          SHIP_X,
          SHIP_Y,
          clickedTarget.x,
          clickedTarget.y,
          clickedTarget.vx,
          clickedTarget.vy,
          PLAYER_PROJECTILE_SPEED * 1.25
        );
        const manualMult = this.activeEvent?.key === 'tormentaIonica' ? 2.2 : 1.45;
        this.projectiles.push({
          id: this.nextEntityId++,
          fromPlayer: true,
          sourceKind: 'manual',
          x: SHIP_X + Math.cos(lead.angle) * 20,
          y: SHIP_Y + Math.sin(lead.angle) * 20,
          vx: lead.vx,
          vy: lead.vy,
          damage: Math.round(stats.danoCanon * manualMult),
          isCrit: true,
          radius: this.activeEvent?.key === 'tormentaIonica' ? 6.5 : 5,
          color: this.activeEvent?.key === 'tormentaIonica' ? '#FBBF24' : '#7DD3FC',
          targetId: clickedTarget.id,
          life: 1.8,
        });
        this.emitShockwave(SHIP_X, SHIP_Y, 34, this.activeEvent?.key === 'tormentaIonica' ? '#FBBF24' : '#38BDF8', 1.5);
        spaceAudio.playManualPulse();
      }
    } else {
      this.lockedTargetId = null;
    }
  }

  sellAllCargo(): void {
    spaceAudio.unlockFromUserGesture();
    if (this.save.bodega.unidades <= 0 && this.save.bodega.valorCreditos <= 0) return;

    const earned = this.save.bodega.valorCreditos;
    this.save.creditos += earned;
    this.save.estadisticas.creditosTotalesGanados += earned;
    this.save.bodega.unidades = 0;
    this.save.bodega.valorCreditos = 0;
    this.bodegaLlenaAviso = false;

    this.emitFloatingText(SHIP_X, SHIP_Y - 36, `+${formatCredits(earned)}`, PALETTE.positive, 1.15);
    spaceAudio.playSell();
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
  }

  buyUpgrade(key: UpgradeKey, amount: UpgradeBuyAmount = 1): boolean {
    spaceAudio.unlockFromUserGesture();
    const def = UPGRADE_DEFINITIONS.find((u) => u.key === key);
    if (!def) return false;

    const prevStats = this.getCurrentStats();
    const maxSteps = def.tipo === 'Único' ? 1 : amount === 'max' ? 50 : amount;
    let purchased = 0;
    let highestMilestone: { nivel: number; titulo: string; efecto: string } | null = null;

    for (let i = 0; i < maxSteps; i++) {
      const currentLevel = getUpgradeLevel(this.save.mejoras, key);
      const overdriveLevel = isOverdriveSupported(key)
        ? this.save.sobremarcha[key as OverdriveKey]
        : 0;
      const cost = getUpgradeCost(key, currentLevel, overdriveLevel);
      if (cost === null || this.save.creditos < cost) break;

      this.save.creditos -= cost;
      purchased += 1;

      if (key === 'autoventa') {
        this.save.mejoras.autoventa = true;
        if (this.save.bodega.valorCreditos > 0) {
          this.save.creditos += this.save.bodega.valorCreditos;
          this.save.estadisticas.creditosTotalesGanados += this.save.bodega.valorCreditos;
        }
        this.save.bodega.unidades = 0;
        this.save.bodega.valorCreditos = 0;
        this.bodegaLlenaAviso = false;
      } else if (currentLevel < def.tope) {
        const nextLv = currentLevel + 1;
        this.save.mejoras[key as LinearUpgradeKey] = nextLv;
        const milestone = def.hitos.find((h) => h.nivel === nextLv);
        if (milestone) {
          highestMilestone = milestone;
        }
      } else if (isOverdriveSupported(key)) {
        this.save.sobremarcha[key as OverdriveKey] = overdriveLevel + 1;
      }
    }

    if (purchased === 0) return false;

    const nextStats = this.getCurrentStats();
    if (key === 'cascoEscudo') {
      this.cascoActual += nextStats.cascoMax - prevStats.cascoMax;
      this.escudoActual += nextStats.escudoMax - prevStats.escudoMax;
    }
    if (key === 'capacidadBodega') {
      this.bodegaLlenaAviso =
        !this.save.mejoras.autoventa && this.save.bodega.unidades >= nextStats.capacidadBodega;
    }

    if (highestMilestone) {
      this.showAlert(
        `Hito nv.${highestMilestone.nivel}: ${highestMilestone.titulo} (${highestMilestone.efecto})`,
        3.6
      );
      this.emitShockwave(SHIP_X, SHIP_Y, 105, PALETTE.warning, 3);
      this.emitParticles(SHIP_X, SHIP_Y, PALETTE.warning, 18, 175, 'shard');
      this.emitFloatingText(
        SHIP_X,
        SHIP_Y - 40,
        `¡HITO: ${highestMilestone.titulo}!`,
        PALETTE.warning,
        1.2
      );
      spaceAudio.playMilestone();
    } else {
      spaceAudio.playUpgrade();
    }

    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    return true;
  }

  buyTechNode(key: TechNodeKey): boolean {
    spaceAudio.unlockFromUserGesture();
    const node = TECH_TREE_NODES.find((n) => n.key === key);
    if (!node) return false;
    if (this.save.tecnologia[key]) return false;
    if (!node.requisitos.every((req) => this.save.tecnologia[req])) return false;
    if (this.save.nucleos < node.costeNucleos) return false;

    this.save.nucleos -= node.costeNucleos;
    this.save.tecnologia[key] = true;

    this.emitShockwave(SHIP_X, SHIP_Y, 115, PALETTE.stellarCore, 3);
    this.emitParticles(SHIP_X, SHIP_Y, PALETTE.stellarCore, 16, 165, 'shard');
    this.showAlert(`Tecnología desbloqueada: ${node.nombre}`, 3.0);
    spaceAudio.playMilestone();
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    return true;
  }

  buyFleetShip(key: FleetShipKey, amount: UpgradeBuyAmount = 1): boolean {
    spaceAudio.unlockFromUserGesture();
    const maxSteps = amount === 'max' ? 25 : amount;
    let bought = 0;

    for (let i = 0; i < maxSteps; i++) {
      const owned = this.save.flota[key] || 0;
      const cost = getFleetShipCost(key, owned);
      if (this.save.creditos < cost) break;
      this.save.creditos -= cost;
      this.save.flota[key] = owned + 1;
      bought += 1;
    }

    if (bought === 0) return false;
    this.syncFleetUnits();

    const def = FLEET_DEFINITIONS.find((f) => f.key === key)!;
    this.emitShockwave(SHIP_X, SHIP_Y, def.radioOrbita + 15, def.color, 2);
    this.showAlert(
      bought > 1 ? `${def.nombre} ×${bought} añadidos a la flota` : `${def.nombre} añadido a la flota`,
      2.4
    );
    spaceAudio.playUpgrade();
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    return true;
  }

  useConsumable(key: ConsumableKey): boolean {
    spaceAudio.unlockFromUserGesture();
    const def = CONSUMABLE_DEFINITIONS.find((c) => c.key === key);
    if (!def) return false;
    if (this.consumableCooldowns[key] > 0) return false;

    const cost = getConsumableCost(key, this.anomaliaActiva ? 4 : this.save.planetaActual);
    if (this.save.creditos < cost) return false;

    this.save.creditos -= cost;
    this.consumableCooldowns[key] = def.cooldownSeg;

    const stats = this.getCurrentStats();

    if (key === 'sobrecarga') {
      this.sobrecargaTimer = def.duracionSeg;
      this.emitShockwave(SHIP_X, SHIP_Y, 95, PALETTE.warning, 3);
      this.showAlert('Sobrecarga de armas activa (+50 % daño)', 2.5);
      spaceAudio.playUpgrade();
    } else if (key === 'reparacion') {
      this.cascoActual = stats.cascoMax;
      this.escudoActual = stats.escudoMax;
      this.timeSinceLastHit = SHIELD_REGEN_DELAY_SEC;
      this.emitShockwave(SHIP_X, SHIP_Y, 90, PALETTE.positive, 3);
      this.emitFloatingText(SHIP_X, SHIP_Y - 30, 'Casco y escudo 100 %', PALETTE.positive, 1.1);
      spaceAudio.playSell();
    } else if (key === 'emp') {
      this.emitShockwave(SHIP_X, SHIP_Y, 440, PALETTE.shield, 4);
      this.shakeIntensity = 7;
      spaceAudio.playEmp();
      const planet = PLANETS[this.anomaliaActiva ? 4 : this.save.planetaActual];
      const empBaseDmg = Math.max(stats.danoCanon * 7, Math.round(planet.enemigoPv * 0.55));
      const targetsSnapshot = [...this.targets];
      for (const t of targetsSnapshot) {
        t.empStunTimer = 2.5;
        const dmg = t.kind === 'jefe' ? Math.round(empBaseDmg * 1.4) : empBaseDmg;
        this.applyDamageToTarget(t, dmg, t.x, t.y, true);
      }
      this.projectiles = this.projectiles.filter((p) => p.fromPlayer);
      this.showAlert('Pulso EMP detonado', 2.0);
    }

    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    return true;
  }

  challengeBoss(): boolean {
    spaceAudio.unlockFromUserGesture();
    if (this.anomaliaActiva) return false;
    const planet = PLANETS[this.save.planetaActual];
    const progress = this.save.objetivosPorPlaneta[this.save.planetaActual];
    if (progress < planet.umbralJefe || this.hasActiveBoss()) return false;
    this.spawnBoss(false);
    return true;
  }

  selectPlanet(planetId: PlanetId): boolean {
    spaceAudio.unlockFromUserGesture();
    if (planetId > this.save.planetasDesbloqueados) return false;
    if (planetId === this.save.planetaActual && !this.anomaliaActiva) return false;

    this.anomaliaActiva = false;
    this.save.planetaActual = planetId;
    this.orbs = [];
    this.seedPlanetTargets(true);
    const accent = PLANETS[planetId].theme.particleColor;
    this.sectorTransitionTimer = 1;
    this.sectorTransitionColor = accent;
    this.emitShockwave(SHIP_X, SHIP_Y, 240, accent, 2.5);
    this.showAlert(`Sector: ${PLANETS[planetId].nombre}`, 2.2);
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    return true;
  }

  toggleAnomaly(): boolean {
    spaceAudio.unlockFromUserGesture();
    if (!this.save.anomaliaDesbloqueada) return false;

    this.anomaliaActiva = !this.anomaliaActiva;
    this.orbs = [];
    if (this.anomaliaActiva) {
      this.oleadaAnomalia = 1;
      this.anomalyWaveKills = 0;
      this.save.maxOleadaAnomalia = Math.max(this.save.maxOleadaAnomalia, 1);
      this.seedPlanetTargets(true);
      this.sectorTransitionTimer = 1;
      this.sectorTransitionColor = PALETTE.stellarCore;
      this.emitShockwave(SHIP_X, SHIP_Y, 260, PALETTE.stellarCore, 3);
      this.showAlert('Anomalía Infinita iniciada · Oleada 1', 2.8);
    } else {
      const accent = PLANETS[this.save.planetaActual].theme.particleColor;
      this.seedPlanetTargets(true);
      this.sectorTransitionTimer = 1;
      this.sectorTransitionColor = accent;
      this.emitShockwave(SHIP_X, SHIP_Y, 240, accent, 2.5);
      this.showAlert(`Retorno a ${PLANETS[this.save.planetaActual].nombre}`, 2.4);
    }
    spaceAudio.playUpgrade();
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    return true;
  }

  performPrestige(): boolean {
    spaceAudio.unlockFromUserGesture();
    if (!this.save.anomaliaDesbloqueada) return false;

    const coreReward = getPrestigeCoreReward(this.save.prestigioNivel, this.save.maxOleadaAnomalia);
    const nextPrestige = this.save.prestigioNivel + 1;
    const keptNucleos = this.save.nucleos;
    const keptTech = { ...this.save.tecnologia };
    const keptSilencio = this.save.silencio;
    const keptMaxWave = this.save.maxOleadaAnomalia;
    const keptStats = { ...this.save.estadisticas };
    const keptTime = this.save.tiempoJugadoSegundos;

    const fresh = createInitialSaveData();
    fresh.prestigioNivel = nextPrestige;
    fresh.nucleos = keptNucleos + coreReward;
    fresh.tecnologia = keptTech;
    fresh.silencio = keptSilencio;
    fresh.anomaliaDesbloqueada = true;
    fresh.maxOleadaAnomalia = keptMaxWave;
    fresh.estadisticas = keptStats;
    fresh.estadisticas.nucleosTotalesGanados += coreReward;
    fresh.tiempoJugadoSegundos = keptTime;

    this.save = fresh;
    this.ensureActiveContract();
    this.anomaliaActiva = false;
    this.oleadaAnomalia = 1;
    this.anomalyWaveKills = 0;
    this.pendingRankUp = false;
    this.orbCombo = 0;
    this.orbComboTimer = 0;
    this.orbs = [];
    this.beams = [];
    this.sobrecargaTimer = 0;
    this.consumableCooldowns = { sobrecarga: 0, reparacion: 0, emp: 0 };
    this.manualPulseCooldown = 0;
    this.deflectorCooldown = 0;
    this.bodegaLlenaAviso = false;
    this.activeEvent = null;
    this.meteorStreaks = [];
    this.eventCooldownTimer = 18 + Math.random() * 12;

    const stats = this.getCurrentStats();
    this.cascoActual = stats.cascoMax;
    this.escudoActual = stats.escudoMax;
    this.timeSinceLastHit = SHIELD_REGEN_DELAY_SEC;

    this.syncFleetUnits();
    this.seedPlanetTargets(true);

    this.emitShockwave(SHIP_X, SHIP_Y, 320, PALETTE.stellarCore, 4);
    this.emitParticles(SHIP_X, SHIP_Y, PALETTE.stellarCore, 28, 220, 'shard');
    this.showAlert(
      `Salto Hiperespacial nv.${nextPrestige} · +${coreReward} Núcleos y multiplicador permanente`,
      3.8
    );
    spaceAudio.playPrestige();
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    return true;
  }

  toggleMute(): boolean {
    spaceAudio.unlockFromUserGesture();
    this.save.silencio = !this.save.silencio;
    spaceAudio.setMuted(this.save.silencio);
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
    return this.save.silencio;
  }

  resetRun(): void {
    clearSaveData();
    this.save = createInitialSaveData();
    this.ensureActiveContract();
    spaceAudio.setMuted(this.save.silencio);
    const stats = this.getCurrentStats();
    this.cascoActual = stats.cascoMax;
    this.escudoActual = stats.escudoMax;
    this.timeSinceLastHit = SHIELD_REGEN_DELAY_SEC;
    this.bodegaLlenaAviso = false;
    this.alertaTexto = null;
    this.alertaTimer = 0;
    this.sobrecargaTimer = 0;
    this.consumableCooldowns = { sobrecarga: 0, reparacion: 0, emp: 0 };
    this.manualPulseCooldown = 0;
    this.deflectorCooldown = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.orbs = [];
    this.beams = [];
    this.orbCombo = 0;
    this.orbComboTimer = 0;
    this.pendingRankUp = false;
    this.anomaliaActiva = false;
    this.oleadaAnomalia = 1;
    this.anomalyWaveKills = 0;
    this.activeEvent = null;
    this.meteorStreaks = [];
    this.eventCooldownTimer = 18 + Math.random() * 12;
    this.particleManager.clear();
    this.syncFleetUnits();
    this.seedPlanetTargets(true);
  }

  exportSave(): SaveDataV1 {
    return structuredClone(this.save);
  }

  importSave(validatedSave: SaveDataV1): void {
    this.save = structuredClone(validatedSave);
    this.ensureActiveContract();
    spaceAudio.setMuted(this.save.silencio);

    const stats = this.getCurrentStats();
    this.cascoActual = stats.cascoMax;
    this.escudoActual = stats.escudoMax;
    this.timeSinceLastHit = SHIELD_REGEN_DELAY_SEC;
    this.bodegaLlenaAviso = false;
    this.pendingRankUp = false;
    this.anomaliaActiva = false;
    this.oleadaAnomalia = 1;
    this.anomalyWaveKills = 0;
    this.sobrecargaTimer = 0;
    this.consumableCooldowns = { sobrecarga: 0, reparacion: 0, emp: 0 };
    this.manualPulseCooldown = 0;
    this.deflectorCooldown = 0;
    this.hitstopTimer = 0;
    this.shakeIntensity = 0;
    this.orbs = [];
    this.beams = [];
    this.orbCombo = 0;
    this.orbComboTimer = 0;
    this.activeEvent = null;
    this.meteorStreaks = [];
    this.eventCooldownTimer = 18 + Math.random() * 12;
    this.particleManager.clear();
    this.syncFleetUnits();
    this.seedPlanetTargets(true);

    this.sectorTransitionTimer = 1;
    this.sectorTransitionColor = PALETTE.positive;
    this.showAlert('Partida importada correctamente', 2.6);
    persistSaveData(this.save);
    this.callbacks.onImmediateSave?.();
  }

  getSnapshot(): HudSnapshot {
    const stats = this.getCurrentStats();
    const boss = this.targets.find((t) => t.kind === 'jefe');
    const locked = this.lockedTargetId !== null ? this.targets.find((t) => t.id === this.lockedTargetId) : null;
    const eventDef = this.activeEvent
      ? RANDOM_EVENT_DEFINITIONS.find((d) => d.key === this.activeEvent!.key) || null
      : null;

    return {
      creditos: this.save.creditos,
      nucleos: this.save.nucleos,
      planetaActual: this.save.planetaActual,
      planetasDesbloqueados: this.save.planetasDesbloqueados,
      objetivosPorPlaneta: { ...this.save.objetivosPorPlaneta },
      bodega: { ...this.save.bodega },
      bodegaLlenaAviso: this.bodegaLlenaAviso,
      mejoras: { ...this.save.mejoras },
      sobremarcha: { ...this.save.sobremarcha },
      flota: { ...this.save.flota },
      tecnologia: { ...this.save.tecnologia },
      talentos: { ...this.save.talentos },
      rango: this.save.rango,
      xp: this.save.xp,
      xpSiguiente: getXpForNextRank(this.save.rango),
      prestigioNivel: this.save.prestigioNivel,
      anomaliaDesbloqueada: this.save.anomaliaDesbloqueada,
      anomaliaActiva: this.anomaliaActiva,
      oleadaAnomalia: this.oleadaAnomalia,
      maxOleadaAnomalia: this.save.maxOleadaAnomalia,
      silencio: this.save.silencio,
      tiempoJugadoSegundos: this.save.tiempoJugadoSegundos,
      estadisticas: { ...this.save.estadisticas },
      stats,
      cascoActual: this.cascoActual,
      escudoActual: this.escudoActual,
      jefeActivo: boss ? { nombre: boss.name, hp: Math.max(0, boss.hp), maxHp: boss.maxHp } : null,
      objetivoFijadoNombre: locked ? locked.name : null,
      alertaTexto: this.alertaTexto,
      sobrecargaRestanteSeg: this.sobrecargaTimer,
      consumableCooldowns: { ...this.consumableCooldowns },
      manualPulseCooldown: this.manualPulseCooldown,
      deflectorCooldown: this.deflectorCooldown,
      deflectorMaxCooldown: DEFLECTOR_PULSE_COOLDOWN_SEC,
      postura: this.save.postura,
      contratoActivo: this.save.contratoActivo ? { ...this.save.contratoActivo } : null,
      rachaOrbes: this.orbCombo,
      eventoActivo:
        this.activeEvent && eventDef
          ? {
              key: eventDef.key,
              nombre: eventDef.nombre,
              descripcion: eventDef.descripcion,
              remainingSec: Math.max(0, this.activeEvent.remainingSec),
              durationSec: this.activeEvent.durationSec,
              color: eventDef.color,
            }
          : null,
    };
  }

  render(
    ctx: CanvasRenderingContext2D,
    cssWidth: number,
    cssHeight: number,
    dpr: number,
    showHudOverlay = true
  ): void {
    const stats = this.getCurrentStats();
    renderGameFrame(
      ctx,
      cssWidth,
      cssHeight,
      dpr,
      {
        planetaActual: this.save.planetaActual,
        objetivosPorPlaneta: this.save.objetivosPorPlaneta,
        anomaliaActiva: this.anomaliaActiva,
        oleadaAnomalia: this.oleadaAnomalia,
        anomalyWaveKills: this.anomalyWaveKills,
        stars: this.stars,
        ambientMotes: this.ambientMotes,
        warpGrid: this.warpGrid,
        meteorStreaks: this.meteorStreaks,
        activeEvent: this.activeEvent,
        visualTime: this.visualTime,
        shakeIntensity: this.shakeIntensity,
        orbs: this.orbs,
        targets: this.targets,
        beams: this.beams,
        projectiles: this.projectiles,
        particleManager: this.particleManager,
        shipAngle: this.shipAngle,
        shipHitFlash: this.shipHitFlash,
        sobrecargaTimer: this.sobrecargaTimer,
        escudoActual: this.escudoActual,
        cascoActual: this.cascoActual,
        stats,
        mejoras: this.save.mejoras,
        tecnologia: this.save.tecnologia,
        postura: this.save.postura,
        deflectorCooldown: this.deflectorCooldown,
        deflectorMaxCooldown: DEFLECTOR_PULSE_COOLDOWN_SEC,
        droneOrbitAngle: this.droneOrbitAngle,
        fleetUnits: this.fleetUnits,
        activeTarget: this.getActiveTarget(),
        lockedTargetId: this.lockedTargetId,
        pointerLogicalX: this.pointerLogicalX,
        pointerLogicalY: this.pointerLogicalY,
        orbCombo: this.orbCombo,
        orbComboTimer: this.orbComboTimer,
        bodegaLlenaAviso: this.bodegaLlenaAviso,
        alertaTexto: this.alertaTexto,
        sectorTransitionFlash: this.sectorTransitionTimer,
        sectorTransitionColor: this.sectorTransitionColor,
        disintegratorProgress: this.save.tecnologia.hazDesintegrador ? (this.shotCounter % 6) / 6 : 0,
      },
      showHudOverlay
    );
  }
}
