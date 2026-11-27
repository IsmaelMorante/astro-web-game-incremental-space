import {
  CONSUMABLE_DEFINITIONS,
  FLEET_DEFINITIONS,
  SHIELD_COMBAT_REGEN_RATE_PER_SEC,
  SHIELD_REGEN_RATE_PER_SEC,
  SHIP_X,
  SHIP_Y,
  UPGRADE_DEFINITIONS,
  type CombatTarget,
  type ConsumableKey,
  type FleetShipKey,
  type FlotaState,
  type LinearUpgradeKey,
  type MejorasState,
  type OverdriveKey,
  type PlanetId,
  type RandomEventKey,
  type ShipStance,
  type ShipStats,
  type SobremarchaState,
  type TalentKey,
  type TechNodeKey,
  type UpgradeBuyAmount,
  type UpgradeKey,
} from './types';

export function getStanceModifiers(postura: ShipStance): {
  damageMult: number;
  fireRateMult: number;
  shieldRegenMult: number;
  magnetBonusPx: number;
  armorBonus: number;
} {
  if (postura === 'asalto') {
    return {
      damageMult: 1.25,
      fireRateMult: 1.2,
      shieldRegenMult: 0.8,
      magnetBonusPx: 0,
      armorBonus: 0,
    };
  }
  if (postura === 'escudo') {
    return {
      damageMult: 1,
      fireRateMult: 1,
      shieldRegenMult: 1.45,
      magnetBonusPx: 90,
      armorBonus: 0.1,
    };
  }
  return {
    damageMult: 1,
    fireRateMult: 1,
    shieldRegenMult: 1,
    magnetBonusPx: 0,
    armorBonus: 0,
  };
}

export function getPrestigeDamageMultiplier(prestigioNivel: number): number {
  return 1 + prestigioNivel * 0.5;
}

export function getPrestigeLootMultiplier(prestigioNivel: number): number {
  return 1 + prestigioNivel * 0.4;
}

export function getPrestigeCoreReward(prestigioNivel: number, maxOleadaAnomalia = 0): number {
  return 2 + Math.floor(prestigioNivel / 2) + (maxOleadaAnomalia >= 6 ? 1 : 0);
}

export function getXpForNextRank(rango: number): number {
  return Math.round(45 + (rango - 1) * 32 + Math.pow(rango - 1, 1.35) * 10);
}

export function getCannonDamage(nivel: number, overdrive = 0): number {
  const base = 10 + 5 * nivel + 12 * overdrive;
  const milestoneMult = nivel >= 15 ? 1.25 : 1;
  return Math.round(base * milestoneMult);
}

export function getCannonProjectileCount(nivel: number): number {
  if (nivel >= 20) return 3;
  if (nivel >= 10) return 2;
  return 1;
}

export function getCritChance(danoNivel: number, matrizCriticaCount = 0): number {
  const base = danoNivel >= 5 ? 0.2 : 0;
  return Math.min(0.85, base + matrizCriticaCount * 0.08);
}

export function getCritMultiplier(matrizCriticaCount = 0): number {
  return 1.6 + matrizCriticaCount * 0.25;
}

export function getFireRate(nivel: number, overdrive = 0, turboCount = 0): number {
  const base = 1.0 + 0.25 * nivel + 0.3 * overdrive;
  let mult = 1 + turboCount * 0.15;
  if (nivel >= 5) mult += 0.15;
  if (nivel >= 10) mult += 0.2;
  if (nivel >= 15) mult += 0.25;
  return Number((base * mult).toFixed(2));
}

export function getMaxHull(nivel: number, overdrive = 0): number {
  return 80 + 25 * nivel + 45 * overdrive;
}

export function getMaxShield(nivel: number, overdrive = 0, escudoTalentCount = 0): number {
  const base = 40 + 25 * nivel + 35 * overdrive;
  const milestoneMult = nivel >= 15 ? 1.3 : 1;
  const talentMult = 1 + escudoTalentCount * 0.2;
  return Math.round(base * milestoneMult * talentMult);
}

export function getDamageReduction(cascoNivel: number): number {
  return cascoNivel >= 5 ? 0.15 : 0;
}

