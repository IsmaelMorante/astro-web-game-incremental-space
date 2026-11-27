export type GameScreen = 'TITLE' | 'PLAYING' | 'PAUSED' | 'VICTORY';

export type PlanetId = 1 | 2 | 3 | 4;

export interface PlanetTheme {
  bgCenter: string;
  bgEdge: string;
  asteroidBase: string;
  asteroidShade: string;
  asteroidVein: string;
  enemyAccent: string;
  particleColor: string;
  ambientStyle: 'iron_dust' | 'cobalt_rings' | 'plasma_motes' | 'solar_embers';
}

export interface PlanetConfig {
  id: PlanetId;
  nombre: string;
  asteroidePv: number;
  asteroideRecompensa: number;
  enemigoPv: number;
  enemigoDano: number;
  enemigoCadenciaSeg: number;
  enemigoRecompensa: number;
  umbralJefe: number;
  jefeNombre: string;
  jefePv: number;
  jefeDano: number;
  jefeCadenciaSeg: number;
  jefeRecompensa: number;
  theme: PlanetTheme;
}

export type LinearUpgradeKey =
  | 'danoCanon'
  | 'cadencia'
  | 'cascoEscudo'
  | 'capacidadBodega'
  | 'dronApoyo';

export type UpgradeKey = LinearUpgradeKey | 'autoventa';

export type OverdriveKey = 'danoCanon' | 'cadencia' | 'cascoEscudo' | 'dronApoyo';

export interface MejorasState {
  danoCanon: number;
  cadencia: number;
  cascoEscudo: number;
  capacidadBodega: number;
  dronApoyo: number;
  autoventa: boolean;
}

export interface SobremarchaState {
  danoCanon: number;
  cadencia: number;
  cascoEscudo: number;
  dronApoyo: number;
}

export type FleetShipKey = 'caza' | 'corbeta' | 'fragata';

export interface FlotaState {
  caza: number;
  corbeta: number;
  fragata: number;
}

export interface FleetShipDefinition {
  key: FleetShipKey;
  nombre: string;
  rol: string;
  descripcion: string;
  baseCoste: number;
  multiplicadorCoste: number;
  danoBase: number;
  cadencia: number;
  color: string;
  radioOrbita: number;
}

export type ConsumableKey = 'sobrecarga' | 'reparacion' | 'emp';

export interface ConsumableDefinition {
  key: ConsumableKey;
  nombre: string;
  descripcion: string;
  baseCoste: number;
  duracionSeg: number;
  cooldownSeg: number;
}

export type TechNodeKey =
  | 'imanCuantico'
  | 'rebotes'
  | 'hazDesintegrador'
  | 'fisionMineral'
  | 'conversorEstelar'
  | 'escudoReflector'
  | 'sobrecargaFlota';

export interface TechNodeDefinition {
  key: TechNodeKey;
  nombre: string;
  rama: 'Núcleo' | 'Armamento' | 'Economía' | 'Defensa';
  descripcion: string;
  costeNucleos: number;
  requisitos: TechNodeKey[];
  col: number;
  row: number;
}

export type TalentKey =
  | 'calibrePesado'
  | 'turborefrigeracion'
  | 'imanHiperespacial'
  | 'matrizCritica'
  | 'escudoRegenerativo'
  | 'maestriaFlota';

export interface TalentDefinition {
  key: TalentKey;
  nombre: string;
  efecto: string;
  color: string;
}

export type EliteTrait = 'blindado' | 'veloz' | 'sobrecargado';

export interface BodegaState {
  unidades: number;
  valorCreditos: number;
}

export type RandomEventKey =
  | 'lluviaOro'
  | 'interferenciaMagnetica'
  | 'frenesiCuantico'
  | 'fisuraNucleos'
  | 'tormentaIonica';

export interface RandomEventDefinition {
  key: RandomEventKey;
  nombre: string;
  descripcion: string;
  duracionSeg: number;
  color: string;
}

export interface ActiveRandomEventState {
  key: RandomEventKey;
  nombre: string;
  descripcion: string;
  remainingSec: number;
  durationSec: number;
  color: string;
}

