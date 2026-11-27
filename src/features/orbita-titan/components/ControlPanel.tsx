import React, { useEffect, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Pause,
  RotateCcw,
  Crosshair,
  Package,
  ShieldAlert,
  Zap,
  HeartPulse,
  Radio,
  Sparkles,
  Rocket,
  Shield,
  Target,
  Infinity as InfinityIcon,
} from 'lucide-react';
import {
  formatCredits,
  formatDecimal,
  formatInt,
  formatTimeMMSS,
  getBulkFleetPreview,
  getBulkUpgradePreview,
  getConsumableCost,
  getFleetDamageMultiplier,
  getNextUpgradeDeltaLabel,
  getPrestigeDamageMultiplier,
  getUpgradeEffectLabel,
  getUpgradeLevel,
  isOverdriveSupported,
} from '../game/formulas';
import {
  CONSUMABLE_DEFINITIONS,
  FLEET_DEFINITIONS,
  PLANETS,
  PLANET_LIST,
  STANCE_DEFINITIONS,
  TALENT_DEFINITIONS,
  UPGRADE_DEFINITIONS,
  type ConsumableKey,
  type FleetShipKey,
  type HudSnapshot,
  type OverdriveKey,
  type PlanetId,
  type ShipStance,
  type TechNodeKey,
  type UpgradeBuyAmount,
  type UpgradeKey,
} from '../game/types';
import { TechTreeTab } from './TechTreeTab';

type PanelTab = 'mejoras' | 'tecnologia' | 'flota' | 'estadisticas';

interface ControlPanelProps {
  hud: HudSnapshot;
  onSellAll: () => void;
  onBuyUpgrade: (key: UpgradeKey, amount: UpgradeBuyAmount) => void;
  onSetStance: (stance: ShipStance) => void;
  onTriggerDeflector: () => void;
  onCycleTarget: () => void;
  onBuyTechNode: (key: TechNodeKey) => void;
  onBuyFleetShip: (key: FleetShipKey, amount: UpgradeBuyAmount) => void;
  onUseConsumable: (key: ConsumableKey) => void;
  onChallengeBoss: () => void;
  onSelectPlanet: (planetId: PlanetId) => void;
  onToggleAnomaly: () => void;
  onRequestPrestige: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRequestReset: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  hud,
  onSellAll,
  onBuyUpgrade,
  onSetStance,
  onTriggerDeflector,
  onCycleTarget,
  onBuyTechNode,
  onBuyFleetShip,
  onUseConsumable,
  onChallengeBoss,
  onSelectPlanet,
  onToggleAnomaly,
  onRequestPrestige,
  onToggleMute,
  onPause,
  onRequestReset,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('mejoras');
  const [buyAmount, setBuyAmount] = useState<UpgradeBuyAmount>(1);
  const [fleetBuyAmount, setFleetBuyAmount] = useState<UpgradeBuyAmount>(1);

