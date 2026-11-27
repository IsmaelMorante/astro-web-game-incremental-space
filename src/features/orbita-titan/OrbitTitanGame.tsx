import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { PauseModal, ResetConfirmModal, VictoryModal } from './components/Modals';
import { PrestigeConfirmModal, TalentDraftModal } from './components/TalentDraftModal';
import { TitleScreen } from './components/TitleScreen';
import { spaceAudio } from './game/audio';
import { SpaceGameEngine } from './game/engine';
import { exportSaveJson, loadSaveData, parseAndValidateSaveJson } from './game/storage';
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  type ConsumableKey,
  type FleetShipKey,
  type GameScreen,
  type HudSnapshot,
  type PlanetId,
  type ShipStance,
  type TalentKey,
  type TechNodeKey,
  type UpgradeBuyAmount,
  type UpgradeKey,
} from './game/types';

export function OrbitTitanGame() {
  const initialRef = useRef<{ engine: SpaceGameEngine; hasExistingSave: boolean } | null>(null);
  if (!initialRef.current) {
    const loaded = loadSaveData();
    const engine = new SpaceGameEngine(loaded.data);
    initialRef.current = { engine, hasExistingSave: loaded.hasExistingSave };
  }

  const engineRef = useRef<SpaceGameEngine>(initialRef.current.engine);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sizeRef = useRef<{ width: number; height: number; dpr: number }>({
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    dpr: 1,
  });

  const [screen, setScreen] = useState<GameScreen>('TITLE');
  const screenRef = useRef<GameScreen>(screen);
  screenRef.current = screen;

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPrestigeConfirm, setShowPrestigeConfirm] = useState(false);
  const [talentDraft, setTalentDraft] = useState<{ choices: TalentKey[]; rank: number } | null>(null);
  const talentDraftRef = useRef(talentDraft);
  talentDraftRef.current = talentDraft;

  const [hasSavedRun, setHasSavedRun] = useState(initialRef.current.hasExistingSave);
  const [hud, setHud] = useState<HudSnapshot>(() => engineRef.current.getSnapshot());

  const syncHud = useCallback(() => {
    setHud(engineRef.current.getSnapshot());
  }, []);

  // Wire callbacks into engine once
  useEffect(() => {
    const engine = engineRef.current as unknown as {
      callbacks: {
        onVictory?: (snapshot: HudSnapshot) => void;
        onImmediateSave?: () => void;
        onRankUp?: (choices: TalentKey[], newRank: number) => void;
      };
    };
    engine.callbacks.onVictory = (snapshot) => {
      setHud(snapshot);
      setScreen('VICTORY');
    };
    engine.callbacks.onImmediateSave = () => {
      setHasSavedRun(true);
    };
    engine.callbacks.onRankUp = (choices, newRank) => {
      setTalentDraft({ choices, rank: newRank });
      setHud(engineRef.current.getSnapshot());
    };
  }, []);

  // DPR-aware ResizeObserver for crisp Canvas 2D rendering
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateCanvasSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);
      sizeRef.current = { width: cssW, height: cssH, dpr };

      const targetW = Math.max(1, Math.round(cssW * dpr));
      const targetH = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(container);
    window.addEventListener('resize', updateCanvasSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // Isolated 60fps simulation & render loop (pauses cleanly while talent draft modal is open)
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudSyncAcc = 0;

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      const currentScreen = screenRef.current;
      const engine = engineRef.current;

      if (currentScreen === 'TITLE') {
        engine.stepTitleBackdrop(rawDt);
      } else if (currentScreen === 'PLAYING' && !talentDraftRef.current) {
        engine.step(rawDt);
        hudSyncAcc += rawDt;
        if (hudSyncAcc >= 0.1) {
          hudSyncAcc = 0;
          setHud(engine.getSnapshot());
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const { width, height, dpr } = sizeRef.current;
          engine.render(ctx, width, height, dpr, currentScreen !== 'TITLE');
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showResetConfirm) {
        if (e.key === 'Escape') {
          setShowResetConfirm(false);
        }
        return;
      }
      if (showPrestigeConfirm) {
        if (e.key === 'Escape') {
          setShowPrestigeConfirm(false);
        }
        return;
      }
      if (talentDraftRef.current) {
        if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === '1' || e.key === '2' || e.key === '3')) {
          const choice = talentDraftRef.current.choices[Number(e.key) - 1];
          if (choice) {
            e.preventDefault();
            setTalentDraft(null);
            engineRef.current.chooseTalent(choice);
            syncHud();
          }
        }
        return;
      }

      if (screenRef.current === 'TITLE') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          spaceAudio.unlockFromUserGesture();
          setScreen('PLAYING');
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (screenRef.current === 'PLAYING') {
          setScreen('PAUSED');
        } else if (screenRef.current === 'PAUSED' || screenRef.current === 'VICTORY') {
          setScreen('PLAYING');
        }
        return;
      }

      if (e.altKey || e.ctrlKey || e.metaKey) return;

      const lower = e.key.toLowerCase();
      if (lower === 'm') {
        engineRef.current.toggleMute();
        syncHud();
        return;
      }

      if (screenRef.current === 'PLAYING') {
        if (e.key === '1') {
          engineRef.current.setStance('asalto');
          syncHud();
        } else if (e.key === '2') {
          engineRef.current.setStance('equilibrada');
          syncHud();
        } else if (e.key === '3') {
          engineRef.current.setStance('escudo');
          syncHud();
        } else if (e.code === 'Space') {
          e.preventDefault();
          engineRef.current.triggerDeflectorPulse();
          syncHud();
        } else if (lower === 'q') {
          engineRef.current.useConsumable('sobrecarga');
          syncHud();
        } else if (lower === 'w') {
          engineRef.current.useConsumable('reparacion');
          syncHud();
        } else if (lower === 'e') {
          engineRef.current.useConsumable('emp');
          syncHud();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          engineRef.current.cycleTarget();
          syncHud();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showResetConfirm, showPrestigeConfirm, syncHud]);

  const toLogicalCoords = (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scale = Math.min(rect.width / LOGICAL_WIDTH, rect.height / LOGICAL_HEIGHT);
    const offsetX = (rect.width - LOGICAL_WIDTH * scale) / 2;
    const offsetY = (rect.height - LOGICAL_HEIGHT * scale) / 2;

    const logicalX = (e.clientX - rect.left - offsetX) / scale;
    const logicalY = (e.clientY - rect.top - offsetY) / scale;

    return { x: logicalX, y: logicalY };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screenRef.current !== 'PLAYING' || talentDraftRef.current) return;
    const coords = toLogicalCoords(e);
    if (coords) {
      engineRef.current.setPointerPosition(coords.x, coords.y);
      engineRef.current.handlePointerDown(coords.x, coords.y);
      syncHud();
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screenRef.current !== 'PLAYING') return;
    const coords = toLogicalCoords(e);
    if (coords) {
      engineRef.current.setPointerPosition(coords.x, coords.y);
    } else {
      engineRef.current.setPointerPosition(null, null);
    }
  };

  const handleCanvasPointerLeave = () => {
    engineRef.current.setPointerPosition(null, null);
  };

  const handleStartGame = () => {
    spaceAudio.unlockFromUserGesture();
    setScreen('PLAYING');
    syncHud();
  };

  const handleSellAll = () => {
    engineRef.current.sellAllCargo();
    syncHud();
  };

  const handleBuyUpgrade = (key: UpgradeKey, amount: UpgradeBuyAmount = 1) => {
    engineRef.current.buyUpgrade(key, amount);
    syncHud();
  };

  const handleSetStance = (stance: ShipStance) => {
    engineRef.current.setStance(stance);
    syncHud();
  };

  const handleTriggerDeflector = () => {
    engineRef.current.triggerDeflectorPulse();
    syncHud();
  };

  const handleCycleTarget = () => {
    engineRef.current.cycleTarget();
    syncHud();
  };

  const handleBuyTechNode = (key: TechNodeKey) => {
    engineRef.current.buyTechNode(key);
    syncHud();
  };

  const handleBuyFleetShip = (key: FleetShipKey, amount: UpgradeBuyAmount = 1) => {
    engineRef.current.buyFleetShip(key, amount);
    syncHud();
  };

  const handleUseConsumable = (key: ConsumableKey) => {
    engineRef.current.useConsumable(key);
    syncHud();
  };

  const handleChallengeBoss = () => {
    engineRef.current.challengeBoss();
    syncHud();
  };

  const handleSelectPlanet = (planetId: PlanetId) => {
    engineRef.current.selectPlanet(planetId);
    syncHud();
  };

  const handleToggleAnomaly = () => {
    engineRef.current.toggleAnomaly();
    syncHud();
  };

  const handleSelectTalent = (key: TalentKey) => {
    setTalentDraft(null);
    engineRef.current.chooseTalent(key);
    syncHud();
  };

  const handleConfirmPrestige = () => {
    engineRef.current.performPrestige();
    setShowPrestigeConfirm(false);
    setTalentDraft(null);
    setScreen('PLAYING');
    syncHud();
  };

  const handleToggleMute = () => {
    engineRef.current.toggleMute();
    syncHud();
  };

  const handleExportSaveJson = () => {
    return exportSaveJson(engineRef.current.exportSave());
  };

  const handleImportSaveJson = (raw: string): boolean => {
    const validated = parseAndValidateSaveJson(raw);
    if (!validated) return false;
    engineRef.current.importSave(validated);
    setHasSavedRun(true);
    setTalentDraft(null);
    setShowPrestigeConfirm(false);
    syncHud();
    return true;
  };

  const handleConfirmReset = () => {
    engineRef.current.resetRun();
    setHasSavedRun(false);
    setShowResetConfirm(false);
    setShowPrestigeConfirm(false);
    setTalentDraft(null);
    setScreen('PLAYING');
    syncHud();
  };

  return (
    <main className="h-[100dvh] w-full bg-[#030508] text-[#F8FAFC] flex flex-col [@media(min-width:640px)_and_(orientation:landscape)]:flex-row overflow-hidden">
      {/* Left / Top: Isolated Canvas 2D Playfield */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[180px] [@media(min-width:640px)_and_(orientation:landscape)]:min-h-0 bg-[#030508] flex items-center justify-center overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerLeave={handleCanvasPointerLeave}
          className="w-full h-full block touch-none cursor-crosshair"
        />
      </div>

      {/* Right / Bottom: Control & Upgrades Panel (hidden on Title Screen) */}
      {screen !== 'TITLE' && (
        <div className="h-[clamp(220px,46dvh,460px)] [@media(min-width:640px)_and_(orientation:landscape)]:h-full w-full [@media(min-width:640px)_and_(orientation:landscape)]:w-auto flex shrink-0">
          <ControlPanel
            hud={hud}
            onSellAll={handleSellAll}
            onBuyUpgrade={handleBuyUpgrade}
            onSetStance={handleSetStance}
            onTriggerDeflector={handleTriggerDeflector}
            onCycleTarget={handleCycleTarget}
            onBuyTechNode={handleBuyTechNode}
            onBuyFleetShip={handleBuyFleetShip}
            onUseConsumable={handleUseConsumable}
            onChallengeBoss={handleChallengeBoss}
            onSelectPlanet={handleSelectPlanet}
            onToggleAnomaly={handleToggleAnomaly}
            onRequestPrestige={() => setShowPrestigeConfirm(true)}
            onToggleMute={handleToggleMute}
            onPause={() => setScreen('PAUSED')}
            onRequestReset={() => setShowResetConfirm(true)}
          />
        </div>
      )}

      {/* Title Screen */}
      {screen === 'TITLE' && (
        <TitleScreen
          hasSavedRun={hasSavedRun}
          savedCredits={hud.creditos}
          savedTimeSec={hud.tiempoJugadoSegundos}
          savedPlanet={hud.planetaActual}
          savedPrestige={hud.prestigioNivel}
          savedCores={hud.nucleos}
          onStart={handleStartGame}
          onRequestReset={() => setShowResetConfirm(true)}
        />
      )}

      {/* Rank-Up 3-Card Talent Draft Modal */}
      {screen === 'PLAYING' && talentDraft && (
        <TalentDraftModal
          rank={talentDraft.rank}
          choices={talentDraft.choices}
          ownedTalents={hud.talentos}
          onSelectTalent={handleSelectTalent}
        />
      )}

      {/* Pause Modal */}
      {screen === 'PAUSED' && (
        <PauseModal
          silencio={hud.silencio}
          onResume={() => setScreen('PLAYING')}
          onToggleMute={handleToggleMute}
          onExportSaveJson={handleExportSaveJson}
          onImportSaveJson={handleImportSaveJson}
          onRequestReset={() => setShowResetConfirm(true)}
        />
      )}

      {/* Victory Modal */}
      {screen === 'VICTORY' && (
        <VictoryModal
          hud={hud}
          onContinuePlaying={() => setScreen('PLAYING')}
          onEnterAnomaly={() => {
            if (!hud.anomaliaActiva) {
              engineRef.current.toggleAnomaly();
              syncHud();
            }
            setScreen('PLAYING');
          }}
          onRequestPrestige={() => setShowPrestigeConfirm(true)}
        />
      )}

      {/* Prestige Confirmation Modal */}
      {showPrestigeConfirm && (
        <PrestigeConfirmModal
          currentPrestige={hud.prestigioNivel}
          maxAnomalyWave={hud.maxOleadaAnomalia}
          onConfirm={handleConfirmPrestige}
          onCancel={() => setShowPrestigeConfirm(false)}
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <ResetConfirmModal
          onConfirm={handleConfirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </main>
  );
}

export default OrbitTitanGame;
