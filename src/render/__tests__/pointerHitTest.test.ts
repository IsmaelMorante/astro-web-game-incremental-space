import { describe, expect, it } from 'vitest';
import {
  clientToWorldPoint,
  hitTestTarget,
  type BoundingRectLike,
} from '../pointerHitTest';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../../engine/balance';
import type { AsteroidTarget, BossTarget, EnemyTarget } from '../../engine/types';

describe('pointerHitTest - R3: selección de objetivos por puntero', () => {
  describe('clientToWorldPoint', () => {
    it('R3: proyecta coordenadas relativas del lienzo a coordenadas lógicas del mundo', () => {
      const rect: BoundingRectLike = {
        left: 50,
        top: 100,
        width: 400,
        height: 300,
      };

      // Centro del lienzo
      const clientX = 250; // 50 + 200 -> mitad del ancho
      const clientY = 250; // 100 + 150 -> mitad del alto

      const world = clientToWorldPoint(clientX, clientY, rect);

      expect(world.x).toBeCloseTo(ARENA_WIDTH / 2, 2);
      expect(world.y).toBeCloseTo(ARENA_HEIGHT / 2, 2);
    });

    it('R3: devuelve origen { x: 0, y: 0 } ante rectángulos colapsados o sin dimensiones positivas', () => {
      const zeroWidth: BoundingRectLike = { left: 10, top: 10, width: 0, height: 500 };
      const zeroHeight: BoundingRectLike = { left: 10, top: 10, width: 500, height: 0 };
      const negativeRect: BoundingRectLike = { left: 10, top: 10, width: -100, height: -100 };

      expect(clientToWorldPoint(100, 100, zeroWidth)).toEqual({ x: 0, y: 0 });
      expect(clientToWorldPoint(100, 100, zeroHeight)).toEqual({ x: 0, y: 0 });
      expect(clientToWorldPoint(100, 100, negativeRect)).toEqual({ x: 0, y: 0 });
    });

    it('R3: admite dimensiones de mundo personalizadas', () => {
      const rect: BoundingRectLike = {
        left: 0,
        top: 0,
        width: 1000,
        height: 500,
      };

      const customWidth = 2000;
      const customHeight = 1000;

      const result = clientToWorldPoint(250, 250, rect, customWidth, customHeight);

      expect(result.x).toBe(500);
      expect(result.y).toBe(500);
    });
  });

  describe('hitTestTarget', () => {
    const createAsteroid = (
      id: string,
      x: number,
      y: number,
      radius: number,
      currentHp: number
    ): AsteroidTarget => ({
      id,
      type: 'asteroid',
      x,
      y,
      radius,
      maxHp: 100,
      currentHp,
      rewardCredits: 10,
      spawnIndex: 1,
    });

    const createEnemy = (
      id: string,
      x: number,
      y: number,
      radius: number,
      currentHp: number
    ): EnemyTarget => ({
      id,
      type: 'enemy',
      x,
      y,
      radius,
      maxHp: 80,
      currentHp,
      rewardCredits: 15,
      damage: 5,
      fireCooldown: 1,
      fireTimer: 0,
      spawnIndex: 1,
    });

    const createBoss = (
      id: string,
      x: number,
      y: number,
      radius: number,
      currentHp: number
    ): BossTarget => ({
      id,
      type: 'boss',
      name: `Jefe ${id}`,
      x,
      y,
      radius,
      maxHp: 500,
      currentHp,
      rewardCredits: 100,
      damage: 20,
      fireCooldown: 1,
      fireTimer: 0,
      spawnIndex: 1,
    });

    it('R3: detecta el objetivo cuando el punto cae dentro de su radio físico exacto', () => {
      const asteroid = createAsteroid('ast-1', 200, 300, 25, 50);
      const targets = [asteroid];

      // Punto a 15 px de distancia del centro (dentro del radio 25)
      expect(hitTestTarget({ x: 200, y: 315 }, targets)).toBe('ast-1');

      // Punto a 35 px de distancia (fuera del radio 25)
      expect(hitTestTarget({ x: 200, y: 335 }, targets)).toBeNull();
    });

    it('R3: amplía el radio efectivo con margen táctil (touchPadding) para pantallas táctiles', () => {
      const enemy = createEnemy('enemy-1', 150, 150, 20, 40);
      const targets = [enemy];

      // Punto a 26 px de distancia (fuera del radio 20 sin padding)
      expect(hitTestTarget({ x: 150, y: 176 }, targets, 0)).toBeNull();

      // Con touchPadding de 10 px, el radio efectivo es 30 px (26 <= 30)
      expect(hitTestTarget({ x: 150, y: 176 }, targets, 10)).toBe('enemy-1');

      // Padding negativo se acota a 0 sin romper el cálculo
      expect(hitTestTarget({ x: 150, y: 176 }, targets, -5)).toBeNull();
    });

    it('R3: selecciona el objetivo más cercano cuando varios abarcan el punto', () => {
      const closeAsteroid = createAsteroid('close', 100, 100, 30, 50);
      const farAsteroid = createAsteroid('far', 120, 100, 30, 50);
      const targets = [farAsteroid, closeAsteroid];

      // Punto en (105, 100): distancia a 'close' es 5 px; distancia a 'far' es 15 px
      // Ambos abarcan el punto, pero 'close' está más cerca
      const selected = hitTestTarget({ x: 105, y: 100 }, targets);
      expect(selected).toBe('close');
    });

    it('R3: ignora objetivos con vida agotada (currentHp <= 0)', () => {
      const deadBoss = createBoss('boss-dead', 300, 300, 50, 0);
      const aliveEnemy = createEnemy('enemy-alive', 320, 300, 30, 50);
      const targets = [deadBoss, aliveEnemy];

      // El punto cae exactamente sobre el centro del jefe muerto
      const selected = hitTestTarget({ x: 300, y: 300 }, targets);

      // Debe ignorar el jefe muerto y elegir el enemigo vivo (distancia 20 <= radio 30)
      expect(selected).toBe('enemy-alive');
    });

    it('R3: devuelve null cuando la lista de objetivos está vacía o ningún objetivo está al alcance', () => {
      expect(hitTestTarget({ x: 100, y: 100 }, [])).toBeNull();

      const outOfRange = [createAsteroid('out', 500, 500, 10, 50)];
      expect(hitTestTarget({ x: 50, y: 50 }, outOfRange)).toBeNull();
    });
  });
});
