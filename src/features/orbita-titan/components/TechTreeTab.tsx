import React, { useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import { TECH_TREE_NODES, type TechNodeDefinition, type TechNodeKey } from '../game/types';

interface TechTreeTabProps {
  nucleos: number;
  tecnologia: Record<TechNodeKey, boolean>;
  onBuyTechNode: (key: TechNodeKey) => void;
}

const COL_CENTERS_PCT = [16.66, 50, 83.33];
const ROW_CENTERS_PCT = [16, 50, 84];

export const TechTreeTab: React.FC<TechTreeTabProps> = ({
  nucleos,
  tecnologia,
  onBuyTechNode,
}) => {
  const [selectedKey, setSelectedKey] = useState<TechNodeKey>('imanCuantico');

  const selectedNode: TechNodeDefinition =
    TECH_TREE_NODES.find((n) => n.key === selectedKey) || TECH_TREE_NODES[0];

  const isSelectedUnlocked = Boolean(tecnologia[selectedNode.key]);
  const isSelectedPrereqMet = selectedNode.requisitos.every((r) => Boolean(tecnologia[r]));
  const canBuySelected =
    !isSelectedUnlocked && isSelectedPrereqMet && nucleos >= selectedNode.costeNucleos;

  const unlockedCount = TECH_TREE_NODES.filter((n) => tecnologia[n.key]).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-display font-bold text-[#F8FAFC] tracking-wide">
            Árbol tecnológico
          </h2>
          <p className="text-xs text-[#8B9BB4]">
            Invierte Núcleos Estelares de élites y jefes en nodos permanentes.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-mono font-bold text-[#E040FB] tabular-nums">
            {nucleos} Núcleo{nucleos === 1 ? '' : 's'}
          </div>
          <div className="text-[11px] font-mono text-[#8B9BB4] tabular-nums">
            {unlockedCount}/{TECH_TREE_NODES.length} nodos
          </div>
        </div>
      </div>

      {/* Oscilloscope Vector Node Matrix (3x3 layout with SVG connectors) */}
      <div className="relative bg-[#030508] border border-[#1A2742] p-2.5 sm:p-3">
        <div className="relative h-[clamp(205px,28dvh,280px)] w-full">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          >
            {TECH_TREE_NODES.flatMap((node) =>
              node.requisitos.map((reqKey) => {
                const parent = TECH_TREE_NODES.find((n) => n.key === reqKey);
                if (!parent) return null;
                const x1 = COL_CENTERS_PCT[parent.col];
                const y1 = ROW_CENTERS_PCT[parent.row];
                const x2 = COL_CENTERS_PCT[node.col];
                const y2 = ROW_CENTERS_PCT[node.row];
                const bothUnlocked = tecnologia[parent.key] && tecnologia[node.key];
                const parentUnlocked = tecnologia[parent.key];

                return (
                  <line
                    key={`${parent.key}-${node.key}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={
                      bothUnlocked
                        ? '#E040FB'
                        : parentUnlocked
                          ? '#00F0FF'
                          : '#1A2742'
                    }
                    strokeWidth={bothUnlocked ? 1.5 : 0.9}
                    strokeDasharray={bothUnlocked ? undefined : '2.5 2'}
                  />
                );
              })
            )}
          </svg>

          {TECH_TREE_NODES.map((node) => {
            const unlocked = Boolean(tecnologia[node.key]);
            const prereqMet = node.requisitos.every((r) => Boolean(tecnologia[r]));
            const affordable = !unlocked && prereqMet && nucleos >= node.costeNucleos;
            const isSelected = node.key === selectedNode.key;

            return (
              <button
                key={node.key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedKey(node.key)}
                style={{
                  left: `${COL_CENTERS_PCT[node.col]}%`,
                  top: `${ROW_CENTERS_PCT[node.row]}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute w-[31%] min-h-[52px] sm:min-h-[60px] px-1 sm:px-1.5 py-1 sm:py-1.5 border text-center transition-colors flex flex-col items-center justify-center gap-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F0FF] ${
                  unlocked
                    ? isSelected
                      ? 'bg-[#E040FB]/20 border-[#E040FB] text-[#F8FAFC]'
                      : 'bg-[#060A12] border-[#E040FB] text-[#F8FAFC]'
                    : affordable
                      ? isSelected
                        ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#F8FAFC]'
                        : 'bg-[#060A12] border-[#00F0FF]/80 text-[#F8FAFC]'
                      : isSelected
                        ? 'bg-[#060A12] border-[#8B9BB4] text-[#8B9BB4]'
                        : 'bg-[#060A12]/80 border-[#1A2742] text-[#8B9BB4]/75'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] font-display font-semibold leading-tight">
                  {unlocked ? (
                    <Check className="w-3 h-3 text-[#00FF9D] shrink-0" />
                  ) : !prereqMet ? (
                    <Lock className="w-3 h-3 text-[#8B9BB4]/60 shrink-0" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-[#E040FB] shrink-0" />
                  )}
                  <span className="line-clamp-2">{node.nombre}</span>
                </div>
                <div className="text-[10px] font-mono tabular-nums text-[#E040FB]">
                  {unlocked ? 'Activo' : `${node.costeNucleos} Núcl.`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Node Inspector & Unlock Action */}
      <div className="bg-[#030508] border border-[#1A2742] p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs text-[#E040FB] font-medium">{selectedNode.rama}</div>
            <h3 className="text-sm font-display font-bold text-[#F8FAFC]">
              {selectedNode.nombre}
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#8B9BB4]">
            {isSelectedUnlocked ? 'Desbloqueado' : `${selectedNode.costeNucleos} Núcleos`}
          </span>
        </div>

        <p className="text-xs text-[#8B9BB4] leading-relaxed">{selectedNode.descripcion}</p>

        {!isSelectedUnlocked && !isSelectedPrereqMet && (
          <p className="text-xs text-[#FFD600]">
            Requiere desbloquear primero:{' '}
            {selectedNode.requisitos
              .map((rk) => TECH_TREE_NODES.find((n) => n.key === rk)?.nombre || rk)
              .join(', ')}
          </p>
        )}

        <button
          type="button"
          disabled={!canBuySelected}
          onClick={() => onBuyTechNode(selectedNode.key)}
          className={`w-full min-h-[42px] sm:min-h-[44px] px-3 sm:px-4 py-2 font-display font-bold text-xs sm:text-sm transition-colors flex items-center justify-center min-w-0 ${
            isSelectedUnlocked
              ? 'bg-[#060A12] border border-[#00FF9D]/60 text-[#00FF9D]'
              : canBuySelected
                ? 'bg-[#E040FB] text-[#030508] hover:bg-[#F0ABFC]'
                : 'bg-[#060A12] border border-[#1A2742] text-[#8B9BB4]'
          }`}
        >
          <span className="truncate">
            {isSelectedUnlocked
              ? 'Tecnología activa'
              : canBuySelected
                ? `Investigar (${selectedNode.costeNucleos} Núcleo${selectedNode.costeNucleos === 1 ? '' : 's'})`
                : isSelectedPrereqMet
                  ? `Faltan Núcleos (${nucleos}/${selectedNode.costeNucleos})`
                  : 'Nodo bloqueado por requisito'}
          </span>
        </button>
      </div>
    </section>
  );
};
