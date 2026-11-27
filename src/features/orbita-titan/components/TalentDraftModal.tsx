import React from 'react';
import { Sparkles, Rocket } from 'lucide-react';
import {
  getPrestigeCoreReward,
  getPrestigeDamageMultiplier,
  getPrestigeLootMultiplier,
} from '../game/formulas';
import { TALENT_DEFINITIONS, type TalentKey } from '../game/types';

interface TalentDraftModalProps {
  rank: number;
  choices: TalentKey[];
  ownedTalents: Record<TalentKey, number>;
  onSelectTalent: (key: TalentKey) => void;
}

export const TalentDraftModal: React.FC<TalentDraftModalProps> = ({
  rank,
  choices,
  ownedTalents,
  onSelectTalent,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#030508]/90 p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="talent-draft-title"
        className="relative my-auto w-full max-w-2xl max-h-[92dvh] overflow-y-auto bg-[#060A12] border border-[#00F0FF] p-4 sm:p-6 space-y-4 sm:space-y-5"
      >
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E040FB]">
            <Sparkles className="w-4 h-4" />
            <span>Rango {rank} alcanzado</span>
          </div>
          <h2 id="talent-draft-title" className="text-xl sm:text-2xl font-display font-bold text-[#F8FAFC]">
            Elige un talento de combate
          </h2>
          <p className="text-xs sm:text-sm text-[#8B9BB4]">
            La simulación está en pausa. Selecciona una mejora acumulable para esta expedición.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {choices.map((key, idx) => {
            const def = TALENT_DEFINITIONS.find((t) => t.key === key);
            if (!def) return null;
            const stacks = ownedTalents[key] || 0;

            return (
              <button
                key={key}
                type="button"
                aria-keyshortcuts={String(idx + 1)}
                onClick={() => onSelectTalent(key)}
                className="group bg-[#030508] border border-[#1A2742] hover:border-[#00F0FF] p-3 sm:p-4 text-left flex flex-col justify-between gap-3 sm:gap-4 transition-colors min-h-[116px] sm:min-h-[156px]"
              >
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 shrink-0"
                      style={{ backgroundColor: def.color }}
                    />
                    <span className="text-xs font-mono tabular-nums text-[#8B9BB4]">
                      Nivel {stacks} → {stacks + 1}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-display font-bold text-[#F8FAFC] group-hover:text-[#00F0FF] transition-colors">
                    {def.nombre}
                  </h3>
                  <p className="text-xs text-[#8B9BB4] leading-relaxed">{def.efecto}</p>
                </div>

                <div className="w-full min-h-[38px] sm:min-h-[40px] bg-[#060A12] border border-[#1A2742] group-hover:bg-[#00F0FF] group-hover:text-[#030508] group-hover:border-[#00F0FF] flex items-center justify-center gap-1.5 text-xs font-display font-bold text-[#F8FAFC] transition-colors whitespace-nowrap">
                  <span className="font-mono opacity-75">[{idx + 1}]</span>
                  <span>Elegir talento</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface PrestigeConfirmModalProps {
  currentPrestige: number;
  maxAnomalyWave: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PrestigeConfirmModal: React.FC<PrestigeConfirmModalProps> = ({
  currentPrestige,
  maxAnomalyWave,
  onConfirm,
  onCancel,
}) => {
  const nextPrestige = currentPrestige + 1;
  const nextDmgPct = Math.round((getPrestigeDamageMultiplier(nextPrestige) - 1) * 100);
  const nextLootPct = Math.round((getPrestigeLootMultiplier(nextPrestige) - 1) * 100);
  const coreReward = getPrestigeCoreReward(currentPrestige, maxAnomalyWave);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#030508]/90 p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prestige-title"
        className="my-auto w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#060A12] border border-[#E040FB] p-4 sm:p-6 space-y-4 sm:space-y-5"
      >
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E040FB]">
            <Rocket className="w-4 h-4" />
            <span>Prestigio nivel {currentPrestige} → {nextPrestige}</span>
          </div>
          <h2 id="prestige-title" className="text-lg sm:text-xl font-display font-bold text-[#F8FAFC]">
            Iniciar Salto Hiperespacial
          </h2>
          <p className="text-xs sm:text-sm text-[#8B9BB4]">
            Reinicia créditos, mejoras de nave, flota y sectores al Planeta 1 a cambio de poder permanente y Núcleos Estelares.
          </p>
        </div>

        <div className="bg-[#030508] border border-[#1A2742] p-3.5 space-y-1.5 text-xs tabular-nums">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#8B9BB4]">Bonificación de daño total</span>
            <span className="font-mono font-bold text-[#00F0FF] shrink-0">+{nextDmgPct} %</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#8B9BB4]">Valor de botín de orbes</span>
            <span className="font-mono font-bold text-[#00FF9D] shrink-0">+{nextLootPct} %</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#8B9BB4]">Recompensa inmediata</span>
            <span className="font-mono font-bold text-[#E040FB] shrink-0">
              +{coreReward} Núcleos Estelares
            </span>
          </div>
          <div className="pt-1 border-t border-[#1A2742] text-[#8B9BB4]">
            Conservas todos tus Núcleos, el Árbol Tecnológico y el acceso a Anomalía Infinita.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-w-[120px] min-h-[44px] px-4 py-2 bg-[#030508] border border-[#1A2742] text-[#F8FAFC] font-medium text-sm hover:border-[#00F0FF] transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 min-w-[120px] min-h-[44px] px-4 py-2 bg-[#E040FB] text-[#030508] font-display font-bold text-sm hover:bg-[#F0ABFC] transition-colors whitespace-nowrap"
          >
            Ejecutar salto
          </button>
        </div>
      </div>
    </div>
  );
};
