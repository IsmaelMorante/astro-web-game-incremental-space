import { describe, expect, it } from 'vitest';
import {
  getBulkFleetPreview,
  getBulkUpgradePreview,
  getCannonDamage,
  getFleetDps,
  getFleetShipCost,
  getPrestigeCoreReward,
  getPrestigeDamageMultiplier,
  getPrestigeLootMultiplier,
  getShipStats,
  getUpgradeCost,
} from '../../src/features/orbita-titan/game/formulas';
import { createInitialSaveData } from '../../src/features/orbita-titan/game/types';

describe('Órbita Titán — Fórmulas de combate, economía, costes y prestigio', () => {
  describe('Daño de cañón (getCannonDamage)', () => {
    it('calcula el daño base lineal y el bono de sobremarcha', () => {
      expect(getCannonDamage(0, 0)).toBe(10);
      expect(getCannonDamage(1, 0)).toBe(15);
      expect(getCannonDamage(5, 0)).toBe(35);
      expect(getCannonDamage(10, 2)).toBe(10 + 5 * 10 + 12 * 2);
    });

    it('aplica el hito +25 % de daño de impacto a partir del nivel 15', () => {
      // Nivel 14: 10 + 5*14 = 80 (sin hito)
      expect(getCannonDamage(14, 0)).toBe(80);
      // Nivel 15: round((10 + 5*15) * 1.25) = round(85 * 1.25) = 106
      expect(getCannonDamage(15, 0)).toBe(106);
      // Nivel 20 con 2 niveles de sobremarcha: round((10 + 100 + 24) * 1.25) = 168
      expect(getCannonDamage(20, 2)).toBe(168);
    });
  });

  describe('DPS total y estadísticas de nave (getShipStats)', () => {
    it('calcula el DPS total inicial igual al DPS base del cañón sin drones ni flota', () => {
      const save = createInitialSaveData();
      const stats = getShipStats(save.mejoras, save.sobremarcha, save.flota);

      expect(stats.danoCanon).toBe(10);
      expect(stats.proyectilesPorDisparo).toBe(1);
      expect(stats.cadencia).toBe(1);
      expect(stats.dpsCanon).toBe(10);
      expect(stats.dpsDrones).toBe(0);
      expect(stats.dpsFlota).toBe(0);
      expect(stats.dpsTotal).toBe(10);
    });

    it('suma dpsCanon + dpsDrones + dpsFlota incluyendo multiplicadores de hitos, tecnología, talentos, prestigio, postura y sobrecarga', () => {
      const save = createInitialSaveData();
      save.mejoras.danoCanon = 10; // 60 daño, 2 proyectiles, 20 % crit (x1.6)
      save.mejoras.cadencia = 5; // (1 + 1.25) * 1.15 = 2.59 disp/s
      save.mejoras.dronApoyo = 5; // 2 drones, 60 daño base, 1.4 disp/s
      save.flota.caza = 2; // 2 * 28 * 2.2 = 123.2 base
      save.flota.corbeta = 1; // 1 * 85 * 1.1 = 93.5 base
      save.tecnologia.hazDesintegrador = true; // x1.33 en dpsCanon
      save.tecnologia.sobrecargaFlota = true; // x1.35 en drones y flota
      save.talentos.calibrePesado = 1; // +18 % daño cañón
      save.talentos.maestriaFlota = 1; // +22 % daño drones y flota
      save.prestigioNivel = 2; // x2.0 daño

      const stats = getShipStats(
        save.mejoras,
        save.sobremarcha,
        save.flota,
        true, // sobrecargaActiva: x1.5
        save.tecnologia,
        save.talentos,
        save.prestigioNivel,
        null,
        'asalto' // +25 % daño, +20 % cadencia
      );

      // Verificación exacta por componente
      // danoCanon: round(60 * 1.18 * 2.0 * 1.5 * 1.25) = round(265.5) = 266
      expect(stats.danoCanon).toBe(266);
      expect(stats.proyectilesPorDisparo).toBe(2);
      // cadencia: round2(2.59 * 1.2) = 3.11
      expect(stats.cadencia).toBe(3.11);

      const expectedCritMult = 1 + 0.2 * (1.6 - 1);
      const expectedDpsCanon = 266 * 2 * 3.11 * expectedCritMult * 1.33;
      expect(stats.dpsCanon).toBeCloseTo(expectedDpsCanon, 6);

      const expectedFleetMult = 1.22 * 1.35 * 2.0 * 1.5 * 1.25;
      const expectedDanoDron = Math.round(60 * expectedFleetMult);
      expect(stats.danoDron).toBe(expectedDanoDron);
      expect(stats.dpsDrones).toBeCloseTo(expectedDanoDron * 2 * 1.4, 6);
      expect(stats.dpsFlota).toBeCloseTo(getFleetDps(save.flota, expectedFleetMult), 6);
      expect(stats.dpsTotal).toBeCloseTo(stats.dpsCanon + stats.dpsDrones + stats.dpsFlota, 6);
    });
  });

  describe('Costes escalados y vista previa de compra (×1 / ×5 / MÁX)', () => {
    it('calcula el coste unitario lineal, progresión tardía tras nivel 6 y sobremarcha al superar el tope', () => {
      // danoCanon: base 25, inc 25, tope 20
      expect(getUpgradeCost('danoCanon', 0, 0)).toBe(25);
      expect(getUpgradeCost('danoCanon', 1, 0)).toBe(50);
      expect(getUpgradeCost('danoCanon', 6, 0)).toBe(25 + 25 * 6); // 175
      // Nivel 7: lateStep = 1 -> 25 + 175 + round(25 * 0.14 * 1) = 204
      expect(getUpgradeCost('danoCanon', 7, 0)).toBe(204);

      // Sobremarcha tras alcanzar tope 20
      const overdriveCost0 = getUpgradeCost('danoCanon', 20, 0);
      const overdriveCost1 = getUpgradeCost('danoCanon', 20, 1);
      expect(overdriveCost0).not.toBeNull();
      expect(overdriveCost1!).toBeGreaterThan(overdriveCost0!);

      // Autoventa es única y no admite sobremarcha
      expect(getUpgradeCost('autoventa', 0, 0)).toBe(500);
      expect(getUpgradeCost('autoventa', 1, 0)).toBeNull();
    });

    it('calcula getBulkUpgradePreview correctamente para ×1, ×5 y MÁX', () => {
      // ×1
      expect(getBulkUpgradePreview('danoCanon', 0, 0, 1, 0)).toEqual({
        levels: 1,
        totalCost: 25,
        isMaxed: false,
      });

      // ×5 desde nivel 0: 25 + 50 + 75 + 100 + 125 = 375
      expect(getBulkUpgradePreview('danoCanon', 0, 0, 5, 1000)).toEqual({
        levels: 5,
        totalCost: 375,
        isMaxed: false,
      });

      // MÁX con 160 cr: compra niveles 0, 1 y 2 (25 + 50 + 75 = 150), no alcanza el 4.º (100)
      expect(getBulkUpgradePreview('danoCanon', 0, 0, 'max', 160)).toEqual({
        levels: 3,
        totalCost: 150,
        isMaxed: false,
      });

      // MÁX sin créditos para 1 nivel devuelve 1 nivel con su coste mínimo
      expect(getBulkUpgradePreview('danoCanon', 0, 0, 'max', 10)).toEqual({
        levels: 1,
        totalCost: 25,
        isMaxed: false,
      });

      // Mejora única ya comprada devuelve isMaxed: true
      expect(getBulkUpgradePreview('autoventa', 1, 0, 'max', 9999)).toEqual({
        levels: 0,
        totalCost: null,
        isMaxed: true,
      });
    });

    it('escala costes exponenciales de flota y calcula vista previa ×1 / ×5 / MÁX', () => {
      const c0 = getFleetShipCost('caza', 0); // 350
      const c1 = getFleetShipCost('caza', 1); // round(350 * 1.45) = 508
      const c2 = getFleetShipCost('caza', 2); // round(350 * 1.45^2) = 736
      expect(c0).toBe(350);
      expect(c1).toBe(508);
      expect(c2).toBe(736);

      expect(getBulkFleetPreview('caza', 0, 1, 0)).toEqual({ count: 1, totalCost: 350 });
      expect(getBulkFleetPreview('caza', 0, 'max', c0 + c1 + 10)).toEqual({
        count: 2,
        totalCost: c0 + c1,
      });

      const fivePreview = getBulkFleetPreview('caza', 0, 5, 100000);
      expect(fivePreview.count).toBe(5);
      expect(fivePreview.totalCost).toBe(
        c0 + c1 + c2 + getFleetShipCost('caza', 3) + getFleetShipCost('caza', 4)
      );
    });
  });

  describe('Recompensa y multiplicadores de prestigio', () => {
    it('calcula núcleos de prestigio base, por nivel de prestigio y por oleada de anomalía >= 6', () => {
      expect(getPrestigeCoreReward(0, 0)).toBe(2);
      expect(getPrestigeCoreReward(1, 5)).toBe(2);
      expect(getPrestigeCoreReward(2, 5)).toBe(3);
      expect(getPrestigeCoreReward(2, 6)).toBe(4);
      expect(getPrestigeCoreReward(4, 9)).toBe(5);
    });

    it('calcula multiplicadores permanentes de daño y botín de prestigio', () => {
      expect(getPrestigeDamageMultiplier(0)).toBe(1);
      expect(getPrestigeDamageMultiplier(2)).toBe(2);
      expect(getPrestigeLootMultiplier(0)).toBe(1);
      expect(getPrestigeLootMultiplier(3)).toBeCloseTo(2.2, 6);
    });
  });
});
