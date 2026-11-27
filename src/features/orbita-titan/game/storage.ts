import {
  SAVE_STORAGE_KEY,
  TALENT_DEFINITIONS,
  TECH_TREE_NODES,
  UPGRADE_DEFINITIONS,
  createInitialSaveData,
  type ContractType,
  type PlanetId,
  type SaveDataV1,
  type SectorContract,
  type ShipStance,
  type TalentKey,
  type TechNodeKey,
} from './types';

const VALID_STANCES: ShipStance[] = ['asalto', 'equilibrada', 'escudo'];
const VALID_CONTRACT_TYPES: ContractType[] = [
  'bajas_manuales',
  'asteroides',
  'enemigos',
  'elites',
  'orbes_racha',
];

function isFiniteNonNegInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && Math.floor(value) === value;
}

function isFiniteNonNegNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidPlanetId(value: unknown): value is PlanetId {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (!isFiniteNonNegInt(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function optNonNegInt(value: unknown, fallback = 0): number | null {
  if (value === undefined) return fallback;
  if (!isFiniteNonNegInt(value)) return null;
  return value;
}

function optNonNegNumber(value: unknown, fallback = 0): number | null {
  if (value === undefined) return fallback;
  if (!isFiniteNonNegNumber(value)) return null;
  return value;
}

function optBool(value: unknown, fallback = false): boolean | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') return null;
  return value;
}

export function validateSaveData(raw: unknown): SaveDataV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (obj.version !== 1) return null;
  if (!isFiniteNonNegNumber(obj.creditos)) return null;
  const nucleos = optNonNegInt(obj.nucleos, 0);
  if (nucleos === null) return null;

  if (!isValidPlanetId(obj.planetaActual)) return null;
  if (!isValidPlanetId(obj.planetasDesbloqueados)) return null;
  if (obj.planetaActual > obj.planetasDesbloqueados) return null;

  if (!obj.objetivosPorPlaneta || typeof obj.objetivosPorPlaneta !== 'object') return null;
  const objetivosRaw = obj.objetivosPorPlaneta as Record<string, unknown>;
  const objetivosPorPlaneta: Record<PlanetId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const id of [1, 2, 3, 4] as PlanetId[]) {
    const v = objetivosRaw[String(id)];
    if (!isFiniteNonNegInt(v)) return null;
    objetivosPorPlaneta[id] = v;
  }

  if (!obj.bodega || typeof obj.bodega !== 'object') return null;
  const bodegaRaw = obj.bodega as Record<string, unknown>;
  if (!isFiniteNonNegInt(bodegaRaw.unidades) || !isFiniteNonNegNumber(bodegaRaw.valorCreditos)) {
    return null;
  }

  if (!obj.mejoras || typeof obj.mejoras !== 'object') return null;
  const mejorasRaw = obj.mejoras as Record<string, unknown>;

  const topes = Object.fromEntries(UPGRADE_DEFINITIONS.map((d) => [d.key, d.tope]));
  const danoCanon = clampInt(mejorasRaw.danoCanon, 0, topes.danoCanon);
  const cadencia = clampInt(mejorasRaw.cadencia, 0, topes.cadencia);
  const cascoEscudo = clampInt(mejorasRaw.cascoEscudo, 0, topes.cascoEscudo);
  const capacidadBodega = clampInt(mejorasRaw.capacidadBodega, 0, topes.capacidadBodega);
  const dronApoyo = clampInt(mejorasRaw.dronApoyo, 0, topes.dronApoyo);
  if (
    danoCanon === null ||
    cadencia === null ||
    cascoEscudo === null ||
    capacidadBodega === null ||
    dronApoyo === null ||
    typeof mejorasRaw.autoventa !== 'boolean'
  ) {
    return null;
  }

  // Optional migrated fields: sobremarcha & flota
  const sobremarchaRaw = (obj.sobremarcha && typeof obj.sobremarcha === 'object'
    ? obj.sobremarcha
    : {}) as Record<string, unknown>;
  const smDano = optNonNegInt(sobremarchaRaw.danoCanon, 0);
  const smCadencia = optNonNegInt(sobremarchaRaw.cadencia, 0);
  const smCasco = optNonNegInt(sobremarchaRaw.cascoEscudo, 0);
  const smDron = optNonNegInt(sobremarchaRaw.dronApoyo, 0);
  if (smDano === null || smCadencia === null || smCasco === null || smDron === null) {
    return null;
  }

  const flotaRaw = (obj.flota && typeof obj.flota === 'object' ? obj.flota : {}) as Record<string, unknown>;
  const flCaza = optNonNegInt(flotaRaw.caza, 0);
  const flCorbeta = optNonNegInt(flotaRaw.corbeta, 0);
  const flFragata = optNonNegInt(flotaRaw.fragata, 0);
  if (flCaza === null || flCorbeta === null || flFragata === null) {
    return null;
  }

  // Optional migrated fields: tecnologia, talentos, rango, xp, prestigioNivel, anomalia
  const techRaw = (obj.tecnologia && typeof obj.tecnologia === 'object'
    ? obj.tecnologia
    : {}) as Record<string, unknown>;
  const tecnologia = {} as Record<TechNodeKey, boolean>;
  for (const node of TECH_TREE_NODES) {
    const val = optBool(techRaw[node.key], false);
    if (val === null) return null;
    tecnologia[node.key] = val;
  }

  const talentsRaw = (obj.talentos && typeof obj.talentos === 'object'
    ? obj.talentos
    : {}) as Record<string, unknown>;
  const talentos = {} as Record<TalentKey, number>;
  for (const t of TALENT_DEFINITIONS) {
    const val = optNonNegInt(talentsRaw[t.key], 0);
    if (val === null) return null;
    talentos[t.key] = val;
  }

  const rangoRaw = optNonNegInt(obj.rango, 1);
  if (rangoRaw === null || rangoRaw < 1) return null;
  const xpRaw = optNonNegInt(obj.xp, 0);
  if (xpRaw === null) return null;
  const prestigioNivel = optNonNegInt(obj.prestigioNivel, 0);
  if (prestigioNivel === null) return null;
  const anomaliaDesbloqueada = optBool(obj.anomaliaDesbloqueada, false);
  if (anomaliaDesbloqueada === null) return null;
  const maxOleadaAnomalia = optNonNegInt(obj.maxOleadaAnomalia, 0);
  if (maxOleadaAnomalia === null) return null;

  const postura: ShipStance =
    typeof obj.postura === 'string' && VALID_STANCES.includes(obj.postura as ShipStance)
      ? (obj.postura as ShipStance)
      : 'equilibrada';

  let contratoActivo: SectorContract | null = null;
  if (obj.contratoActivo && typeof obj.contratoActivo === 'object') {
    const c = obj.contratoActivo as Record<string, unknown>;
    if (
      isFiniteNonNegInt(c.id) &&
      typeof c.type === 'string' &&
      VALID_CONTRACT_TYPES.includes(c.type as ContractType) &&
      typeof c.titulo === 'string' &&
      isFiniteNonNegInt(c.progreso) &&
      isFiniteNonNegInt(c.meta) &&
      c.meta > 0 &&
      isFiniteNonNegInt(c.recompensaCreditos) &&
      isFiniteNonNegInt(c.recompensaNucleos)
    ) {
      contratoActivo = {
        id: c.id,
        type: c.type as ContractType,
        titulo: c.titulo,
        progreso: Math.min(c.progreso, c.meta),
        meta: c.meta,
        recompensaCreditos: c.recompensaCreditos,
        recompensaNucleos: c.recompensaNucleos,
      };
    }
  }

  if (typeof obj.silencio !== 'boolean') return null;
  if (!isFiniteNonNegNumber(obj.tiempoJugadoSegundos)) return null;

  if (!obj.estadisticas || typeof obj.estadisticas !== 'object') return null;
  const statsRaw = obj.estadisticas as Record<string, unknown>;
  if (
    !isFiniteNonNegInt(statsRaw.objetivosDestruidos) ||
    !isFiniteNonNegInt(statsRaw.jefesDerrotados) ||
    !isFiniteNonNegNumber(statsRaw.creditosTotalesGanados)
  ) {
    return null;
  }
  const asteroidesDestruidos = optNonNegInt(statsRaw.asteroidesDestruidos, 0);
  const enemigosDestruidos = optNonNegInt(statsRaw.enemigosDestruidos, 0);
  const elitesDestruidos = optNonNegInt(statsRaw.elitesDestruidos, 0);
  const nucleosTotalesGanados = optNonNegInt(statsRaw.nucleosTotalesGanados, 0);
  const pulsosManuales = optNonNegInt(statsRaw.pulsosManuales, 0);
  const eventosCompletados = optNonNegInt(statsRaw.eventosCompletados, 0);
  const contratosCompletados = optNonNegInt(statsRaw.contratosCompletados, 0);
  const proyectilesDeflectados = optNonNegInt(statsRaw.proyectilesDeflectados, 0);
  const mejorRachaOrbes = optNonNegInt(statsRaw.mejorRachaOrbes, 0);
  const mejorDps = optNonNegNumber(statsRaw.mejorDps, 0);
  if (
    asteroidesDestruidos === null ||
    enemigosDestruidos === null ||
    elitesDestruidos === null ||
    nucleosTotalesGanados === null ||
    pulsosManuales === null ||
    eventosCompletados === null ||
    contratosCompletados === null ||
    proyectilesDeflectados === null ||
    mejorRachaOrbes === null ||
    mejorDps === null
  ) {
    return null;
  }

  return {
    version: 1,
    creditos: Math.floor(obj.creditos),
    nucleos,
    planetaActual: obj.planetaActual,
    planetasDesbloqueados: obj.planetasDesbloqueados,
    objetivosPorPlaneta,
    bodega: {
      unidades: bodegaRaw.unidades,
      valorCreditos: Math.floor(bodegaRaw.valorCreditos),
    },
    mejoras: {
      danoCanon,
      cadencia,
      cascoEscudo,
      capacidadBodega,
      dronApoyo,
      autoventa: mejorasRaw.autoventa,
    },
    sobremarcha: {
      danoCanon: smDano,
      cadencia: smCadencia,
      cascoEscudo: smCasco,
      dronApoyo: smDron,
    },
    flota: {
      caza: flCaza,
      corbeta: flCorbeta,
      fragata: flFragata,
    },
    tecnologia,
    talentos,
    rango: rangoRaw,
    xp: xpRaw,
    prestigioNivel,
    anomaliaDesbloqueada,
    maxOleadaAnomalia,
    postura,
    contratoActivo,
    silencio: obj.silencio,
    tiempoJugadoSegundos: obj.tiempoJugadoSegundos,
    estadisticas: {
      objetivosDestruidos: statsRaw.objetivosDestruidos,
      asteroidesDestruidos,
      enemigosDestruidos,
      elitesDestruidos,
      jefesDerrotados: statsRaw.jefesDerrotados,
      creditosTotalesGanados: Math.floor(statsRaw.creditosTotalesGanados),
      nucleosTotalesGanados,
      pulsosManuales,
      eventosCompletados,
      contratosCompletados,
      proyectilesDeflectados,
      mejorRachaOrbes,
      mejorDps: Math.round(mejorDps * 10) / 10,
    },
  };
}

export function loadSaveData(): { data: SaveDataV1; hasExistingSave: boolean } {
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return { data: createInitialSaveData(), hasExistingSave: false };
    }
    const parsed = JSON.parse(raw);
    const validated = validateSaveData(parsed);
    if (!validated) {
      return { data: createInitialSaveData(), hasExistingSave: false };
    }
    return { data: validated, hasExistingSave: true };
  } catch {
    return { data: createInitialSaveData(), hasExistingSave: false };
  }
}

export function persistSaveData(data: SaveDataV1): void {
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors silently
  }
}

export function clearSaveData(): void {
  try {
    window.localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function exportSaveJson(data: SaveDataV1): string {
  return JSON.stringify(data, null, 2);
}

export function parseAndValidateSaveJson(rawText: string): SaveDataV1 | null {
  try {
    const parsed = JSON.parse(rawText);
    return validateSaveData(parsed);
  } catch {
    return null;
  }
}