export type ShipStance = 'asalto' | 'equilibrada' | 'escudo';

export interface StanceDefinition {
  key: ShipStance;
  nombre: string;
  atajo: string;
  resumen: string;
  color: string;
}

export type ContractType =
  | 'bajas_manuales'
  | 'asteroides'
  | 'enemigos'
  | 'elites'
  | 'orbes_racha';

export interface SectorContract {
  id: number;
  type: ContractType;
  titulo: string;
  progreso: number;
  meta: number;
  recompensaCreditos: number;
  recompensaNucleos: number;
}

export type UpgradeBuyAmount = 1 | 5 | 'max';

export interface EstadisticasState {
  objetivosDestruidos: number;
  asteroidesDestruidos: number;
  enemigosDestruidos: number;
  elitesDestruidos: number;
  jefesDerrotados: number;
  creditosTotalesGanados: number;
  nucleosTotalesGanados: number;
  pulsosManuales: number;
  eventosCompletados: number;
  contratosCompletados: number;
  proyectilesDeflectados: number;
  mejorRachaOrbes: number;
  mejorDps: number;
}

export interface SaveDataV1 {
  version: 1;
  creditos: number;
  nucleos: number;
  planetaActual: PlanetId;
  planetasDesbloqueados: PlanetId;
  objetivosPorPlaneta: Record<PlanetId, number>;
  bodega: BodegaState;
  mejoras: MejorasState;
  sobremarcha: SobremarchaState;
  flota: FlotaState;
  tecnologia: Record<TechNodeKey, boolean>;
  talentos: Record<TalentKey, number>;
  rango: number;
  xp: number;
  prestigioNivel: number;
  anomaliaDesbloqueada: boolean;
  maxOleadaAnomalia: number;
  postura: ShipStance;
  contratoActivo: SectorContract | null;
  silencio: boolean;
  tiempoJugadoSegundos: number;
  estadisticas: EstadisticasState;
}

export interface UpgradeMilestone {
  nivel: number;
  titulo: string;
  efecto: string;
}

export interface UpgradeDefinition {
  key: UpgradeKey;
  nombre: string;
  descripcion: string;
  tipo: 'Lineal' | 'Único';
  baseCoste: number;
  incrementoCoste: number;
  tope: number;
  hitos: UpgradeMilestone[];
}

export type TargetKind = 'asteroide' | 'enemigo' | 'jefe';

export interface CombatTarget {
  id: number;
  spawnOrder: number;
  kind: TargetKind;
  eliteTrait?: EliteTrait;
  bossPlanetId?: PlanetId;
  bossAttackCount?: number;
  bossSummonedEscorts?: boolean;
  bossPhase2Triggered?: boolean;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  orbitAngle: number;
  orbitSpeed: number;
  orbitRadius: number;
  desiredOrbitRadius: number;
  radius: number;
  hp: number;
  maxHp: number;
  damage: number;
  fireInterval: number;
  fireCooldown: number;
  empStunTimer: number;
  reward: number;
  coreDropCount: number;
  xpValue: number;
  rotation: number;
  rotSpeed: number;
  hitFlash: number;
  telegraph: number;
  vertices: number[];
}

export interface Projectile {
  id: number;
  fromPlayer: boolean;
  sourceKind: 'ship' | 'drone' | 'fleet' | 'manual' | 'enemy' | 'boss';
  fleetKind?: FleetShipKey;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  isCrit?: boolean;
  splashRadius?: number;
  pierceCount?: number;
  bounceCount?: number;
  hitTargetIds?: number[];
  radius: number;
  color: string;
  targetId: number | null;
  life: number;
}

export interface LaserBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

export interface LootOrb {
  id: number;
  kind: 'mineral' | 'valioso' | 'nucleo';
  x: number;
  y: number;
  vx: number;
  vy: number;
  credits: number;
  cores: number;
  xp: number;
  radius: number;
  color: string;
  age: number;
  magnetized: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape?: 'circle' | 'shard';
  rotation?: number;
  rotSpeed?: number;
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
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  speed: number;
  layer: 0 | 1 | 2;
}

