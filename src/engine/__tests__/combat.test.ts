import { describe, expect, it } from 'vitest';
import {
  DRONE_FIRE_INTERVAL_SECONDS,
  DRONE_POSITION,
  PROJECTILE_SPEED,
  SHIP_POSITION,
  calculateDistance,
  createInitialState,
  getCannonDamage,
  getDroneDamage,
  getFireInterval,
  resetProjectileSequence,
  selectTarget,
  setLockedTarget,
  stepDroneFire,
  stepEnemyCombat,
  stepShieldRegen,
  stepShipFire,
  type AsteroidTarget,
  type BossTarget,
  type EnemyTarget,
  type GameState,
  type ShipState,
  type Target,
} from '../index';

function createMockAsteroid(
  id: string,
  x: number,
  y: number,
  hp: number = 60,
  spawnIndex: number = 0
): AsteroidTarget {
  return {
    id,
    type: 'asteroid',
    x,
    y,
    radius: 26,
    currentHp: hp,
    maxHp: hp,
    rewardCredits: 10,
    spawnIndex,
  };
}

function createMockEnemy(
  id: string,
  x: number,
  y: number,
  hp: number = 110,
  damage: number = 6,
  spawnIndex: number = 1
): EnemyTarget {
  return {
    id,
    type: 'enemy',
    x,
    y,
    radius: 22,
    currentHp: hp,
    maxHp: hp,
    damage,
    fireCooldown: 2.0,
    fireTimer: 0,
    rewardCredits: 22,
    spawnIndex,
  };
}

function createMockBoss(
  id: string,
  x: number,
  y: number,
  hp: number = 1200,
  damage: number = 10,
  spawnIndex: number = 99
): BossTarget {
  return {
    id,
    type: 'boss',
    name: 'Perforadora Titán',
    x,
    y,
    radius: 46,
    currentHp: hp,
    maxHp: hp,
    damage,
    fireCooldown: 2.0,
    fireTimer: 0,
    rewardCredits: 220,
    spawnIndex,
  };
}