export function getCombatShieldRegenMultiplier(cascoNivel: number): number {
  return cascoNivel >= 10 ? 2 : 1;
}

export function getCargoCapacity(nivel: number): number {
  return 10 + 5 * nivel;
}

export function getCargoValueMultiplier(bodegaNivel: number): number {
  if (bodegaNivel >= 10) return 1.25;
  if (bodegaNivel >= 5) return 1.1;
  return 1;
}

export function getDroneDamage(nivel: number, overdrive = 0): number {
  if (nivel <= 0) return 0;
  return 12 * nivel + 24 * overdrive;
}

export function getDroneCount(nivel: number): number {
  if (nivel <= 0) return 0;
  if (nivel >= 10) return 3;
  if (nivel >= 5) return 2;
  return 1;
}

export function getDroneFireRate(nivel: number): number {
  if (nivel <= 0) return 0;
  if (nivel >= 10) return 1.6;
  if (nivel >= 5) return 1.4;
  return 1.0;
}

export function getFleetDamageMultiplier(
  tecnologia?: Record<TechNodeKey, boolean>,
  talentos?: Record<TalentKey, number>,
  prestigioNivel = 0,
  sobrecargaActiva = false,
  postura: ShipStance = 'equilibrada'
): number {
  const maestriaFlotaCount = talentos?.maestriaFlota || 0;
  const stance = getStanceModifiers(postura);
  return (
    (1 + maestriaFlotaCount * 0.22) *
    (tecnologia?.sobrecargaFlota ? 1.35 : 1) *
    getPrestigeDamageMultiplier(prestigioNivel) *
    (sobrecargaActiva ? 1.5 : 1) *
    stance.damageMult
  );
}

export function getFleetDps(
  flota: FlotaState,
  fleetMult = 1
): number {
  let total = 0;
  for (const def of FLEET_DEFINITIONS) {
    const count = flota[def.key] || 0;
    total += count * def.danoBase * fleetMult * def.cadencia;
  }
  return total;
}

export function getFleetShipCost(key: FleetShipKey, ownedCount: number): number {
  const def = FLEET_DEFINITIONS.find((f) => f.key === key);
  if (!def) return 999999;
  return Math.round(def.baseCoste * Math.pow(def.multiplicadorCoste, ownedCount));
}

export function getBulkFleetPreview(
  key: FleetShipKey,
  ownedCount: number,
  amount: UpgradeBuyAmount,
  credits: number
): { count: number; totalCost: number } {
  const singleCost = getFleetShipCost(key, ownedCount);
  if (amount === 1) {
    return { count: 1, totalCost: singleCost };
  }
  const maxSteps = amount === 'max' ? 25 : amount;
  let totalCost = 0;
  let count = 0;
  for (let i = 0; i < maxSteps; i++) {
    const stepCost = getFleetShipCost(key, ownedCount + count);
    if (amount === 'max' && count > 0 && totalCost + stepCost > credits) break;
    if (amount === 'max' && count === 0 && stepCost > credits) {
      return { count: 1, totalCost: stepCost };
    }
    totalCost += stepCost;
    count += 1;
  }
  return { count: Math.max(1, count), totalCost };
}

export function getConsumableCost(key: ConsumableKey, planetId: PlanetId): number {
  const def = CONSUMABLE_DEFINITIONS.find((c) => c.key === key);
  if (!def) return 999999;
  return Math.round(def.baseCoste * (1 + (planetId - 1) * 0.45));
}