export interface AmbientMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export interface ShipStats {
  danoCanon: number;
  proyectilesPorDisparo: number;
  cadencia: number;
  probCritico: number;
  multCritico: number;
  reduccionDano: number;
  cascoMax: number;
  escudoMax: number;
  regenCombatePorSeg: number;
  regenFueraCombatePorSeg: number;
  capacidadBodega: number;
  radioIman: number;
  multBotin: number;
  danoDron: number;
  cantidadDrones: number;
  cadenciaDron: number;
  dpsCanon: number;
  dpsDrones: number;
  dpsFlota: number;
  dpsTotal: number;
}

export interface HudSnapshot {
  creditos: number;
  nucleos: number;
  planetaActual: PlanetId;
  planetasDesbloqueados: PlanetId;
  objetivosPorPlaneta: Record<PlanetId, number>;
  bodega: BodegaState;
  bodegaLlenaAviso: boolean;
  mejoras: MejorasState;
  sobremarcha: SobremarchaState;
  flota: FlotaState;
  tecnologia: Record<TechNodeKey, boolean>;
  talentos: Record<TalentKey, number>;
  rango: number;
  xp: number;
  xpSiguiente: number;
  prestigioNivel: number;
  anomaliaDesbloqueada: boolean;
  anomaliaActiva: boolean;
  oleadaAnomalia: number;
  maxOleadaAnomalia: number;
  silencio: boolean;
  tiempoJugadoSegundos: number;
  estadisticas: EstadisticasState;
  stats: ShipStats;
  cascoActual: number;
  escudoActual: number;
  jefeActivo: { nombre: string; hp: number; maxHp: number } | null;
  objetivoFijadoNombre: string | null;
  alertaTexto: string | null;
  sobrecargaRestanteSeg: number;
  consumableCooldowns: Record<ConsumableKey, number>;
  manualPulseCooldown: number;
  deflectorCooldown: number;
  deflectorMaxCooldown: number;
  postura: ShipStance;
  contratoActivo: SectorContract | null;
  rachaOrbes: number;
  eventoActivo: ActiveRandomEventState | null;
}

export const LOGICAL_WIDTH = 900;
export const LOGICAL_HEIGHT = 600;
export const SHIP_X = LOGICAL_WIDTH / 2;
export const SHIP_Y = LOGICAL_HEIGHT / 2;
export const PLAYER_PROJECTILE_SPEED = 740;
export const ENEMY_PROJECTILE_SPEED = 235;
export const MAX_SIMULTANEOUS_TARGETS = 5;
export const RESPAWN_DELAY_SEC = 0.6;
export const SHIELD_REGEN_DELAY_SEC = 2.0;
export const SHIELD_REGEN_RATE_PER_SEC = 0.22;
export const SHIELD_COMBAT_REGEN_RATE_PER_SEC = 0.04;
export const MAX_SIM_DT_SEC = 0.1;
export const MANUAL_PULSE_COOLDOWN_SEC = 0.25;
export const DEFLECTOR_PULSE_COOLDOWN_SEC = 8.0;
export const DEFLECTOR_PULSE_RADIUS = 155;

export const PALETTE = {
  deepSpace: '#030508',
  panel: '#060A12',
  border: '#1A2742',
  textPrimary: '#F8FAFC',
  textSecondary: '#8B9BB4',
  shipAndDrone: '#00F0FF',
  shield: '#00F0FF',
  asteroidRock: '#0D1322',
  mineralGold: '#FFD600',
  enemy: '#FF2E63',
  boss: '#FF1E56',
  warning: '#FFD600',
  positive: '#00FF9D',
  stellarCore: '#E040FB',
} as const;

