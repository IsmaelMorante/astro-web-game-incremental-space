import React from 'react';
import { formatCredits, formatTimeMMSS } from '../game/formulas';

interface TitleScreenProps {
  hasSavedRun: boolean;
  savedCredits: number;
  savedTimeSec: number;
  savedPlanet: number;
  savedPrestige: number;
  savedCores: number;
  onStart: () => void;
  onRequestReset: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  hasSavedRun,
  savedCredits,
  savedTimeSec,
  savedPlanet,
  savedPrestige,
  savedCores,
  onStart,
  onRequestReset,
}) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto pointer-events-none">
      <div className="relative my-auto w-full max-w-2xl max-h-[94dvh] overflow-y-auto bg-[#030508]/85 backdrop-blur-[2px] border-y border-[#00F0FF]/60 px-5 py-6 sm:px-8 sm:py-10 text-center pointer-events-auto">
        {/* Sharp vector corner ticks */}
        <span aria-hidden="true" className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#00F0FF]" />
        <span aria-hidden="true" className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#00F0FF]" />
        <span aria-hidden="true" className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#00F0FF]" />
        <span aria-hidden="true" className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#00F0FF]" />

        {/* Vector Arcade Emblem + Title Lockup */}
        <div className="mx-auto mb-3 sm:mb-5 flex justify-center">
          <svg
            viewBox="0 0 380 86"
            className="w-full max-w-[270px] sm:max-w-[340px] h-auto"
            role="img"
            aria-label="Órbita Titán"
          >
            <circle
              cx="46"
              cy="43"
              r="28"
              fill="none"
              stroke="#00F0FF"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              opacity="0.7"
            />
            <circle cx="46" cy="43" r="19" fill="none" stroke="#FF2E63" strokeWidth="1.4" opacity="0.8" />
            <polygon
              points="62,43 36,30 41,43 36,56"
              fill="#F8FAFC"
              stroke="#00F0FF"
              strokeWidth="1.5"
            />
            <circle cx="69" cy="24" r="3.5" fill="#FFD600" />
            <text
              x="94"
              y="50"
              fill="#F8FAFC"
              fontFamily="Oxanium, sans-serif"
              fontWeight="800"
              fontSize="36"
              letterSpacing="2"
            >
              ÓRBITA TITÁN
            </text>
          </svg>
        </div>

        <p className="mx-auto max-w-lg text-xs sm:text-sm leading-relaxed text-[#8B9BB4] mb-5 sm:mb-7">
          Extrae minerales de asteroides vectoriales, abate interceptores hostiles, mejora tu nave y derrota al Guardián Solar a través de cuatro sectores orbitales.
        </p>

        {hasSavedRun && (
          <div className="mb-5 sm:mb-7 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-[#8B9BB4] tabular-nums">
            <span>Planeta {savedPlanet}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[#FFD600]">{formatCredits(savedCredits)}</span>
            {savedCores > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#E040FB]">{savedCores} Núcleos</span>
              </>
            )}
            {savedPrestige > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[#00F0FF]">Prestigio {savedPrestige}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[#F8FAFC]">{formatTimeMMSS(savedTimeSec)}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onStart}
            className="min-h-[44px] sm:min-h-[46px] px-6 sm:px-8 py-2.5 bg-[#00F0FF] text-[#030508] font-display font-bold text-sm sm:text-base tracking-wider hover:bg-[#F8FAFC] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF]"
          >
            {hasSavedRun ? 'Continuar partida' : 'Iniciar misión'}
          </button>

          {hasSavedRun && (
            <button
              type="button"
              onClick={onRequestReset}
              className="min-h-[44px] sm:min-h-[46px] px-5 py-2.5 bg-[#030508] border border-[#1A2742] text-[#8B9BB4] font-display font-semibold text-xs sm:text-sm hover:text-[#FF2E63] hover:border-[#FF2E63] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF]"
            >
              Nueva partida
            </button>
          )}
        </div>

        <p className="mt-5 sm:mt-8 text-[11px] sm:text-xs text-[#8B9BB4] tracking-wide">
          Clic / Tab Objetivo · 1/2/3 Postura · Espacio Deflector · Q/W/E Táctica · M Audio · Esc Pausa
        </p>
      </div>
    </div>
  );
};