  useEffect(() => {
    const onTabShortcut = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === '1') {
        e.preventDefault();
        setActiveTab('mejoras');
      } else if (e.key === '2') {
        e.preventDefault();
        setActiveTab('tecnologia');
      } else if (e.key === '3') {
        e.preventDefault();
        setActiveTab('flota');
      } else if (e.key === '4') {
        e.preventDefault();
        setActiveTab('estadisticas');
      }
    };
    window.addEventListener('keydown', onTabShortcut);
    return () => window.removeEventListener('keydown', onTabShortcut);
  }, []);

  const currentPlanet = PLANETS[hud.planetaActual];
  const progress = hud.objetivosPorPlaneta[hud.planetaActual];
  const bossReady = progress >= currentPlanet.umbralJefe;
  const bossActive = hud.jefeActivo !== null;
  const cargoPct = Math.min(100, (hud.bodega.unidades / Math.max(1, hud.stats.capacidadBodega)) * 100);
  const cargoFull = !hud.mejoras.autoventa && hud.bodega.unidades >= hud.stats.capacidadBodega;
  const totalFleetCount = hud.flota.caza + hud.flota.corbeta + hud.flota.fragata;
  const xpPct = Math.min(100, (hud.xp / Math.max(1, hud.xpSiguiente)) * 100);
  const prestigeDmgBonusPct = Math.round((getPrestigeDamageMultiplier(hud.prestigioNivel) - 1) * 100);
  const activeStance = STANCE_DEFINITIONS.find((s) => s.key === hud.postura) ?? STANCE_DEFINITIONS[1];
  const fleetMult = getFleetDamageMultiplier(
    hud.tecnologia,
    hud.talentos,
    hud.prestigioNivel,
    hud.sobrecargaRestanteSeg > 0,
    hud.postura
  );

  const activeTalents = TALENT_DEFINITIONS.filter((t) => (hud.talentos[t.key] || 0) > 0);

  return (
    <aside
      aria-label="Panel de mando, tecnología, flota y mejoras"
      className="arcade-console-surface flex flex-col w-full [@media(min-width:640px)_and_(orientation:landscape)]:w-[clamp(295px,31vw,480px)] shrink-0 border-t [@media(min-width:640px)_and_(orientation:landscape)]:border-t-0 [@media(min-width:640px)_and_(orientation:landscape)]:border-l border-[#00F0FF]/35 h-full overflow-y-auto overflow-x-hidden"
    >
      {/* Top Currencies, XP Rank & Utility Row */}
      <div className="p-3 sm:p-4 border-b border-[#1A2742] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] sm:text-xs text-[#8B9BB4] flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span>Créditos</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#E040FB] font-mono tabular-nums font-semibold">
                {formatInt(hud.nucleos)} Núcleos
              </span>
              {hud.prestigioNivel > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#FFD600] font-mono tabular-nums">
                    P{hud.prestigioNivel} (+{prestigeDmgBonusPct}%)
                  </span>
                </>
              )}
            </div>
            <div className="text-[clamp(1.2rem,2.2vw,1.6rem)] font-display font-bold text-[#F8FAFC] font-mono tabular-nums leading-tight truncate">
              {formatCredits(hud.creditos)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={hud.silencio ? 'Activar sonido' : 'Silenciar'}
              title={hud.silencio ? 'Activar sonido (M)' : 'Silenciar (M)'}
              className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] px-2 xl:px-2.5 flex items-center justify-center gap-1.5 bg-[#030508] border border-[#1A2742] text-xs font-display font-semibold text-[#F8FAFC] hover:border-[#00F0FF] hover:text-[#00F0FF] transition-colors whitespace-nowrap shrink-0"
            >
              {hud.silencio ? (
                <VolumeX className="w-4 h-4 text-[#8B9BB4]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#00F0FF]" />
              )}
              <span className="hidden xl:inline">{hud.silencio ? 'Silencio' : 'Audio'}</span>
            </button>

            <button
              type="button"
              onClick={onPause}
              aria-label="Pausa"
              title="Pausa (Esc)"
              className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center bg-[#030508] border border-[#1A2742] text-[#F8FAFC] hover:border-[#00F0FF] hover:text-[#00F0FF] transition-colors shrink-0"
            >
              <Pause className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onRequestReset}
              aria-label="Reiniciar partida"
              title="Reiniciar partida"
              className="min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center bg-[#030508] border border-[#1A2742] text-[#8B9BB4] hover:text-[#FF2E63] hover:border-[#FF2E63] transition-colors shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* XP Rank Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] tabular-nums">
            <span className="text-[#E040FB] font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>Rango {hud.rango} · {activeTalents.reduce((s, t) => s + hud.talentos[t.key], 0)} talentos</span>
            </span>
            <span className="font-mono text-[#8B9BB4]">
              {formatInt(hud.xp)} / {formatInt(hud.xpSiguiente)} XP
            </span>
          </div>
          <div className="h-1.5 w-full bg-[#030508] overflow-hidden border border-[#1A2742]">
            <div
              className="h-full bg-[#E040FB] transition-all duration-150"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-1.5 text-[11px] sm:text-xs text-[#8B9BB4] tabular-nums flex-wrap">
          <span>
            DPS: <strong className="font-mono text-[#00F0FF]">{formatDecimal(hud.stats.dpsTotal, 1)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Tiempo: <strong className="font-mono text-[#F8FAFC]">{formatTimeMMSS(hud.tiempoJugadoSegundos)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Bajas: <strong className="font-mono text-[#F8FAFC]">{formatInt(hud.estadisticas.objetivosDestruidos)}</strong>
          </span>
        </div>

        {hud.eventoActivo && (
          <div
            className="bg-[#030508] border px-2.5 py-2 space-y-1.5"
            style={{ borderColor: hud.eventoActivo.color }}
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-display font-bold truncate" style={{ color: hud.eventoActivo.color }}>
                {hud.eventoActivo.nombre}
              </span>
              <span className="font-mono tabular-nums text-[#F8FAFC] shrink-0">
                {Math.ceil(hud.eventoActivo.remainingSec)}s
              </span>
            </div>
            <p className="text-[11px] text-[#8B9BB4] leading-snug">
              {hud.eventoActivo.descripcion}
            </p>
            <div className="h-1 w-full bg-[#060A12] overflow-hidden">
              <div
                className="h-full transition-all duration-150"
                style={{
                  backgroundColor: hud.eventoActivo.color,
                  width: `${Math.min(100, (hud.eventoActivo.remainingSec / Math.max(1, hud.eventoActivo.durationSec)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tactical Stances, Deflector Pulse & Instant Consumables */}
      <section className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#1A2742] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-display font-bold text-[#8B9BB4] tracking-wide">
            Posturas y táctica
          </h2>
          {hud.sobrecargaRestanteSeg > 0 && (
            <span className="text-xs font-mono text-[#FFD600] tabular-nums">
              Sobrecarga {Math.ceil(hud.sobrecargaRestanteSeg)}s
            </span>
          )}
        </div>

        {/* 3 Combat Stances (1 / 2 / 3) */}
        <div className="grid grid-cols-3 gap-1.5">
          {STANCE_DEFINITIONS.map((stance) => {
            const active = hud.postura === stance.key;
            return (
              <button
                key={stance.key}
                type="button"
                onClick={() => onSetStance(stance.key)}
                title={`${stance.nombre} (${stance.atajo}): ${stance.resumen}`}
                style={
                  active
                    ? {
                        borderColor: stance.color,
                        backgroundColor: `${stance.color}20`,
                        color: stance.color,
                      }
                    : undefined
                }
                className={`min-h-[36px] px-1.5 py-1 border text-[11px] font-display font-bold transition-colors flex items-center justify-center gap-1 min-w-0 ${
                  active
                    ? ''
                    : 'bg-[#030508] border-[#1A2742] text-[#8B9BB4] hover:text-[#F8FAFC] hover:border-[#00F0FF]/50'
                }`}
              >
                <span className="font-mono opacity-75">[{stance.atajo}]</span>
                <span className="truncate">{stance.nombre}</span>
              </button>
            );
          })}
        </div>

        {/* Active Deflector Pulse (Space) & Target Cycle (Tab) */}
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <button
            type="button"
            disabled={hud.deflectorCooldown > 0}
            onClick={onTriggerDeflector}
            title="Vaporiza proyectiles enemigos cercanos y recarga escudo (Barra espaciadora)"
            className={`min-h-[38px] px-2.5 py-1.5 border text-xs font-display font-bold transition-colors flex items-center justify-between gap-2 min-w-0 ${
              hud.deflectorCooldown <= 0
                ? 'bg-[#030508] border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF] hover:text-[#030508]'
                : 'bg-[#030508]/60 border-[#1A2742] text-[#8B9BB4]'
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Pulso deflector [Esp]</span>
            </span>
            <span className="font-mono text-[11px] tabular-nums shrink-0">
              {hud.deflectorCooldown <= 0
                ? 'LISTO'
                : `${hud.deflectorCooldown.toFixed(1)}s`}
            </span>
          </button>

          <button
            type="button"
            onClick={onCycleTarget}
            title={
              hud.objetivoFijadoNombre
                ? `Objetivo fijado: ${hud.objetivoFijadoNombre} (Tab para cambiar)`
                : 'Fijar objetivo prioritario (Tab)'
            }
            className={`min-h-[38px] px-2.5 py-1.5 border text-xs font-display font-bold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 ${
              hud.objetivoFijadoNombre
                ? 'bg-[#00F0FF]/15 border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF] hover:text-[#030508]'
                : 'bg-[#030508] border-[#1A2742] text-[#8B9BB4] hover:border-[#00F0FF] hover:text-[#00F0FF]'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" />
            <span>Fijar [Tab]</span>
          </button>
        </div>

        {/* 3 Tactical Consumables (Q / W / E) */}
        <div className="grid grid-cols-3 gap-2">
          {CONSUMABLE_DEFINITIONS.map((def) => {
            const cost = getConsumableCost(def.key, hud.anomaliaActiva ? 4 : hud.planetaActual);
            const cd = hud.consumableCooldowns[def.key];
            const canUse = cd <= 0 && hud.creditos >= cost;
            const Icon =
              def.key === 'sobrecarga' ? Zap : def.key === 'reparacion' ? HeartPulse : Radio;
            const shortcut = def.key === 'sobrecarga' ? 'Q' : def.key === 'reparacion' ? 'W' : 'E';

            return (
              <button
                key={def.key}
                type="button"
                disabled={!canUse}
                onClick={() => onUseConsumable(def.key)}
                title={`${def.nombre} (${shortcut}): ${def.descripcion}`}
                className={`min-h-[48px] px-2 py-1.5 border text-left transition-colors flex flex-col justify-between ${
                  canUse
                    ? 'bg-[#030508] border-[#00F0FF]/70 hover:bg-[#00F0FF] hover:text-[#030508] text-[#F8FAFC] group'
                    : 'bg-[#030508]/60 border-[#1A2742] text-[#8B9BB4]'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-xs font-display font-semibold whitespace-nowrap">
                  <span className="flex items-center gap-1 min-w-0">
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        def.key === 'sobrecarga'
                          ? 'text-[#FFD600] group-hover:text-[#030508]'
                          : def.key === 'reparacion'
                            ? 'text-[#00FF9D] group-hover:text-[#030508]'
                            : 'text-[#00F0FF] group-hover:text-[#030508]'
                      }`}
                    />
                    <span className="truncate">{def.nombre}</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-65 shrink-0">{shortcut}</span>
                </div>
                <div className="text-[11px] font-mono tabular-nums opacity-85">
                  {cd > 0 ? `Esp. ${Math.ceil(cd)}s` : formatCredits(cost)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Cargo Hold (hidden dead bar once Autoventa is unlocked) */}
      {!hud.mejoras.autoventa ? (
        <section className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#1A2742] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Package className="w-4 h-4 text-[#FFD600] shrink-0" />
              <h2 className="text-sm font-display font-bold text-[#F8FAFC] truncate">Bodega de carga</h2>
            </div>

            <span className="text-xs font-mono tabular-nums text-[#8B9BB4] shrink-0">
              {formatInt(hud.bodega.unidades)} / {formatInt(hud.stats.capacidadBodega)}
            </span>
          </div>

          <div className="h-2 w-full bg-[#030508] overflow-hidden border border-[#1A2742]">
            <div
              className="h-full transition-all duration-150 bg-[#FFD600]"
              style={{ width: `${cargoPct}%` }}
            />
          </div>

          {cargoFull && (
            <div className="text-xs font-medium text-[#FFD600]">
              Bodega llena: vende la carga para seguir recogiendo orbes.
            </div>
          )}

          <button
            type="button"
            disabled={hud.bodega.unidades === 0}
            onClick={onSellAll}
            className={`w-full min-h-[42px] sm:min-h-[44px] px-3 sm:px-4 py-2 font-display font-bold text-xs sm:text-sm transition-colors flex items-center justify-center min-w-0 ${
              hud.bodega.unidades > 0
                ? 'bg-[#00FF9D] text-[#030508] hover:bg-[#F8FAFC]'
                : 'bg-[#030508] border border-[#1A2742] text-[#8B9BB4]'
            }`}
          >
            <span className="truncate">Vender todo ({formatCredits(hud.bodega.valorCreditos)})</span>
          </button>
        </section>
      ) : (
        <div className="px-3 sm:px-4 py-2 border-b border-[#1A2742] flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-[#00FF9D] font-display font-semibold truncate">
            <Package className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Autoventa activa</span>
          </span>
          <span className="font-mono text-[#8B9BB4] tabular-nums shrink-0">
            Botín ×{formatDecimal(hud.stats.multBotin, 2)} · Imán {formatInt(hud.stats.radioIman)}px
          </span>
        </div>
      )}

      {/* Sharp Vector Navigation Tabs */}
      <div className="px-3 sm:px-4 pt-2.5 sm:pt-3 pb-2 border-b border-[#1A2742]">
        <div
          role="tablist"
          aria-label="Secciones del panel de mando"
          className="grid grid-cols-4 gap-1 bg-[#030508] border border-[#1A2742] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'mejoras'}
            aria-keyshortcuts="Alt+1"
            title="Mejoras y sectores (Alt+1)"
            onClick={() => setActiveTab('mejoras')}
            className={`min-h-[38px] sm:min-h-[40px] px-1 text-[11px] font-display font-bold transition-colors truncate ${
              activeTab === 'mejoras'
                ? 'bg-[#00F0FF] text-[#030508]'
                : 'text-[#8B9BB4] hover:text-[#F8FAFC]'
            }`}
          >
            Mejoras
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tecnologia'}
            aria-keyshortcuts="Alt+2"
            title="Árbol tecnológico (Alt+2)"
            onClick={() => setActiveTab('tecnologia')}
            className={`min-h-[38px] sm:min-h-[40px] px-1 text-[11px] font-display font-bold transition-colors truncate tabular-nums ${
              activeTab === 'tecnologia'
                ? 'bg-[#E040FB] text-[#030508]'
                : 'text-[#8B9BB4] hover:text-[#F8FAFC]'
            }`}
          >
            Tecnol.{hud.nucleos > 0 ? ` (${hud.nucleos})` : ''}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'flota'}
            aria-keyshortcuts="Alt+3"
            title="Flota de escolta (Alt+3)"
            onClick={() => setActiveTab('flota')}
            className={`min-h-[38px] sm:min-h-[40px] px-1 text-[11px] font-display font-bold transition-colors truncate tabular-nums ${
              activeTab === 'flota'
                ? 'bg-[#00F0FF] text-[#030508]'
                : 'text-[#8B9BB4] hover:text-[#F8FAFC]'
            }`}
          >
            Flota ({formatInt(totalFleetCount)})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'estadisticas'}
            aria-keyshortcuts="Alt+4"
            title="Estadísticas de misión (Alt+4)"
            onClick={() => setActiveTab('estadisticas')}
            className={`min-h-[38px] sm:min-h-[40px] px-1 text-[11px] font-display font-bold transition-colors truncate ${
              activeTab === 'estadisticas'
                ? 'bg-[#00F0FF] text-[#030508]'
                : 'text-[#8B9BB4] hover:text-[#F8FAFC]'
            }`}
          >
            Stats
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-3 sm:p-4 space-y-4 flex-1">
        {activeTab === 'mejoras' && (
          <>
            {/* Active Sector Contract */}
            {hud.contratoActivo && (
              <section className="bg-[#030508] border border-[#00FF9D]/40 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-display font-bold text-[#00FF9D] truncate">
                    <Target className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Contrato #{hud.contratoActivo.id}</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[#F8FAFC] shrink-0">
                    +{formatCredits(hud.contratoActivo.recompensaCreditos)}
                    {hud.contratoActivo.recompensaNucleos > 0
                      ? ` · +${hud.contratoActivo.recompensaNucleos} Núcl.`
                      : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-[#8B9BB4]">
                  <span className="truncate">{hud.contratoActivo.titulo}</span>
                  <span className="font-mono text-[#F8FAFC] tabular-nums shrink-0">
                    {formatInt(hud.contratoActivo.progreso)}/{formatInt(hud.contratoActivo.meta)}
                  </span>
                </div>
                <div className="h-1 w-full bg-[#060A12] overflow-hidden">
                  <div
                    className="h-full bg-[#00FF9D] transition-all duration-150"
                    style={{
                      width: `${Math.min(100, (hud.contratoActivo.progreso / Math.max(1, hud.contratoActivo.meta)) * 100)}%`,
                    }}
                  />
                </div>
              </section>
            )}

            {/* Planets, Boss Challenge, Anomaly & Prestige */}
            <section className="space-y-2.5 pb-3 border-b border-[#1A2742]">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-display font-bold text-[#F8FAFC]">Sector orbital</h2>
                <span className="text-xs text-[#8B9BB4] truncate">
                  {hud.anomaliaActiva
                    ? `Anomalía Infinita · Oleada ${hud.oleadaAnomalia}`
                    : currentPlanet.nombre}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {PLANET_LIST.map((planet) => {
                  const unlocked = planet.id <= hud.planetasDesbloqueados;
                  const active = !hud.anomaliaActiva && planet.id === hud.planetaActual;
                  return (
                    <button
                      key={planet.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => onSelectPlanet(planet.id)}
                      className={`min-h-[42px] sm:min-h-[44px] px-1 sm:px-2 py-1.5 border text-center transition-colors min-w-0 ${
                        active
                          ? 'bg-[#00F0FF]/15 border-[#00F0FF] text-[#F8FAFC]'
                          : unlocked
                            ? 'bg-[#030508] border-[#1A2742] text-[#8B9BB4] hover:text-[#F8FAFC] hover:border-[#00F0FF]/60'
                            : 'bg-[#030508]/50 border-[#1A2742]/50 text-[#8B9BB4]/40'
                      }`}
                    >
                      <div className="text-xs font-display font-bold">P{planet.id}</div>
                      <div className="text-[10px] sm:text-[11px] font-mono tabular-nums truncate">
                        {unlocked
                          ? `${Math.min(hud.objetivosPorPlaneta[planet.id], planet.umbralJefe)}/${planet.umbralJefe}`
                          : 'Bloq.'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {!hud.anomaliaActiva && (
                <button
                  type="button"
                  disabled={!bossReady || bossActive}
                  onClick={onChallengeBoss}
                  className={`w-full min-h-[42px] sm:min-h-[44px] px-3 sm:px-4 py-2 font-display font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors min-w-0 ${
                    bossActive
                      ? 'bg-[#FF2E63]/20 border border-[#FF2E63] text-[#FF2E63]'
                      : bossReady
                        ? 'bg-[#FF2E63] text-[#F8FAFC] hover:bg-[#FF1E56]'
                        : 'bg-[#030508] border border-[#1A2742] text-[#8B9BB4]'
                  }`}
                >
                  {bossActive ? (
                    <>
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span className="truncate">En combate: {hud.jefeActivo?.nombre}</span>
                    </>
                  ) : bossReady ? (
                    <>
                      <Crosshair className="w-4 h-4 shrink-0" />
                      <span className="truncate">Desafiar jefe · {currentPlanet.jefeNombre}</span>
                    </>
                  ) : (
                    <span className="truncate">
                      Desafiar jefe ({formatInt(progress)}/{formatInt(currentPlanet.umbralJefe)} obj.)
                    </span>
                  )}
                </button>
              )}

              {hud.anomaliaDesbloqueada && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onToggleAnomaly}
                    className={`min-h-[42px] sm:min-h-[44px] px-2 py-1.5 border text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-colors min-w-0 ${
                      hud.anomaliaActiva
                        ? 'bg-[#E040FB] text-[#030508] border-[#E040FB]'
                        : 'bg-[#030508] border-[#E040FB]/70 text-[#E040FB] hover:bg-[#E040FB] hover:text-[#030508]'
                    }`}
                  >
                    <InfinityIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {hud.anomaliaActiva
                        ? `Anomalía O${hud.oleadaAnomalia}`
                        : `Anomalía (Réc. ${hud.maxOleadaAnomalia})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onRequestPrestige}
                    className="min-h-[42px] sm:min-h-[44px] px-2 py-1.5 border border-[#FFD600]/70 bg-[#030508] text-[#FFD600] hover:bg-[#FFD600] hover:text-[#030508] text-xs font-display font-bold flex items-center justify-center gap-1.5 transition-colors min-w-0"
                  >
                    <Rocket className="w-4 h-4 shrink-0" />
                    <span className="truncate">Salto (P{hud.prestigioNivel + 1})</span>
                  </button>
                </div>
              )}
            </section>

            {/* 6 Upgrades + Milestones + Overdrive + Bulk Buy */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-display font-bold text-[#F8FAFC]">Sistemas e hitos</h2>
                <div className="flex items-center border border-[#1A2742] bg-[#030508] p-0.5 shrink-0">
                  {([1, 5, 'max'] as UpgradeBuyAmount[]).map((amt) => (
                    <button
                      key={String(amt)}
                      type="button"
                      onClick={() => setBuyAmount(amt)}
                      className={`px-2 py-1 text-[11px] font-mono font-bold transition-colors ${
                        buyAmount === amt
                          ? 'bg-[#00F0FF] text-[#030508]'
                          : 'text-[#8B9BB4] hover:text-[#F8FAFC]'
                      }`}
                    >
                      {amt === 'max' ? 'MÁX' : `×${amt}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {UPGRADE_DEFINITIONS.map((def) => {
                  const level = getUpgradeLevel(hud.mejoras, def.key);
                  const overdriveLevel = isOverdriveSupported(def.key)
                    ? hud.sobremarcha[def.key as OverdriveKey]
                    : 0;
                  const isOverdrive = level >= def.tope && isOverdriveSupported(def.key);
                  const preview = getBulkUpgradePreview(
                    def.key,
                    level,
                    overdriveLevel,
                    buyAmount,
                    hud.creditos
                  );
                  const isMax = preview.isMaxed || preview.totalCost === null;
                  const canAfford = preview.totalCost !== null && hud.creditos >= preview.totalCost;
                  const displayName =
                    def.key === 'capacidadBodega' && hud.mejoras.autoventa
                      ? 'Refinería e Imán'
                      : def.nombre;
                  const effectLabel = getUpgradeEffectLabel(
                    def.key,
                    level,
                    overdriveLevel,
                    hud.mejoras.autoventa
                  );
                  const deltaLabel = getNextUpgradeDeltaLabel(
                    def.key,
                    level,
                    isOverdrive,
                    hud.mejoras.autoventa
                  );
                  const unlockedMilestones = def.hitos.filter((h) => level >= h.nivel);
                  const nextMilestone = def.hitos.find((h) => h.nivel > level);
                  const progressPct =
                    def.tope > 0 ? Math.min(100, (level / def.tope) * 100) : 0;

                  return (
                    <div
                      key={def.key}
                      className={`bg-[#030508] border px-3 py-2.5 space-y-2 ${
                        isOverdrive ? 'border-[#FFD600]/45' : 'border-[#1A2742]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-display font-semibold text-[#F8FAFC]">
                            <span className="truncate">{displayName}</span>
                            {isOverdrive ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold tabular-nums bg-[#FFD600]/15 border border-[#FFD600]/60 text-[#FFD600] shrink-0">
                                SM +{overdriveLevel}
                              </span>
                            ) : (
                              <span className="text-xs font-mono tabular-nums text-[#8B9BB4] shrink-0">
                                {level}/{def.tope}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#8B9BB4] truncate tabular-nums">
                            {effectLabel}
                            {deltaLabel && (
                              <>
                                {' · '}
                                <span className={isOverdrive ? 'text-[#FFD600]' : 'text-[#00F0FF]'}>
                                  {deltaLabel}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isMax || !canAfford}
                          onClick={() => onBuyUpgrade(def.key, buyAmount)}
                          className={`min-h-[42px] sm:min-h-[44px] min-w-[78px] sm:min-w-[96px] px-2 sm:px-3 py-1.5 font-mono text-xs font-bold tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                            isMax
                              ? 'bg-[#060A12] border border-[#00FF9D]/50 text-[#00FF9D]'
                              : canAfford
                                ? isOverdrive
                                  ? 'bg-[#FFD600] text-[#030508] hover:bg-[#F8FAFC]'
                                  : 'bg-[#00FF9D] text-[#030508] hover:bg-[#F8FAFC]'
                                : 'bg-[#060A12] border border-[#1A2742] text-[#8B9BB4]'
                          }`}
                        >
                          {isMax
                            ? 'Máximo'
                            : preview.levels > 1
                              ? `+${preview.levels} · ${formatCredits(preview.totalCost!)}`
                              : formatCredits(preview.totalCost!)}
                        </button>
                      </div>

                      {def.hitos.length > 0 && (
                        <div className="space-y-1.5 pt-1.5 border-t border-[#1A2742]/70">
                          <div className="relative h-1.5 w-full bg-[#060A12] overflow-visible">
                            <div
                              className={`h-full transition-all duration-150 ${
                                isOverdrive ? 'bg-[#FFD600]' : 'bg-[#00F0FF]'
                              }`}
                              style={{
                                width: isOverdrive
                                  ? `${Math.max(15, ((overdriveLevel % 5) / 5) * 100 || 100)}%`
                                  : `${progressPct}%`,
                              }}
                            />
                            {def.hitos.map((h) => {
                              const posPct = (h.nivel / def.tope) * 100;
                              const reached = level >= h.nivel;
                              return (
                                <span
                                  key={h.nivel}
                                  title={`Nv.${h.nivel} ${h.titulo}: ${h.efecto}`}
                                  style={{ left: `calc(${posPct}% - 4px)` }}
                                  className={`absolute -top-[2px] w-2.5 h-2.5 rotate-45 border ${
                                    reached
                                      ? 'bg-[#FFD600] border-[#FFFBEB]'
                                      : 'bg-[#030508] border-[#1A2742]'
                                  }`}
                                />
                              );
                            })}
                          </div>

                          <div className="text-[11px] flex items-center justify-between gap-2">
                            {nextMilestone ? (
                              <>
                                <span className="text-[#8B9BB4] truncate">
                                  Próx. hito nv.{nextMilestone.nivel}:{' '}
                                  <span className="text-[#FFD600]">{nextMilestone.titulo}</span>
                                </span>
                                <span className="shrink-0 text-[#F8FAFC]/85">{nextMilestone.efecto}</span>
                              </>
                            ) : (
                              <span className="text-[#00FF9D] truncate">
                                Todos los hitos activos ({unlockedMilestones.map((h) => h.titulo).join(' · ')})
                              </span>
                            )}
                          </div>

                          {nextMilestone && unlockedMilestones.length > 0 && (
                            <div className="text-[11px] text-[#00FF9D]/90 truncate">
                              Activos: {unlockedMilestones.map((h) => `${h.titulo} (nv.${h.nivel})`).join(' · ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {activeTab === 'tecnologia' && (
          <TechTreeTab
            nucleos={hud.nucleos}
            tecnologia={hud.tecnologia}
            onBuyTechNode={onBuyTechNode}
          />
        )}

        {activeTab === 'flota' && (
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-display font-bold text-[#F8FAFC]">Flota de escolta</h2>
                <p className="text-xs text-[#8B9BB4]">
                  Escuadrón orbital autónomo ·{' '}
                  <span className="font-mono text-[#00F0FF] tabular-nums">
                    {formatDecimal(hud.stats.dpsFlota, 1)} DPS
                  </span>
                </p>
              </div>
              <div className="flex items-center border border-[#1A2742] bg-[#030508] p-0.5 shrink-0">
                {([1, 5, 'max'] as UpgradeBuyAmount[]).map((amt) => (
                  <button
                    key={String(amt)}
                    type="button"
                    onClick={() => setFleetBuyAmount(amt)}
                    className={`px-2 py-1 text-[11px] font-mono font-bold transition-colors ${
                      fleetBuyAmount === amt
                        ? 'bg-[#00F0FF] text-[#030508]'
                        : 'text-[#8B9BB4] hover:text-[#F8FAFC]'
                    }`}
                  >
                    {amt === 'max' ? 'MÁX' : `×${amt}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {FLEET_DEFINITIONS.map((ship) => {
                const owned = hud.flota[ship.key] || 0;
                const preview = getBulkFleetPreview(ship.key, owned, fleetBuyAmount, hud.creditos);
                const canAfford = hud.creditos >= preview.totalCost;
                const effectiveUnitDps = ship.danoBase * fleetMult * ship.cadencia;

                return (
                  <div
                    key={ship.key}
                    className="bg-[#030508] border border-[#1A2742] p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 shrink-0"
                            style={{ backgroundColor: ship.color }}
                          />
                          <span className="text-sm font-display font-bold text-[#F8FAFC] truncate">
                            {ship.nombre}
                          </span>
                          <span className="text-xs font-mono tabular-nums text-[#8B9BB4]">
                            ×{owned}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[#8B9BB4]">
                          {ship.rol} ·{' '}
                          <span className="font-mono text-[#00F0FF] tabular-nums">
                            {formatDecimal(effectiveUnitDps, 1)} DPS
                          </span>{' '}
                          /nave
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onBuyFleetShip(ship.key, fleetBuyAmount)}
                        className={`min-h-[42px] sm:min-h-[44px] min-w-[82px] sm:min-w-[100px] px-2 sm:px-3 py-1.5 font-mono text-xs font-bold tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                          canAfford
                            ? 'bg-[#00FF9D] text-[#030508] hover:bg-[#F8FAFC]'
                            : 'bg-[#060A12] border border-[#1A2742] text-[#8B9BB4]'
                        }`}
                      >
                        {preview.count > 1
                          ? `+${preview.count} · ${formatCredits(preview.totalCost)}`
                          : formatCredits(preview.totalCost)}
                      </button>
                    </div>

                    <p className="text-xs text-[#8B9BB4] leading-relaxed">{ship.descripcion}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === 'estadisticas' && (
          <section className="space-y-4 tabular-nums">
            {/* Postura táctica activa */}
            <div className="bg-[#030508] border border-[#1A2742] p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] text-[#8B9BB4]">Postura táctica activa</div>
                <div className="text-xs font-display font-bold truncate" style={{ color: activeStance.color }}>
                  [{activeStance.atajo}] {activeStance.nombre}
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#F8FAFC] text-right shrink-0">
                {activeStance.resumen}
              </span>
            </div>

            {/* Desglose de DPS */}
            <div className="bg-[#030508] border border-[#1A2742] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-bold text-[#F8FAFC]">Potencia de fuego</h3>
                <span className="text-xs font-mono text-[#00F0FF]">
                  {formatDecimal(hud.stats.dpsTotal, 1)} DPS total
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                <div className="text-[#8B9BB4]">DPS Cañón</div>
                <div className="text-right font-mono text-[#F8FAFC]">{formatDecimal(hud.stats.dpsCanon, 1)}</div>

                <div className="text-[#8B9BB4]">DPS Drones ({hud.stats.cantidadDrones})</div>
                <div className="text-right font-mono text-[#F8FAFC]">{formatDecimal(hud.stats.dpsDrones, 1)}</div>

                <div className="text-[#8B9BB4]">DPS Flota ({totalFleetCount})</div>
                <div className="text-right font-mono text-[#F8FAFC]">{formatDecimal(hud.stats.dpsFlota, 1)}</div>

                <div className="text-[#8B9BB4]">Daño / proyectil</div>
                <div className="text-right font-mono text-[#F8FAFC]">
                  {formatInt(hud.stats.danoCanon)} × {hud.stats.proyectilesPorDisparo}
                </div>

                <div className="text-[#8B9BB4]">Cadencia de tiro</div>
                <div className="text-right font-mono text-[#F8FAFC]">
                  {formatDecimal(hud.stats.cadencia, 2)} disp/s
                </div>

                <div className="text-[#8B9BB4]">Prob. crítico</div>
                <div className="text-right font-mono text-[#FFD600]">
                  {formatInt(hud.stats.probCritico * 100)} % (×{formatDecimal(hud.stats.multCritico, 2)})
                </div>

                <div className="text-[#8B9BB4]">Radio magnético</div>
                <div className="text-right font-mono text-[#E040FB]">
                  {formatInt(hud.stats.radioIman)} px
                </div>

                <div className="text-[#8B9BB4]">Multiplicador botín</div>
                <div className="text-right font-mono text-[#00FF9D]">
                  ×{formatDecimal(hud.stats.multBotin, 2)}
                </div>
              </div>
            </div>

            {/* Talentos de combate activos */}
            <div className="bg-[#030508] border border-[#1A2742] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-display font-bold text-[#F8FAFC]">Talentos de rango</h3>
                <span className="text-xs font-mono text-[#E040FB]">Rango {hud.rango}</span>
              </div>
              {activeTalents.length > 0 ? (
                <div className="space-y-1 text-xs">
                  {activeTalents.map((t) => (
                    <div key={t.key} className="flex items-center justify-between gap-2">
                      <span className="text-[#F8FAFC] truncate">{t.nombre}</span>
                      <span className="font-mono text-[#E040FB] shrink-0">×{hud.talentos[t.key]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#8B9BB4]">
                  Recoge orbes para subir de rango y elegir cartas de talento aleatorias.
                </p>
              )}
            </div>

            {/* Supervivencia y escudos */}
            <div className="bg-[#030508] border border-[#1A2742] p-3 space-y-2">
              <h3 className="text-xs font-display font-bold text-[#F8FAFC]">Defensa y regeneración</h3>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                <div className="text-[#8B9BB4]">Casco</div>
                <div className="text-right font-mono text-[#F8FAFC]">
                  {formatInt(hud.cascoActual)} / {formatInt(hud.stats.cascoMax)}
                </div>

                <div className="text-[#8B9BB4]">Escudo</div>
                <div className="text-right font-mono text-[#00F0FF]">
                  {formatInt(hud.escudoActual)} / {formatInt(hud.stats.escudoMax)}
                </div>

                <div className="text-[#8B9BB4]">Regen. en combate</div>
                <div className="text-right font-mono text-[#00F0FF]">
                  +{formatDecimal(hud.stats.regenCombatePorSeg, 1)} /s
                </div>

                <div className="text-[#8B9BB4]">Regen. sin impacto (2s)</div>
                <div className="text-right font-mono text-[#00F0FF]">
                  +{formatDecimal(hud.stats.regenFueraCombatePorSeg, 1)} /s
                </div>

                <div className="text-[#8B9BB4]">Reducción de daño</div>
                <div className="text-right font-mono text-[#00FF9D]">
                  {formatInt(hud.stats.reduccionDano * 100)} %
                </div>
              </div>
            </div>

            {/* Hitos activos */}
            <div className="bg-[#030508] border border-[#1A2742] p-3 space-y-2">
              <h3 className="text-xs font-display font-bold text-[#F8FAFC]">Hitos desbloqueados</h3>
              <div className="space-y-1 text-xs">
                {UPGRADE_DEFINITIONS.flatMap((def) => {
                  const lv = getUpgradeLevel(hud.mejoras, def.key);
                  return def.hitos
                    .filter((h) => lv >= h.nivel)
                    .map((h) => (
                      <div key={`${def.key}-${h.nivel}`} className="flex items-center justify-between gap-2">
                        <span className="text-[#FFD600] truncate">{h.titulo}</span>
                        <span className="text-[#8B9BB4] shrink-0">{h.efecto}</span>
                      </div>
                    ));
                })}
                {UPGRADE_DEFINITIONS.every((def) =>
                  def.hitos.every((h) => getUpgradeLevel(hud.mejoras, def.key) < h.nivel)
                ) && (
                  <p className="text-[#8B9BB4]">
                    Mejora tus sistemas a nivel 5, 10, 15 o 20 para desbloquear escalones de poder.
                  </p>
                )}
              </div>
            </div>

            {/* Registro de partida */}
            <div className="bg-[#030508] border border-[#1A2742] p-3 space-y-2">
              <h3 className="text-xs font-display font-bold text-[#F8FAFC]">Registro de misión</h3>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                <div className="text-[#8B9BB4]">Asteroides extraídos</div>
                <div className="text-right font-mono text-[#F8FAFC]">
                  {formatInt(hud.estadisticas.asteroidesDestruidos)}
                </div>

                <div className="text-[#8B9BB4]">Enemigos abatidos</div>
                <div className="text-right font-mono text-[#F8FAFC]">
                  {formatInt(hud.estadisticas.enemigosDestruidos)}
                </div>

                <div className="text-[#8B9BB4]">Élites abatidos</div>
                <div className="text-right font-mono text-[#FFD600]">
                  {formatInt(hud.estadisticas.elitesDestruidos)}
                </div>

                <div className="text-[#8B9BB4]">Jefes derrotados</div>
                <div className="text-right font-mono text-[#F8FAFC]">
                  {formatInt(hud.estadisticas.jefesDerrotados)}
                </div>

                <div className="text-[#8B9BB4]">Núcleos obtenidos</div>
                <div className="text-right font-mono text-[#E040FB]">
                  {formatInt(hud.estadisticas.nucleosTotalesGanados)}
                </div>

                <div className="text-[#8B9BB4]">Pulsos manuales</div>
                <div className="text-right font-mono text-[#00F0FF]">
                  {formatInt(hud.estadisticas.pulsosManuales)}
                </div>

                <div className="text-[#8B9BB4]">Contratos completados</div>
                <div className="text-right font-mono text-[#00FF9D]">
                  {formatInt(hud.estadisticas.contratosCompletados)}
                </div>

                <div className="text-[#8B9BB4]">Proyectiles deflectados</div>
                <div className="text-right font-mono text-[#00F0FF]">
                  {formatInt(hud.estadisticas.proyectilesDeflectados)}
                </div>

                <div className="text-[#8B9BB4]">Racha máx. de orbes</div>
                <div className="text-right font-mono text-[#E040FB]">
                  ×{formatInt(hud.estadisticas.mejorRachaOrbes)}
                </div>

                <div className="text-[#8B9BB4]">Pico de DPS</div>
                <div className="text-right font-mono text-[#00F0FF]">
                  {formatDecimal(hud.estadisticas.mejorDps, 1)}
                </div>

                <div className="text-[#8B9BB4]">Eventos espaciales</div>
                <div className="text-right font-mono text-[#FFD600]">
                  {formatInt(hud.estadisticas.eventosCompletados)}
                </div>

                <div className="text-[#8B9BB4]">Créditos totales</div>
                <div className="text-right font-mono text-[#00FF9D]">
                  {formatCredits(hud.estadisticas.creditosTotalesGanados)}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </aside>
  );
};