export const PLANETS: Record<PlanetId, PlanetConfig> = {
  1: {
    id: 1,
    nombre: 'Cinturón de Hierro',
    asteroidePv: 60,
    asteroideRecompensa: 10,
    enemigoPv: 110,
    enemigoDano: 6,
    enemigoCadenciaSeg: 2.0,
    enemigoRecompensa: 22,
    umbralJefe: 25,
    jefeNombre: 'Perforadora Titán',
    jefePv: 1200,
    jefeDano: 10,
    jefeCadenciaSeg: 2.0,
    jefeRecompensa: 220,
    theme: {
      bgCenter: '#070E1D',
      bgEdge: '#030508',
      asteroidBase: '#0C1220',
      asteroidShade: '#3B4D70',
      asteroidVein: '#FFD600',
      enemyAccent: '#FF2E63',
      particleColor: '#00F0FF',
      ambientStyle: 'iron_dust',
    },
  },
  2: {
    id: 2,
    nombre: 'Órbita de Cobalto',
    asteroidePv: 210,
    asteroideRecompensa: 24,
    enemigoPv: 380,
    enemigoDano: 9,
    enemigoCadenciaSeg: 1.85,
    enemigoRecompensa: 54,
    umbralJefe: 35,
    jefeNombre: 'Fragata Cobalto',
    jefePv: 4600,
    jefeDano: 13,
    jefeCadenciaSeg: 1.85,
    jefeRecompensa: 550,
    theme: {
      bgCenter: '#051530',
      bgEdge: '#02040A',
      asteroidBase: '#081529',
      asteroidShade: '#2563EB',
      asteroidVein: '#00F0FF',
      enemyAccent: '#FF3B9A',
      particleColor: '#38BDF8',
      ambientStyle: 'cobalt_rings',
    },
  },
  3: {
    id: 3,
    nombre: 'Nebulosa de Plasma',
    asteroidePv: 560,
    asteroideRecompensa: 52,
    enemigoPv: 1000,
    enemigoDano: 12,
    enemigoCadenciaSeg: 1.7,
    enemigoRecompensa: 116,
    umbralJefe: 45,
    jefeNombre: 'Crucero Nebular',
    jefePv: 11500,
    jefeDano: 14,
    jefeCadenciaSeg: 1.7,
    jefeRecompensa: 1400,
    theme: {
      bgCenter: '#17072B',
      bgEdge: '#05020A',
      asteroidBase: '#160926',
      asteroidShade: '#9333EA',
      asteroidVein: '#E040FB',
      enemyAccent: '#FF2E63',
      particleColor: '#E040FB',
      ambientStyle: 'plasma_motes',
    },
  },
  4: {
    id: 4,
    nombre: 'Núcleo Estelar',
    asteroidePv: 1200,
    asteroideRecompensa: 105,
    enemigoPv: 1900,
    enemigoDano: 15,
    enemigoCadenciaSeg: 1.6,
    enemigoRecompensa: 240,
    umbralJefe: 50,
    jefeNombre: 'Guardián Solar',
    jefePv: 19000,
    jefeDano: 15,
    jefeCadenciaSeg: 1.6,
    jefeRecompensa: 2500,
    theme: {
      bgCenter: '#20070D',
      bgEdge: '#060204',
      asteroidBase: '#180809',
      asteroidShade: '#EA580C',
      asteroidVein: '#FFD600',
      enemyAccent: '#FF5722',
      particleColor: '#FF9E00',
      ambientStyle: 'solar_embers',
    },
  },
};

export const PLANET_LIST: PlanetConfig[] = [PLANETS[1], PLANETS[2], PLANETS[3], PLANETS[4]];