describe('Combate y puntero (R2 y R3)', () => {
  describe('R2 - Autoapuntado y fijación por puntero', () => {
    it('R2-1: Autoapuntado prioriza jefe activo sobre enemigos y asteroides más cercanos', () => {
      const asteroidNear = createMockAsteroid('ast_1', SHIP_POSITION.x + 50, SHIP_POSITION.y, 60, 0);
      const enemyNear = createMockEnemy('ene_1', SHIP_POSITION.x + 80, SHIP_POSITION.y, 110, 6, 1);
      const bossFar = createMockBoss('boss_1', SHIP_POSITION.x + 300, SHIP_POSITION.y, 1200, 10, 2);

      const targets: Target[] = [asteroidNear, bossFar, enemyNear];
      const selected = selectTarget(targets, SHIP_POSITION, null);

      expect(selected).not.toBeNull();
      expect(selected?.id).toBe('boss_1');
      expect(selected?.type).toBe('boss');
    });

    it('R2-2: Autoapuntado prioriza enemigo más cercano sobre asteroides más cercanos', () => {
      const asteroidVeryNear = createMockAsteroid('ast_1', SHIP_POSITION.x + 40, SHIP_POSITION.y, 60, 0);
      const enemyClose = createMockEnemy('ene_close', SHIP_POSITION.x + 100, SHIP_POSITION.y, 110, 6, 1);
      const enemyFar = createMockEnemy('ene_far', SHIP_POSITION.x + 200, SHIP_POSITION.y, 110, 6, 2);

      const targets: Target[] = [asteroidVeryNear, enemyFar, enemyClose];
      const selected = selectTarget(targets, SHIP_POSITION, null);

      expect(selected).not.toBeNull();
      expect(selected?.id).toBe('ene_close');
      expect(selected?.type).toBe('enemy');
    });

    it('R2-3: Autoapuntado prioriza asteroide más cercano en ausencia de jefe y enemigos', () => {
      const asteroidClose = createMockAsteroid('ast_close', SHIP_POSITION.x + 70, SHIP_POSITION.y, 60, 0);
      const asteroidFar = createMockAsteroid('ast_far', SHIP_POSITION.x + 180, SHIP_POSITION.y, 60, 1);

      const targets: Target[] = [asteroidFar, asteroidClose];
      const selected = selectTarget(targets, SHIP_POSITION, null);

      expect(selected).not.toBeNull();
      expect(selected?.id).toBe('ast_close');
    });

    it('R2-4: Autoapuntado desempata por orden de aparición (menor spawnIndex) en distancias idénticas', () => {
      const enemyFirst = createMockEnemy('ene_spawn_1', SHIP_POSITION.x + 100, SHIP_POSITION.y, 110, 6, 1);
      const enemySecond = createMockEnemy('ene_spawn_2', SHIP_POSITION.x - 100, SHIP_POSITION.y, 110, 6, 5);

      const dist1 = calculateDistance(SHIP_POSITION, enemyFirst);
      const dist2 = calculateDistance(SHIP_POSITION, enemySecond);
      expect(dist1).toBeCloseTo(dist2, 3);

      const selected = selectTarget([enemySecond, enemyFirst], SHIP_POSITION, null);
      expect(selected?.id).toBe('ene_spawn_1');
    });

    it('R2-5: Fijación manual por puntero sobrescribe autoapuntado sobre cualquier objetivo vivo', () => {
      const state = createInitialState();
      const boss = createMockBoss('boss_1', 450, 140, 1200);
      const asteroid = createMockAsteroid('ast_target', 200, 200, 60);

      const stateWithTargets: GameState = {
        ...state,
        targets: [boss, asteroid],
      };

      // Sin fijación, elegiría el jefe
      expect(selectTarget(stateWithTargets.targets, SHIP_POSITION, null)?.id).toBe('boss_1');

      // Fijación manual del asteroide
      const lockedState = setLockedTarget(stateWithTargets, 'ast_target');
      expect(lockedState.lockedTargetId).toBe('ast_target');

      const targeted = selectTarget(lockedState.targets, SHIP_POSITION, lockedState.lockedTargetId);
      expect(targeted?.id).toBe('ast_target');
    });

    it('R2-6: Fijación se libera automáticamente al destruir el objetivo fijado', () => {
      const initialState = createInitialState();
      const weakEnemy = createMockEnemy('ene_weak', 500, 300, 10, 6); // 10 HP, muere con 1 disparo base de 10
      const anotherEnemy = createMockEnemy('ene_survivor', 700, 300, 110, 6);

      const stateWithLocked: GameState = {
        ...initialState,
        targets: [weakEnemy, anotherEnemy],
        lockedTargetId: 'ene_weak',
        ship: {
          ...initialState.ship,
          fireTimer: 1.0, // Listo para disparar de inmediato
        },
      };

      const fireResult = stepShipFire(
        stateWithLocked.ship,
        stateWithLocked.upgrades,
        stateWithLocked.targets,
        stateWithLocked.lockedTargetId,
        0.1
      );

      expect(fireResult.destroyedTargets.length).toBe(1);
      expect(fireResult.destroyedTargets[0].id).toBe('ene_weak');
      // La fijación debe quedar liberada (null)
      expect(fireResult.lockedTargetId).toBeNull();
    });

    it('R2-7: Pulsación en zona vacía libera la fijación manual y vuelve al autoapuntado base', () => {
      const state = createInitialState();
      const enemy = createMockEnemy('ene_1', 300, 300);
      const withLock: GameState = {
        ...state,
        targets: [enemy],
        lockedTargetId: 'ene_1',
      };

      expect(withLock.lockedTargetId).toBe('ene_1');

      // Pulsar en vacío corresponde a pasar null a setLockedTarget
      const unlockedState = setLockedTarget(withLock, null);
      expect(unlockedState.lockedTargetId).toBeNull();
    });
  });

  describe('R3 - Disparo de nave y dron, absorción y regeneración de escudo', () => {
    it('R3-1: Disparo de la nave respeta intervalo según cadencia y emite proyectil y evento', () => {
      resetProjectileSequence();
      const baseState = createInitialState();
      const asteroid = createMockAsteroid('ast_1', 500, 300, 100);
      const interval = getFireInterval(baseState.upgrades.fireRate); // nivel 0 = 1.0 s
      expect(interval).toBe(1.0);

      // Con timer 0 y dt de 0.5 s, aún no debe disparar
      const resultBefore = stepShipFire(baseState.ship, baseState.upgrades, [asteroid], null, 0.5);
      expect(resultBefore.newProjectiles.length).toBe(0);
      expect(resultBefore.events.length).toBe(0);
      expect(resultBefore.ship.fireTimer).toBeCloseTo(0.5, 3);

      // Con otros 0.5 s, alcanza el intervalo (1.0 s) y dispara
      const resultAfter = stepShipFire(resultBefore.ship, baseState.upgrades, [asteroid], null, 0.5);
      expect(resultAfter.newProjectiles.length).toBe(1);
      expect(resultAfter.newProjectiles[0].shooter).toBe('player');
      expect(resultAfter.newProjectiles[0].damage).toBe(getCannonDamage(0));
      expect(resultAfter.newProjectiles[0].speed).toBe(PROJECTILE_SPEED);
      expect(resultAfter.events.some((e) => e.type === 'shoot')).toBe(true);
      expect(resultAfter.events.some((e) => e.type === 'hit')).toBe(true);
    });

    it('R3-2: Disparo paralelo del dron de apoyo a 1.0 s con daño según nivel', () => {
      resetProjectileSequence();
      const baseState = createInitialState();
      const asteroid = createMockAsteroid('ast_1', 500, 300, 100);
      const droneLevel = 2; // 24 daño
      const upgradesWithDrone = {
        ...baseState.upgrades,
        supportDrone: droneLevel,
      };

      const droneDamage = getDroneDamage(droneLevel);
      expect(droneDamage).toBe(24);

      // Paso de 1.0 s para activar el disparo del dron
      const droneResult = stepDroneFire(
        baseState.ship,
        upgradesWithDrone,
        [asteroid],
        null,
        DRONE_FIRE_INTERVAL_SECONDS
      );

      expect(droneResult.newProjectiles.length).toBe(1);
      const droneProj = droneResult.newProjectiles[0];
      expect(droneProj.shooter).toBe('drone');
      expect(droneProj.damage).toBe(24);
      expect(droneProj.x).toBe(DRONE_POSITION.x);
      expect(droneProj.y).toBe(DRONE_POSITION.y);
      expect(droneResult.events.some((e) => e.type === 'shoot' && e.shooter === 'drone')).toBe(true);
    });

    it('R3-3: Dron inactivo en nivel 0 no dispara proyectiles ni genera eventos de combate', () => {
      const baseState = createInitialState();
      const asteroid = createMockAsteroid('ast_1', 500, 300, 100);

      const droneResult = stepDroneFire(
        baseState.ship,
        baseState.upgrades, // supportDrone: 0
        [asteroid],
        null,
        2.0
      );

      expect(droneResult.newProjectiles.length).toBe(0);
      expect(droneResult.events.length).toBe(0);
    });

    it('R3-4: Daño recibido es absorbido prioritariamente por el escudo antes que el casco', () => {
      const baseState = createInitialState();
      // Inicialmente: maxHull = 80, maxShield = 40
      expect(baseState.ship.currentShield).toBe(40);
      expect(baseState.ship.currentHull).toBe(80);

      // Impacto de 25 de daño: absorbido íntegramente por escudo
      const enemy = createMockEnemy('ene_1', 400, 300, 100, 25);
      const combatResult = stepEnemyCombat([enemy], baseState.ship, 2.0); // fireCooldown 2.0 s

      expect(combatResult.ship.currentShield).toBe(15); // 40 - 25 = 15
      expect(combatResult.ship.currentHull).toBe(80); // Casco intacto
      expect(combatResult.ship.shieldRegenCooldown).toBe(3.0);

      const hitEvent = combatResult.events.find((e) => e.type === 'player_hit');
      expect(hitEvent).toBeDefined();
      if (hitEvent && hitEvent.type === 'player_hit') {
        expect(hitEvent.shieldDamage).toBe(25);
        expect(hitEvent.hullDamage).toBe(0);
      }
    });

    it('R3-5: Daño excedente al escudo se absorbe directamente en el casco', () => {
      const baseState = createInitialState();
      // Escudo inicial 40, impacto de 60: 40 a escudo y 20 a casco
      const enemyHeavy = createMockEnemy('ene_heavy', 400, 300, 200, 60);
      const combatResult = stepEnemyCombat([enemyHeavy], baseState.ship, 2.0);

      expect(combatResult.ship.currentShield).toBe(0);
      expect(combatResult.ship.currentHull).toBe(60); // 80 - 20 = 60
      expect(combatResult.isDefeated).toBe(false);

      const hitEvent = combatResult.events.find((e) => e.type === 'player_hit');
      expect(hitEvent).toBeDefined();
      if (hitEvent && hitEvent.type === 'player_hit') {
        expect(hitEvent.shieldDamage).toBe(40);
        expect(hitEvent.hullDamage).toBe(20);
      }
    });

    it('R3-6: Escudo no regenera durante los 3.0 s posteriores al último impacto recibido', () => {
      const damagedShip: ShipState = {
        currentHull: 80,
        maxHull: 80,
        currentShield: 10,
        maxShield: 40,
        shieldRegenCooldown: 3.0,
        fireTimer: 0,
        droneFireTimer: 0,
      };

      // Avanzamos 2.0 segundos: cooldown pasa a 1.0 s y escudo sigue en 10
      const shipAfter2s = stepShieldRegen(damagedShip, 2.0);
      expect(shipAfter2s.shieldRegenCooldown).toBeCloseTo(1.0, 3);
      expect(shipAfter2s.currentShield).toBe(10);
    });

    it('R3-7: Escudo regenera al 20 % de su valor máximo por segundo una vez transcurridos 3.0 s', () => {
      const readyToRegenShip: ShipState = {
        currentHull: 80,
        maxHull: 80,
        currentShield: 10,
        maxShield: 40,
        shieldRegenCooldown: 0, // Tregua de 3.0 s ya cumplida
        fireTimer: 0,
        droneFireTimer: 0,
      };

      // 20 % de 40 = 8 puntos/s. En 1.5 s debe sumar 12 puntos -> 22
      const regeneratedShip = stepShieldRegen(readyToRegenShip, 1.5);
      expect(regeneratedShip.currentShield).toBeCloseTo(22, 2);

      // No debe sobrepasar el máximo
      const overRegen = stepShieldRegen(readyToRegenShip, 10.0);
      expect(overRegen.currentShield).toBe(40);
    });
  });
});