export function getShipStats(
  mejoras: MejorasState,
  sobremarcha: SobremarchaState,
  flota: FlotaState,
  sobrecargaActiva = false,
  tecnologia?: Record<TechNodeKey, boolean>,
  talentos?: Record<TalentKey, number>,
  prestigioNivel = 0,
  activeEvent: RandomEventKey | null = null,
  postura: ShipStance = 'equilibrada'
): ShipStats {
  const calibreCount = talentos?.calibrePesado || 0;
  const turboCount = talentos?.turborefrigeracion || 0;
  const imanCount = talentos?.imanHiperespacial || 0;
  const matrizCount = talentos?.matrizCritica || 0;
  const escudoTalentCount = talentos?.escudoRegenerativo || 0;

  const stance = getStanceModifiers(postura);
  const prestigeDmg = getPrestigeDamageMultiplier(prestigioNivel);
  const prestigeLoot = getPrestigeLootMultiplier(prestigioNivel);
  const sobrecargaMult = sobrecargaActiva ? 1.5 : 1;

  const danoCanon = Math.round(
    getCannonDamage(mejoras.danoCanon, sobremarcha.danoCanon) *
      (1 + calibreCount * 0.18) *
      prestigeDmg *
      sobrecargaMult *
      stance.damageMult
  );
  const proyectilesPorDisparo = getCannonProjectileCount(mejoras.danoCanon);
  const eventFireMult = activeEvent === 'frenesiCuantico' ? 1.45 : 1;
  const cadencia = Number(
    (getFireRate(mejoras.cadencia, sobremarcha.cadencia, turboCount) * eventFireMult * stance.fireRateMult).toFixed(2)
  );
  const eventCritBonus = activeEvent === 'frenesiCuantico' ? 0.25 : 0;
  const probCritico = Math.min(0.95, getCritChance(mejoras.danoCanon, matrizCount) + eventCritBonus);
  const multCritico = getCritMultiplier(matrizCount);
  const reduccionDano = Math.min(0.45, getDamageReduction(mejoras.cascoEscudo) + stance.armorBonus);
  const cascoMax = getMaxHull(mejoras.cascoEscudo, sobremarcha.cascoEscudo);
  const escudoMax = getMaxShield(mejoras.cascoEscudo, sobremarcha.cascoEscudo, escudoTalentCount);

  const regenTalentMult = (1 + escudoTalentCount * 0.35) * stance.shieldRegenMult;
  const regenCombatePorSeg =
    escudoMax *
    SHIELD_COMBAT_REGEN_RATE_PER_SEC *
    getCombatShieldRegenMultiplier(mejoras.cascoEscudo) *
    regenTalentMult;
  const regenFueraCombatePorSeg = escudoMax * SHIELD_REGEN_RATE_PER_SEC * regenTalentMult;
  const capacidadBodega = getCargoCapacity(mejoras.capacidadBodega);

  const baseIman =
    165 +
    mejoras.capacidadBodega * 24 +
    (tecnologia?.imanCuantico ? 140 : 0) +
    imanCount * 85 +
    stance.magnetBonusPx;
  const radioIman = activeEvent === 'interferenciaMagnetica' ? 48 : baseIman;

  const eventLootMult =
    activeEvent === 'lluviaOro'
      ? 2.0
      : activeEvent === 'interferenciaMagnetica'
        ? 1.65
        : activeEvent === 'fisuraNucleos'
          ? 1.15
          : 1;

  const multBotin =
    getCargoValueMultiplier(mejoras.capacidadBodega) *
    (tecnologia?.fisionMineral ? 1.3 : 1) *
    (1 + imanCount * 0.12) *
    prestigeLoot *
    eventLootMult;

  const fleetAndDroneMult = getFleetDamageMultiplier(
    tecnologia,
    talentos,
    prestigioNivel,
    sobrecargaActiva,
    postura
  );

  const danoDron = Math.round(
    getDroneDamage(mejoras.dronApoyo, sobremarcha.dronApoyo) * fleetAndDroneMult
  );
  const cantidadDrones = getDroneCount(mejoras.dronApoyo);
  const cadenciaDron = getDroneFireRate(mejoras.dronApoyo);

  const critExpectedMult = 1 + probCritico * (multCritico - 1);
  const hazBonus = tecnologia?.hazDesintegrador ? 1.33 : 1;
  const dpsCanon = danoCanon * proyectilesPorDisparo * cadencia * critExpectedMult * hazBonus;
  const dpsDrones = danoDron * cantidadDrones * cadenciaDron;
  const dpsFlota = getFleetDps(flota, fleetAndDroneMult);
  const dpsTotal = dpsCanon + dpsDrones + dpsFlota;

  return {
    danoCanon,
    proyectilesPorDisparo,
    cadencia,
    probCritico,
    multCritico,
    reduccionDano,
    cascoMax,
    escudoMax,
    regenCombatePorSeg,
    regenFueraCombatePorSeg,
    capacidadBodega,
    radioIman,
    multBotin,
    danoDron,
    cantidadDrones,
    cadenciaDron,
    dpsCanon,
    dpsDrones,
    dpsFlota,
    dpsTotal,
  };
}