export const UPGRADE_DEFINITIONS: UpgradeDefinition[] = [
  {
    key: 'danoCanon',
    nombre: 'Daño de cañón',
    descripcion: 'Aumenta el daño por disparo de la nave.',
    tipo: 'Lineal',
    baseCoste: 25,
    incrementoCoste: 25,
    tope: 20,
    hitos: [
      { nivel: 5, titulo: 'Núcleo perforante', efecto: '20 % de crítico (×1,6)' },
      { nivel: 10, titulo: 'Cañón gemelo', efecto: 'Dispara 2 proyectiles' },
      { nivel: 15, titulo: 'Carga plasma', efecto: '+25 % daño de impacto' },
      { nivel: 20, titulo: 'Salva triple', efecto: 'Dispara 3 proyectiles' },
    ],
  },
  {
    key: 'cadencia',
    nombre: 'Cadencia',
    descripcion: 'Aumenta los disparos por segundo del cañón.',
    tipo: 'Lineal',
    baseCoste: 30,
    incrementoCoste: 35,
    tope: 15,
    hitos: [
      { nivel: 5, titulo: 'Refrigeración activa', efecto: '+15 % cadencia total' },
      { nivel: 10, titulo: 'Ráfaga sincronizada', efecto: '+20 % cadencia adicional' },
      { nivel: 15, titulo: 'Ciclón balístico', efecto: '+25 % cadencia máxima' },
    ],
  },
  {
    key: 'cascoEscudo',
    nombre: 'Casco y Escudo',
    descripcion: 'Refuerza el blindaje del casco y la capacidad del escudo.',
    tipo: 'Lineal',
    baseCoste: 35,
    incrementoCoste: 30,
    tope: 15,
    hitos: [
      { nivel: 5, titulo: 'Blindaje reactivo', efecto: '-15 % daño recibido' },
      { nivel: 10, titulo: 'Campo Aegis', efecto: 'Doble regen. en combate' },
      { nivel: 15, titulo: 'Núcleo Titán', efecto: '+30 % escudo máximo' },
    ],
  },
  {
    key: 'capacidadBodega',
    nombre: 'Capacidad de bodega',
    descripcion: 'Amplía la bodega y el campo magnético.',
    tipo: 'Lineal',
    baseCoste: 30,
    incrementoCoste: 25,
    tope: 10,
    hitos: [
      { nivel: 5, titulo: 'Compresor mineral', efecto: '+10 % valor de venta' },
      { nivel: 10, titulo: 'Bodega estelar', efecto: '+25 % valor de venta total' },
    ],
  },
  {
    key: 'dronApoyo',
    nombre: 'Dron de apoyo',
    descripcion: 'Dron autónomo orbital desde el nivel 1.',
    tipo: 'Lineal',
    baseCoste: 60,
    incrementoCoste: 60,
    tope: 10,
    hitos: [
      { nivel: 5, titulo: 'Dron gemelo', efecto: '2 drones a 1,4 disp/s' },
      { nivel: 10, titulo: 'Enjambre orbital', efecto: '3 drones con pulso de área' },
    ],
  },
  {
    key: 'autoventa',
    nombre: 'Autoventa',
    descripcion: 'Vende la bodega actual y convierte cada recurso al instante.',
    tipo: 'Único',
    baseCoste: 500,
    incrementoCoste: 0,
    tope: 1,
    hitos: [],
  },
];

export const FLEET_DEFINITIONS: FleetShipDefinition[] = [
  {
    key: 'caza',
    nombre: 'Caza interceptor',
    rol: 'Ataque ligero',
    descripcion: 'Escolta ágil que dispara proyectiles rápidos al objetivo más cercano.',
    baseCoste: 350,
    multiplicadorCoste: 1.45,
    danoBase: 28,
    cadencia: 2.2,
    color: '#38BDF8',
    radioOrbita: 68,
  },
  {
    key: 'corbeta',
    nombre: 'Corbeta láser',
    rol: 'Perforación',
    descripcion: 'Nave de medio alcance con disparos de energía que atraviesan 2 objetivos.',
    baseCoste: 750,
    multiplicadorCoste: 1.5,
    danoBase: 85,
    cadencia: 1.1,
    color: '#A78BFA',
    radioOrbita: 92,
  },
  {
    key: 'fragata',
    nombre: 'Fragata extractora',
    rol: 'Artillería pesada',
    descripcion: 'Crucero de apoyo que lanza cargas expansivas con daño en área.',
    baseCoste: 1300,
    multiplicadorCoste: 1.55,
    danoBase: 190,
    cadencia: 0.7,
    color: '#F59E0B',
    radioOrbita: 114,
  },
];

