import { describe, expect, it } from 'vitest';
import {
  UPGRADE_METADATA,
  createHudSnapshot,
  formatCargoStatus,
  formatCredits,
  formatDuration,
  formatPlanet,
  formatShipStatus,
  formatUpgrade,
  formatVictoryStats,
} from '../hudFormatters';
import { createInitialState } from '../../engine';
import type { CargoState, GameState, ShipState, UpgradeKey } from '../../engine/types';

describe('hudFormatters', () => {
  describe('formatCredits (R6)', () => {
    it('formatea cifras con separador de miles por espacio y sufijo cr', () => {
      expect(formatCredits(0)).toBe('0 cr');
      expect(formatCredits(50)).toBe('50 cr');
      expect(formatCredits(500)).toBe('500 cr');
      expect(formatCredits(1250)).toBe('1 250 cr');
      expect(formatCredits(1000000)).toBe('1 000 000 cr');
    });

    it('trunca decimales y protege contra valores negativos o no finitos', () => {
      expect(formatCredits(1250.85)).toBe('1 250 cr');
      expect(formatCredits(-100)).toBe('0 cr');
      expect(formatCredits(Number.NaN)).toBe('0 cr');
      expect(formatCredits(Number.POSITIVE_INFINITY)).toBe('0 cr');
    });
  });

  describe('formatDuration (R6)', () => {
    it('formatea duraciones en formato MM:SS con relleno de ceros', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(9)).toBe('00:09');
      expect(formatDuration(59)).toBe('00:59');
      expect(formatDuration(60)).toBe('01:00');
      expect(formatDuration(125)).toBe('02:05');
      expect(formatDuration(3661)).toBe('61:01');
    });

    it('protege contra valores negativos o no finitos retornando 00:00', () => {
      expect(formatDuration(-15)).toBe('00:00');
      expect(formatDuration(Number.NaN)).toBe('00:00');
    });
  });

  describe('formatCargoStatus (R4, R6)', () => {
    it('formatea estado de bodega normal cuando no está llena', () => {
      const cargo: CargoState = { units: 4, maxCapacity: 10, value: 80 };
      const status = formatCargoStatus(cargo, false);

      expect(status.units).toBe(4);
      expect(status.maxCapacity).toBe(10);
      expect(status.value).toBe(80);
      expect(status.text).toBe('4 / 10');
      expect(status.isFull).toBe(false);
      expect(status.warningText).toBeNull();
      expect(status.canSell).toBe(true);
      expect(status.autoSellActive).toBe(false);
    });

    it('emite aviso «Bodega llena» cuando se alcanza el tope sin autoventa', () => {
      const cargo: CargoState = { units: 10, maxCapacity: 10, value: 200 };
      const status = formatCargoStatus(cargo, false);

      expect(status.isFull).toBe(true);
      expect(status.warningText).toBe('Bodega llena');
      expect(status.canSell).toBe(true);
      expect(status.autoSellActive).toBe(false);
    });

    it('no emite aviso de bodega llena y desactiva venta manual si la autoventa está activa', () => {
      const cargo: CargoState = { units: 10, maxCapacity: 10, value: 200 };
      const status = formatCargoStatus(cargo, true);

      expect(status.isFull).toBe(true);
      expect(status.warningText).toBeNull();
      expect(status.canSell).toBe(false);
      expect(status.autoSellActive).toBe(true);
    });

    it('desactiva venta manual si la bodega está vacía', () => {
      const cargo: CargoState = { units: 0, maxCapacity: 10, value: 0 };
      const status = formatCargoStatus(cargo, false);

      expect(status.canSell).toBe(false);
      expect(status.warningText).toBeNull();
    });
  });

  describe('formatUpgrade (R6, R7)', () => {
    const keys: readonly UpgradeKey[] = [
      'cannonDamage',
      'fireRate',
      'hullShield',
      'cargoCapacity',
      'supportDrone',
    ];

    it.each(keys)('formatea la mejora progresiva %s con nivel y coste inicial', (key) => {
      const baseState = createInitialState();
      const state: GameState = { ...baseState, credits: 100 };

      const view = formatUpgrade(state, key);
      const meta = UPGRADE_METADATA[key];

      expect(view.key).toBe(key);
      expect(view.name).toBe(meta.name);
      expect(view.description).toBe(meta.description);
      expect(view.currentLevel).toBe(0);
      expect(view.maxLevel).toBe(meta.maxLevel);
      expect(view.levelText).toBe(`0 / ${meta.maxLevel}`);
      expect(view.isMaxed).toBe(false);
      expect(view.canAfford).toBe(true);
      expect(view.rawCost).toBeGreaterThan(0);
      expect(view.costText).toContain('cr');
    });

    it('marca canAfford en false si no hay créditos suficientes', () => {
      const baseState = createInitialState();
      const state: GameState = { ...baseState, credits: 0 };

      const view = formatUpgrade(state, 'cannonDamage');
      expect(view.canAfford).toBe(false);
      expect(view.costText).toBe('25 cr');
    });

    it('muestra «Máximo» y desactiva compra al alcanzar el tope de nivel', () => {
      const baseState = createInitialState();
      const state: GameState = {
        ...baseState,
        credits: 99999,
        upgrades: {
          ...baseState.upgrades,
          cannonDamage: 20,
        },
      };

      const view = formatUpgrade(state, 'cannonDamage');
      expect(view.levelText).toBe('20 / 20');
      expect(view.costText).toBe('Máximo');
      expect(view.isMaxed).toBe(true);
      expect(view.canAfford).toBe(false);
      expect(view.rawCost).toBeNull();
    });

    it('formatea Autoventa como «Bloqueada» con coste de 500 cr antes de comprarla', () => {
      const baseState = createInitialState();
      const state: GameState = {
        ...baseState,
        credits: 200,
        upgrades: {
          ...baseState.upgrades,
          autoSell: false,
        },
      };

      const view = formatUpgrade(state, 'autoSell');
      expect(view.levelText).toBe('Bloqueada');
      expect(view.costText).toBe('500 cr');
      expect(view.rawCost).toBe(500);
      expect(view.isMaxed).toBe(false);
      expect(view.canAfford).toBe(false);

      const affordableState: GameState = { ...state, credits: 600 };
      const affordableView = formatUpgrade(affordableState, 'autoSell');
      expect(affordableView.canAfford).toBe(true);
    });

    it('formatea Autoventa como «Desbloqueada» y coste «Máximo» una vez adquirida', () => {
      const baseState = createInitialState();
      const state: GameState = {
        ...baseState,
        credits: 10000,
        upgrades: {
          ...baseState.upgrades,
          autoSell: true,
        },
      };

      const view = formatUpgrade(state, 'autoSell');
      expect(view.levelText).toBe('Desbloqueada');
      expect(view.costText).toBe('Máximo');
      expect(view.rawCost).toBeNull();
      expect(view.isMaxed).toBe(true);
      expect(view.canAfford).toBe(false);
    });
  });

  describe('formatPlanet (R6, R9, R10)', () => {
    it('muestra progreso numérico mientras no se alcance el umbral de objetivos', () => {
      const planet = formatPlanet(1, 1, 1, 12, false);

      expect(planet.id).toBe(1);
      expect(planet.name).toBe('Cinturón de Hierro');
      expect(planet.isCurrent).toBe(true);
      expect(planet.isUnlocked).toBe(true);
      expect(planet.bossThreshold).toBe(25);
      expect(planet.destroyedCount).toBe(12);
      expect(planet.progressText).toBe('12 / 25');
      expect(planet.bossAvailable).toBe(false);
      expect(planet.canChallenge).toBe(false);
    });

    it('muestra «Jefe disponible» y habilita desafío cuando se alcanza el umbral en planeta actual', () => {
      const planet = formatPlanet(1, 1, 1, 25, false);

      expect(planet.progressText).toBe('Jefe disponible');
      expect(planet.bossAvailable).toBe(true);
      expect(planet.bossName).toBe('Perforadora Titán');
      expect(planet.canChallenge).toBe(true);
    });

    it('deshabilita desafío si el combate contra el jefe ya está activo', () => {
      const planet = formatPlanet(1, 1, 1, 30, true);

      expect(planet.bossAvailable).toBe(true);
      expect(planet.canChallenge).toBe(false);
    });

    it('deshabilita desafío si el planeta con umbral alcanzado no es el planeta actual', () => {
      const planet = formatPlanet(2, 1, 2, 35, false);

      expect(planet.isCurrent).toBe(false);
      expect(planet.bossAvailable).toBe(true);
      expect(planet.canChallenge).toBe(false);
    });

    it('identifica planetas bloqueados según el nivel máximo desbloqueado', () => {
      const planet3 = formatPlanet(3, 1, 2, 0, false);
      expect(planet3.isUnlocked).toBe(false);

      const planet2 = formatPlanet(2, 1, 2, 0, false);
      expect(planet2.isUnlocked).toBe(true);
    });
  });

  describe('formatShipStatus (R6)', () => {
    it('calcula puntos y porcentajes de casco y escudo con redondeo superior', () => {
      const ship: ShipState = {
        currentHull: 40.2,
        maxHull: 80,
        currentShield: 19.1,
        maxShield: 40,
        shieldRegenCooldown: 5,
        fireTimer: 0,
        droneFireTimer: 0,
      };

      const view = formatShipStatus(ship);

      expect(view.currentHull).toBe(41);
      expect(view.maxHull).toBe(80);
      expect(view.hullPercent).toBe(50);
      expect(view.hullText).toBe('41 / 80');

      expect(view.currentShield).toBe(20);
      expect(view.maxShield).toBe(40);
      expect(view.shieldPercent).toBe(48);
      expect(view.shieldText).toBe('20 / 40');
    });

    it('no genera valores negativos ante daño masivo', () => {
      const ship: ShipState = {
        currentHull: -10,
        maxHull: 80,
        currentShield: -5,
        maxShield: 40,
        shieldRegenCooldown: 5,
        fireTimer: 0,
        droneFireTimer: 0,
      };

      const view = formatShipStatus(ship);
      expect(view.currentHull).toBe(0);
      expect(view.hullPercent).toBe(0);
      expect(view.currentShield).toBe(0);
      expect(view.shieldPercent).toBe(0);
    });
  });

  describe('formatVictoryStats (R6, R10)', () => {
    it('formatea las estadísticas de victoria en castellano', () => {
      const stats = {
        targetsDestroyed: 142,
        bossesDefeated: 4,
        totalCreditsEarned: 24500,
      };

      const view = formatVictoryStats(stats, 315);

      expect(view.totalTimeText).toBe('05:15');
      expect(view.targetsDestroyed).toBe(142);
      expect(view.bossesDefeated).toBe(4);
      expect(view.totalCreditsText).toBe('24 500 cr');
    });
  });

  describe('createHudSnapshot (R6, R7, R10, R11)', () => {
    it('construye una instantánea coherente e inmutable del HUD completo', () => {
      const baseState: GameState = createInitialState();
      const state: GameState = {
        ...baseState,
        credits: 1500,
        tiempoJugadoSegundos: 125,
        lockedTargetId: 'target-asteroid-1',
      };

      const snapshot = createHudSnapshot(state, false, false);

      expect(snapshot.creditsText).toBe('1 500 cr');
      expect(snapshot.creditsRaw).toBe(1500);
      expect(snapshot.timeText).toBe('02:05');
      expect(snapshot.timeSeconds).toBe(125);
      expect(snapshot.muted).toBe(false);
      expect(snapshot.muteButtonLabel).toBe('Silenciar');
      expect(snapshot.lockedTargetId).toBe('target-asteroid-1');

      // 4 planetas
      expect(snapshot.planets).toHaveLength(4);
      expect(snapshot.currentPlanet.id).toBe(1);
      expect(snapshot.currentPlanet.name).toBe('Cinturón de Hierro');

      // 6 mejoras
      expect(snapshot.upgrades).toHaveLength(6);
      const upgradeKeys = snapshot.upgrades.map((u) => u.key);
      expect(upgradeKeys).toEqual([
        'cannonDamage',
        'fireRate',
        'hullShield',
        'cargoCapacity',
        'supportDrone',
        'autoSell',
      ]);

      // Estado de jefe y victoria
      expect(snapshot.boss.name).toBe('Perforadora Titán');
      expect(snapshot.boss.active).toBe(false);
      expect(snapshot.victory.active).toBe(false);
    });

    it('actualiza etiqueta de silencio y activa modal de victoria cuando procede', () => {
      const state = createInitialState();
      const mutedSnapshot = createHudSnapshot(state, true, true);

      expect(mutedSnapshot.muted).toBe(true);
      expect(mutedSnapshot.muteButtonLabel).toBe('Activar sonido');
      expect(mutedSnapshot.victory.active).toBe(true);
    });
  });
});
