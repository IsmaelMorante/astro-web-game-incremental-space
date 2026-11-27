import React, { useState } from 'react';
import { formatCredits, formatInt, formatTimeMMSS } from '../game/formulas';
import type { HudSnapshot } from '../game/types';

interface PauseModalProps {
  silencio: boolean;
  onResume: () => void;
  onToggleMute: () => void;
  onExportSaveJson: () => string;
  onImportSaveJson: (raw: string) => boolean;
  onRequestReset: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  silencio,
  onResume,
  onToggleMute,
  onExportSaveJson,
  onImportSaveJson,
  onRequestReset,
}) => {
  const [backupStatus, setBackupStatus] = useState<{ text: string; ok: boolean } | null>(null);

  const handleCopyJson = async () => {
    const json = onExportSaveJson();
    try {
      await navigator.clipboard.writeText(json);
      setBackupStatus({ text: 'Guardado JSON copiado al portapapeles.', ok: true });
    } catch {
      setBackupStatus({ text: 'No se pudo copiar; usa Descargar .json.', ok: false });
    }
  };

  const handleDownloadJson = () => {
    const json = onExportSaveJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'orbita-titan-save.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBackupStatus({ text: 'Archivo orbita-titan-save.json descargado.', ok: true });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const ok = onImportSaveJson(text);
      setBackupStatus(
        ok
          ? { text: 'Partida importada y validada correctamente.', ok: true }
          : { text: 'Archivo JSON inválido o incompatible.', ok: false }
      );
    } catch {
      setBackupStatus({ text: 'No se pudo leer el archivo seleccionado.', ok: false });
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#030508]/88 p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        className="my-auto w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-[#060A12] border border-[#00F0FF] p-4 sm:p-6 space-y-4 sm:space-y-5"
      >
        <div>
          <h2 id="pause-title" className="text-xl font-display font-bold text-[#F8FAFC]">
            Partida en pausa
          </h2>
          <p className="mt-1 text-sm text-[#8B9BB4]">
            La simulación está detenida. Puedes reanudar o respaldar tu progreso.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] px-4 py-2 bg-[#00F0FF] text-[#030508] font-display font-bold text-sm hover:bg-[#F8FAFC] transition-colors whitespace-nowrap"
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="w-full min-h-[44px] px-4 py-2 bg-[#030508] border border-[#1A2742] text-[#F8FAFC] font-medium text-sm hover:border-[#00F0FF] transition-colors whitespace-nowrap"
          >
            {silencio ? 'Activar sonido' : 'Silenciar'}
          </button>

          <div className="bg-[#030508] border border-[#1A2742] p-3 space-y-2">
            <div className="text-xs font-display font-bold text-[#8B9BB4]">
              Respaldo portátil (JSON)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={handleCopyJson}
                className="min-h-[38px] px-2 py-1 bg-[#060A12] border border-[#1A2742] text-[11px] font-display font-semibold text-[#F8FAFC] hover:border-[#00F0FF] hover:text-[#00F0FF] transition-colors whitespace-nowrap"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="min-h-[38px] px-2 py-1 bg-[#060A12] border border-[#1A2742] text-[11px] font-display font-semibold text-[#F8FAFC] hover:border-[#00F0FF] hover:text-[#00F0FF] transition-colors whitespace-nowrap"
              >
                Descargar
              </button>
              <label className="min-h-[38px] px-2 py-1 bg-[#060A12] border border-[#1A2742] text-[11px] font-display font-semibold text-[#00FF9D] hover:border-[#00FF9D] transition-colors flex items-center justify-center cursor-pointer whitespace-nowrap">
                <span>Importar</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="sr-only"
                />
              </label>
            </div>
            {backupStatus && (
              <p
                className={`text-[11px] leading-snug ${
                  backupStatus.ok ? 'text-[#00FF9D]' : 'text-[#FF2E63]'
                }`}
              >
                {backupStatus.text}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onRequestReset}
            className="w-full min-h-[44px] px-4 py-2 bg-[#030508] border border-[#1A2742] text-[#FF2E63] font-medium text-sm hover:border-[#FF2E63] transition-colors whitespace-nowrap"
          >
            Reiniciar partida
          </button>
        </div>
      </div>
    </div>
  );
};

interface VictoryModalProps {
  hud: HudSnapshot;
  onContinuePlaying: () => void;
  onEnterAnomaly: () => void;
  onRequestPrestige: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  hud,
  onContinuePlaying,
  onEnterAnomaly,
  onRequestPrestige,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#030508]/90 p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="victory-title"
        className="my-auto w-full max-w-md max-h-[92dvh] overflow-y-auto bg-[#060A12] border border-[#00FF9D] p-4 sm:p-6 space-y-4 sm:space-y-5"
      >
        <div>
          <div className="text-xs font-medium text-[#00FF9D]">Núcleo Estelar despejado</div>
          <h2 id="victory-title" className="mt-1 text-xl sm:text-2xl font-display font-bold text-[#F8FAFC]">
            Victoria sobre el Guardián Solar
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-[#8B9BB4]">
            Has desbloqueado el modo Anomalía Infinita y el Salto Hiperespacial en el panel de control.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 bg-[#030508] border border-[#1A2742] p-3 sm:p-4 tabular-nums">
          <div>
            <div className="text-xs text-[#8B9BB4]">Tiempo total</div>
            <div className="text-base sm:text-lg font-mono font-bold text-[#F8FAFC]">
              {formatTimeMMSS(hud.tiempoJugadoSegundos)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8B9BB4]">Objetivos destruidos</div>
            <div className="text-base sm:text-lg font-mono font-bold text-[#F8FAFC]">
              {formatInt(hud.estadisticas.objetivosDestruidos)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8B9BB4]">Núcleos Estelares</div>
            <div className="text-base sm:text-lg font-mono font-bold text-[#E040FB]">
              {formatInt(hud.nucleos)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8B9BB4]">Créditos acumulados</div>
            <div className="text-base sm:text-lg font-mono font-bold text-[#00FF9D]">
              {formatCredits(hud.estadisticas.creditosTotalesGanados)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onEnterAnomaly}
            className="w-full min-h-[44px] sm:min-h-[46px] px-4 py-2 bg-[#E040FB] text-[#030508] font-display font-bold text-sm hover:bg-[#F0ABFC] transition-colors whitespace-nowrap"
          >
            Entrar en Anomalía Infinita
          </button>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onRequestPrestige}
              className="flex-1 min-w-[130px] min-h-[44px] px-3 py-2 bg-[#030508] border border-[#FFD600]/80 text-[#FFD600] font-display font-semibold text-sm hover:bg-[#FFD600] hover:text-[#030508] transition-colors whitespace-nowrap"
            >
              Salto Hiperespacial
            </button>
            <button
              type="button"
              onClick={onContinuePlaying}
              className="flex-1 min-w-[130px] min-h-[44px] px-3 py-2 bg-[#030508] border border-[#1A2742] text-[#F8FAFC] font-medium text-sm hover:border-[#00F0FF] transition-colors whitespace-nowrap"
            >
              Seguir jugando
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ResetConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#030508]/90 p-3 sm:p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        className="my-auto w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-[#060A12] border border-[#FF2E63] p-4 sm:p-6 space-y-4 sm:space-y-5"
      >
        <div>
          <h2 id="reset-title" className="text-lg font-display font-bold text-[#F8FAFC]">
            Confirmar reinicio de partida
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-[#8B9BB4]">
            Se borrará todo el progreso guardado, incluyendo Núcleos, prestigio y tecnologías.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-w-[110px] min-h-[44px] px-4 py-2 bg-[#030508] border border-[#1A2742] text-[#F8FAFC] font-medium text-sm hover:border-[#00F0FF] transition-colors whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 min-w-[110px] min-h-[44px] px-4 py-2 bg-[#FF2E63] text-[#F8FAFC] font-display font-bold text-sm hover:bg-[#FF1E56] transition-colors whitespace-nowrap"
          >
            Reiniciar partida
          </button>
        </div>
      </div>
    </div>
  );
};