export const CONSUMABLE_DEFINITIONS: ConsumableDefinition[] = [
  {
    key: 'sobrecarga',
    nombre: 'Sobrecarga',
    descripcion: '+50 % daño total durante 15 s',
    baseCoste: 160,
    duracionSeg: 15,
    cooldownSeg: 20,
  },
  {
    key: 'reparacion',
    nombre: 'Reparación',
    descripcion: 'Restaura 100 % escudo y casco',
    baseCoste: 120,
    duracionSeg: 0,
    cooldownSeg: 12,
  },
  {
    key: 'emp',
    nombre: 'Bomba EMP',
    descripcion: 'Daño masivo en pantalla y aturde 2,5 s',
    baseCoste: 220,
    duracionSeg: 0,
    cooldownSeg: 16,
  },
];

export const TECH_TREE_NODES: TechNodeDefinition[] = [
  {
    key: 'imanCuantico',
    nombre: 'Imán Cuántico',
    rama: 'Núcleo',
    descripcion: '+140 px de radio magnético y atracción veloz de orbes.',
    costeNucleos: 1,
    requisitos: [],
    col: 1,
    row: 0,
  },
  {
    key: 'rebotes',
    nombre: 'Proyectiles Rebotantes',
    rama: 'Armamento',
    descripcion: 'Los disparos del cañón rebotan 1 vez hacia otro objetivo cercano.',
    costeNucleos: 2,
    requisitos: ['imanCuantico'],
    col: 0,
    row: 1,
  },
  {
    key: 'fisionMineral',
    nombre: 'Fisión Mineral',
    rama: 'Economía',
    descripcion: '+30 % valor de créditos en todos los orbes recogidos.',
    costeNucleos: 2,
    requisitos: ['imanCuantico'],
    col: 1,
    row: 1,
  },
  {
    key: 'escudoReflector',
    nombre: 'Escudo Reflector',
    rama: 'Defensa',
    descripcion: 'Al recibir impacto en escudo, devuelve un pulso de 150 % daño de cañón.',
    costeNucleos: 2,
    requisitos: ['imanCuantico'],
    col: 2,
    row: 1,
  },
  {
    key: 'hazDesintegrador',
    nombre: 'Haz Desintegrador',
    rama: 'Armamento',
    descripcion: 'Cada 6.º disparo emite un láser instantáneo de 3× daño.',
    costeNucleos: 4,
    requisitos: ['rebotes'],
    col: 0,
    row: 2,
  },
  {
    key: 'conversorEstelar',
    nombre: 'Conversor Estelar',
    rama: 'Economía',
    descripcion: 'Los enemigos normales tienen 18 % prob. de soltar 1 Núcleo Estelar.',
    costeNucleos: 4,
    requisitos: ['fisionMineral'],
    col: 1,
    row: 2,
  },
  {
    key: 'sobrecargaFlota',
    nombre: 'Sobrecarga de Flota',
    rama: 'Defensa',
    descripcion: 'Drones y naves de flota obtienen +35 % de daño total.',
    costeNucleos: 4,
    requisitos: ['escudoReflector'],
    col: 2,
    row: 2,
  },
];

export const TALENT_DEFINITIONS: TalentDefinition[] = [
  {
    key: 'calibrePesado',
    nombre: 'Calibre Pesado',
    efecto: '+18 % daño de cañón y pulso manual',
    color: '#38BDF8',
  },
  {
    key: 'turborefrigeracion',
    nombre: 'Turborefrigeración',
    efecto: '+15 % cadencia de disparo',
    color: '#22D3EE',
  },
  {
    key: 'imanHiperespacial',
    nombre: 'Imán Hiperespacial',
    efecto: '+85 px radio magnético y +12 % valor de orbes',
    color: '#F59E0B',
  },
  {
    key: 'matrizCritica',
    nombre: 'Matriz Crítica',
    efecto: '+8 % prob. crítico y +25 % daño crítico',
    color: '#FBBF24',
  },
  {
    key: 'escudoRegenerativo',
    nombre: 'Escudo Regenerativo',
    efecto: '+20 % escudo máximo y +35 % regeneración',
    color: '#10B981',
  },
  {
    key: 'maestriaFlota',
    nombre: 'Maestría de Flota',
    efecto: '+22 % daño de drones y flota aliada',
    color: '#C084FC',
  },
];