export function getUpgradeLevel(mejoras: MejorasState, key: UpgradeKey): number {
  if (key === 'autoventa') {
    return mejoras.autoventa ? 1 : 0;
  }
  return mejoras[key as LinearUpgradeKey];
}

export function isOverdriveSupported(key: UpgradeKey): key is OverdriveKey {
  return (
    key === 'danoCanon' ||
    key === 'cadencia' ||
    key === 'cascoEscudo' ||
    key === 'dronApoyo'
  );
}

export function getUpgradeCost(
  key: UpgradeKey,
  currentLevel: number,
  overdriveLevel = 0
): number | null {
  const def = UPGRADE_DEFINITIONS.find((u) => u.key === key);
  if (!def) return null;
  if (currentLevel < def.tope) {
    if (def.tipo === 'Único') return def.baseCoste;
    const lateStep = Math.max(0, currentLevel - 6);
    return def.baseCoste + def.incrementoCoste * currentLevel + Math.round(def.incrementoCoste * 0.14 * lateStep * lateStep);
  }
  if (isOverdriveSupported(key)) {
    const capLastCost =
      def.baseCoste +
      def.incrementoCoste * (def.tope - 1) +
      Math.round(def.incrementoCoste * 0.14 * Math.max(0, def.tope - 7) ** 2);
    return Math.round(capLastCost * 1.15 + 160 * (overdriveLevel + 1) * (1 + overdriveLevel * 0.12));
  }
  return null;
}

export function getBulkUpgradePreview(
  key: UpgradeKey,
  currentLevel: number,
  overdriveLevel: number,
  amount: UpgradeBuyAmount,
  credits: number
): { levels: number; totalCost: number | null; isMaxed: boolean } {
  const def = UPGRADE_DEFINITIONS.find((u) => u.key === key);
  if (!def) return { levels: 0, totalCost: null, isMaxed: true };

  const singleCost = getUpgradeCost(key, currentLevel, overdriveLevel);
  if (singleCost === null) {
    return { levels: 0, totalCost: null, isMaxed: true };
  }

  if (def.tipo === 'Único' || amount === 1) {
    return { levels: 1, totalCost: singleCost, isMaxed: false };
  }

  const maxAffordableSteps = amount === 'max' ? 50 : amount;
  let simLevel = currentLevel;
  let simOverdrive = overdriveLevel;
  let totalCost = 0;
  let levels = 0;

  for (let i = 0; i < maxAffordableSteps; i++) {
    const stepCost = getUpgradeCost(key, simLevel, simOverdrive);
    if (stepCost === null) break;
    if (amount === 'max' && levels > 0 && totalCost + stepCost > credits) break;
    if (amount === 'max' && levels === 0 && stepCost > credits) {
      return { levels: 1, totalCost: stepCost, isMaxed: false };
    }
    totalCost += stepCost;
    levels += 1;
    if (simLevel < def.tope) {
      simLevel += 1;
    } else {
      simOverdrive += 1;
    }
  }

  return { levels: Math.max(1, levels), totalCost, isMaxed: false };
}

export function getUpgradeEffectLabel(
  key: UpgradeKey,
  level: number,
  overdriveLevel = 0,
  autoventaActive = false
): string {
  switch (key) {
    case 'danoCanon': {
      const dmg = getCannonDamage(level, overdriveLevel);
      const count = getCannonProjectileCount(level);
      return count > 1 ? `${formatInt(dmg)}×${count} daño base` : `${formatInt(dmg)} daño base`;
    }
    case 'cadencia':
      return `${formatDecimal(getFireRate(level, overdriveLevel), 2)} disp/s`;
    case 'cascoEscudo':
      return `${formatInt(getMaxHull(level, overdriveLevel))} casco · ${formatInt(getMaxShield(level, overdriveLevel))} esc.`;
    case 'capacidadBodega':
      if (autoventaActive) {
        return `Imán +${level * 24} px · Venta ×${formatDecimal(getCargoValueMultiplier(level), 2)}`;
      }
      return `${formatInt(getCargoCapacity(level))} espacios · imán +${level * 24}px`;
    case 'dronApoyo': {
      const count = getDroneCount(level);
      const dmg = getDroneDamage(level, overdriveLevel);
      const rate = getDroneFireRate(level);
      return level === 0
        ? 'Inactivo (0 daño)'
        : `${count} dron${count > 1 ? 'es' : ''} · ${formatInt(dmg)} daño · ${formatDecimal(rate, 1)}/s`;
    }
    case 'autoventa':
      return level >= 1 ? 'Activa' : 'Venta automática';
  }
}