export const RANDOM_EVENT_DEFINITIONS: RandomEventDefinition[] = [
  {
    key: 'lluviaOro',
    nombre: 'Lluvia de meteoritos de oro',
    descripcion: '×2 valor de orbes y meteoritos dorados con botín extra.',
    duracionSeg: 14,
    color: '#F59E0B',
  },
  {
    key: 'interferenciaMagnetica',
    nombre: 'Interferencia magnética',
    descripcion: 'Imán de nave reducido: ¡barre los orbes con el cursor por +65 % valor!',
    duracionSeg: 12,
    color: '#22D3EE',
  },
  {
    key: 'frenesiCuantico',
    nombre: 'Frenesí cuántico',
    descripcion: '+45 % cadencia de fuego y +25 % prob. de crítico.',
    duracionSeg: 12,
    color: '#38BDF8',
  },
  {
    key: 'fisuraNucleos',
    nombre: 'Fisura de Núcleos',
    descripcion: 'Aparece un Cristal Estelar y +35 % XP en todos los orbes.',
    duracionSeg: 13,
    color: '#C084FC',
  },
  {
    key: 'tormentaIonica',
    nombre: 'Tormenta iónica',
    descripcion: 'Enemigos disparan 35 % más lento · Clic directo inflige 2,2× daño.',
    duracionSeg: 12,
    color: '#FBBF24',
  },
];

export const STANCE_DEFINITIONS: StanceDefinition[] = [
  {
    key: 'asalto',
    nombre: 'Asalto',
    atajo: '1',
    resumen: '+25 % daño y +20 % cadencia · -20 % regen. escudo',
    color: '#FF2E63',
  },
  {
    key: 'equilibrada',
    nombre: 'Equilibrada',
    atajo: '2',
    resumen: 'Rendimiento estándar en ataque y defensa',
    color: '#00F0FF',
  },
  {
    key: 'escudo',
    nombre: 'Escudo',
    atajo: '3',
    resumen: '+45 % regen. escudo, +90 px imán y +10 % blindaje',
    color: '#00FF9D',
  },
];

export const SAVE_STORAGE_KEY = 'astro-incremental-save-v1';

export function createInitialSaveData(): SaveDataV1 {
  return {
    version: 1,
    creditos: 0,
    nucleos: 0,
    planetaActual: 1,
    planetasDesbloqueados: 1,
    objetivosPorPlaneta: {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
    },
    bodega: {
      unidades: 0,
      valorCreditos: 0,
    },
    mejoras: {
      danoCanon: 0,
      cadencia: 0,
      cascoEscudo: 0,
      capacidadBodega: 0,
      dronApoyo: 0,
      autoventa: false,
    },
    sobremarcha: {
      danoCanon: 0,
      cadencia: 0,
      cascoEscudo: 0,
      dronApoyo: 0,
    },
    flota: {
      caza: 0,
      corbeta: 0,
      fragata: 0,
    },
    tecnologia: {
      imanCuantico: false,
      rebotes: false,
      hazDesintegrador: false,
      fisionMineral: false,
      conversorEstelar: false,
      escudoReflector: false,
      sobrecargaFlota: false,
    },
    talentos: {
      calibrePesado: 0,
      turborefrigeracion: 0,
      imanHiperespacial: 0,
      matrizCritica: 0,
      escudoRegenerativo: 0,
      maestriaFlota: 0,
    },
    rango: 1,
    xp: 0,
    prestigioNivel: 0,
    anomaliaDesbloqueada: false,
    maxOleadaAnomalia: 0,
    postura: 'equilibrada',
    contratoActivo: null,
    silencio: false,
    tiempoJugadoSegundos: 0,
    estadisticas: {
      objetivosDestruidos: 0,
      asteroidesDestruidos: 0,
      enemigosDestruidos: 0,
      elitesDestruidos: 0,
      jefesDerrotados: 0,
      creditosTotalesGanados: 0,
      nucleosTotalesGanados: 0,
      pulsosManuales: 0,
      eventosCompletados: 0,
      contratosCompletados: 0,
      proyectilesDeflectados: 0,
      mejorRachaOrbes: 0,
      mejorDps: 0,
    },
  };
}