export function getNextUpgradeDeltaLabel(
  key: UpgradeKey,
  level: number,
  isOverdrive: boolean,
  autoventaActive = false
): string | null {
  const def = UPGRADE_DEFINITIONS.find((u) => u.key === key);
  if (!def) return null;
  if (level >= def.tope && !isOverdrive) return null;

  switch (key) {
    case 'danoCanon':
      return isOverdrive ? '+12 daño (Sobremarcha)' : '+5 daño';
    case 'cadencia':
      return isOverdrive ? '+0,30 disp/s (Sobremarcha)' : '+0,25 disp/s';
    case 'cascoEscudo':
      return isOverdrive ? '+45 casco / +35 esc.' : '+25 casco / +25 esc.';
    case 'capacidadBodega':
      return autoventaActive ? '+24 px imán' : '+5 espacios';
    case 'dronApoyo':
      if (isOverdrive) return '+24 daño/dron (Sobremarcha)';
      return level === 0 ? 'Activa 12 daño' : '+12 daño';
    case 'autoventa':
      return 'Desbloqueo único';
  }
}

export function selectAutoAimTarget(targets: CombatTarget[]): CombatTarget | null {
  if (targets.length === 0) return null;

  const boss = targets.find((t) => t.kind === 'jefe');
  if (boss) return boss;

  const enemies = targets.filter((t) => t.kind === 'enemigo');
  const pool = enemies.length > 0 ? enemies : targets.filter((t) => t.kind === 'asteroide');
  if (pool.length === 0) return null;

  let best = pool[0];
  let bestDistSq = (best.x - SHIP_X) ** 2 + (best.y - SHIP_Y) ** 2;

  for (let i = 1; i < pool.length; i++) {
    const candidate = pool[i];
    const distSq = (candidate.x - SHIP_X) ** 2 + (candidate.y - SHIP_Y) ** 2;
    if (
      distSq < bestDistSq - 0.001 ||
      (Math.abs(distSq - bestDistSq) <= 0.001 && candidate.spawnOrder < best.spawnOrder)
    ) {
      best = candidate;
      bestDistSq = distSq;
    }
  }

  return best;
}

export function computeInterceptVelocity(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  targetVx: number,
  targetVy: number,
  projectileSpeed: number
): { vx: number; vy: number; angle: number } {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const a = targetVx * targetVx + targetVy * targetVy - projectileSpeed * projectileSpeed;
  const b = 2 * (dx * targetVx + dy * targetVy);
  const c = dx * dx + dy * dy;

  let t = 0;
  if (Math.abs(a) < 1e-4) {
    if (Math.abs(b) > 1e-4) {
      t = Math.max(0, -c / b);
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const t1 = (-b - sqrtDisc) / (2 * a);
      const t2 = (-b + sqrtDisc) / (2 * a);
      if (t1 > 0 && t2 > 0) t = Math.min(t1, t2);
      else if (t1 > 0) t = t1;
      else if (t2 > 0) t = t2;
    }
  }

  const aimX = targetX + targetVx * Math.min(t, 0.85);
  const aimY = targetY + targetVy * Math.min(t, 0.85);
  const angle = Math.atan2(aimY - originY, aimX - originX);

  return {
    vx: Math.cos(angle) * projectileSpeed,
    vy: Math.sin(angle) * projectileSpeed,
    angle,
  };
}

export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('es-ES');
}

export function formatCredits(value: number): string {
  return `${formatInt(value)} cr`;
}

export function formatDecimal(value: number, decimals = 1): string {
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatTimeMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
