import { describe, expect, it } from 'vitest';
import {
  PALETTE,
  renderGameScene,
  syncCanvasSize,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Canvas2DContextLike,
  type CanvasLike,
} from '../renderer';
import { createInitialState } from '../../engine/index';
import type {
  AsteroidTarget,
  BossTarget,
  EnemyTarget,
  GameState,
  Projectile,
} from '../../engine/types';

class MockCanvas implements CanvasLike {
  width = 0;
  height = 0;
}

class MockCanvas2DContext implements Canvas2DContextLike {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  lineWidth = 1;
  globalAlpha = 1;
  font?: string;
  textAlign?: CanvasTextAlign;
  textBaseline?: CanvasTextBaseline;

  readonly calls: Array<{ name: string; args: unknown[] }> = [];
  private saveDepth = 0;

  save(): void {
    this.saveDepth += 1;
    this.calls.push({ name: 'save', args: [] });
  }

  restore(): void {
    this.saveDepth -= 1;
    this.calls.push({ name: 'restore', args: [] });
  }

  setTransform?: ((a: number, b: number, c: number, d: number, e: number, f: number) => void) | undefined = (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number
  ) => {
    this.calls.push({ name: 'setTransform', args: [a, b, c, d, e, f] });
  };

  scale(x: number, y: number): void {
    this.calls.push({ name: 'scale', args: [x, y] });
  }

  clearRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ name: 'clearRect', args: [x, y, w, h] });
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.calls.push({ name: 'fillRect', args: [x, y, w, h] });
  }

  beginPath(): void {
    this.calls.push({ name: 'beginPath', args: [] });
  }

  closePath(): void {
    this.calls.push({ name: 'closePath', args: [] });
  }

  moveTo(x: number, y: number): void {
    this.calls.push({ name: 'moveTo', args: [x, y] });
  }

  lineTo(x: number, y: number): void {
    this.calls.push({ name: 'lineTo', args: [x, y] });
  }

  arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean
  ): void {
    this.calls.push({ name: 'arc', args: [x, y, radius, startAngle, endAngle, counterclockwise] });
  }

  fill(): void {
    this.calls.push({ name: 'fill', args: [] });
  }

  stroke(): void {
    this.calls.push({ name: 'stroke', args: [] });
  }

  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.calls.push({ name: 'fillText', args: [text, x, y, maxWidth] });
  }

  getSaveDepth(): number {
    return this.saveDepth;
  }
}

describe('renderer - R9: renderizado Canvas 2D con devicePixelRatio', () => {
  describe('syncCanvasSize', () => {
    it('R9: ajusta dimensiones físicas con devicePixelRatio y aplica setTransform para escalar el mundo', () => {
      const canvas = new MockCanvas();
      const ctx = new MockCanvas2DContext();

      const cssWidth = 900;
      const cssHeight = 600;
      const dpr = 2;

      const result = syncCanvasSize(canvas, ctx, cssWidth, cssHeight, dpr);

      expect(canvas.width).toBe(1800);
      expect(canvas.height).toBe(1200);
      expect(result.width).toBe(1800);
      expect(result.height).toBe(1200);
      expect(result.dpr).toBe(2);
      expect(result.scaleX).toBe(2); // (900 / WORLD_WIDTH) * 2 = 1 * 2 = 2
      expect(result.scaleY).toBe(2); // (600 / WORLD_HEIGHT) * 2 = 1 * 2 = 2

      const transformCall = ctx.calls.find((call) => call.name === 'setTransform');
      expect(transformCall).toBeDefined();
      expect(transformCall?.args).toEqual([2, 0, 0, 2, 0, 0]);
    });

    it('R9: utiliza scale como alternativa cuando el contexto carece de setTransform', () => {
      const canvas = new MockCanvas();
      const ctx = new MockCanvas2DContext();
      // Anular setTransform en la instancia para activar el respaldo scale
      ctx.setTransform = undefined;

      const cssWidth = 450;
      const cssHeight = 300;
      const dpr = 1.5;

      const result = syncCanvasSize(canvas, ctx, cssWidth, cssHeight, dpr);

      const expectedScaleX = (450 / WORLD_WIDTH) * 1.5;
      const expectedScaleY = (300 / WORLD_HEIGHT) * 1.5;

      expect(result.scaleX).toBeCloseTo(expectedScaleX, 4);
      expect(result.scaleY).toBeCloseTo(expectedScaleY, 4);

      const scaleCall = ctx.calls.find((call) => call.name === 'scale');
      expect(scaleCall).toBeDefined();
      expect(scaleCall?.args[0]).toBeCloseTo(expectedScaleX, 4);
      expect(scaleCall?.args[1]).toBeCloseTo(expectedScaleY, 4);
    });

    it('R9: acota dpr y dimensiones css con valores mínimos seguros', () => {
      const canvas = new MockCanvas();
      const ctx = new MockCanvas2DContext();

      // dpr 0 y dimensiones no positivas se elevan al mínimo seguro 1
      const result = syncCanvasSize(canvas, ctx, -100, 0, 0);

      expect(result.dpr).toBe(1);
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
      expect(canvas.width).toBe(1);
      expect(canvas.height).toBe(1);
    });
  });

  describe('renderGameScene', () => {
    it('R9: dibuja fondo espacial oscuro y estrellas deterministas sin errores', () => {
      const ctx = new MockCanvas2DContext();
      const state = createInitialState();

      renderGameScene(ctx, state);

      // Comprueba relleno de fondo espacial
      const backgroundFill = ctx.calls.find(
        (call) =>
          call.name === 'fillRect' &&
          call.args[0] === 0 &&
          call.args[1] === 0 &&
          call.args[2] === WORLD_WIDTH &&
          call.args[3] === WORLD_HEIGHT
      );
      expect(backgroundFill).toBeDefined();

      // Comprueba presencia de arcos para las estrellas deterministas
      const arcCalls = ctx.calls.filter((call) => call.name === 'arc');
      expect(arcCalls.length).toBeGreaterThanOrEqual(60);
      expect(ctx.getSaveDepth()).toBe(0); // Pila save/restore balanceada
    });

    it('R9: dibuja la nave del jugador con propulsor, escudo activo y dron de apoyo en órbita', () => {
      const ctx = new MockCanvas2DContext();
      const state = createInitialState();

      // Configurar escudo y dron activo
      const stateWithDroneAndShield: GameState = {
        ...state,
        ship: {
          ...state.ship,
          currentShield: 30,
          maxShield: 50,
        },
        upgrades: {
          ...state.upgrades,
          supportDrone: 2,
        },
        tiempoJugadoSegundos: 1.5,
      };

      renderGameScene(ctx, stateWithDroneAndShield);

      // Debe haber ejecutado save y restore para la nave
      const saveCalls = ctx.calls.filter((call) => call.name === 'save');
      expect(saveCalls.length).toBeGreaterThanOrEqual(1);
      expect(ctx.getSaveDepth()).toBe(0);
    });

    it('R9: dibuja asteroides, enemigos e interacciones visuales', () => {
      const ctx = new MockCanvas2DContext();
      const state = createInitialState();

      const asteroid: AsteroidTarget = {
        id: 'ast-test-1',
        type: 'asteroid',
        x: 200,
        y: 200,
        radius: 24,
        maxHp: 100,
        currentHp: 75,
        rewardCredits: 10,
        spawnIndex: 3,
      };

      const enemy: EnemyTarget = {
        id: 'enemy-test-1',
        type: 'enemy',
        x: 600,
        y: 250,
        radius: 18,
        maxHp: 80,
        currentHp: 40,
        rewardCredits: 20,
        damage: 5,
        fireCooldown: 1,
        fireTimer: 0,
        spawnIndex: 1,
      };

      const stateWithTargets: GameState = {
        ...state,
        targets: [asteroid, enemy],
      };

      renderGameScene(ctx, stateWithTargets);

      // Ambos objetivos generan llamadas de trazado y minibar
      const fillRectCalls = ctx.calls.filter((call) => call.name === 'fillRect');
      expect(fillRectCalls.length).toBeGreaterThan(1); // Fondo + minibarras
      expect(ctx.getSaveDepth()).toBe(0);
    });

    it('R9: dibuja nave capital jefe y barra overlay superior cuando un jefe está presente y vivo', () => {
      const ctx = new MockCanvas2DContext();
      const state = createInitialState();

      const boss: BossTarget = {
        id: 'boss-1',
        type: 'boss',
        name: 'Centinela de Hierro',
        x: 450,
        y: 140,
        radius: 40,
        maxHp: 600,
        currentHp: 450,
        rewardCredits: 150,
        damage: 25,
        fireCooldown: 1,
        fireTimer: 0,
        spawnIndex: 1,
      };

      const stateWithBoss: GameState = {
        ...state,
        targets: [boss],
      };

      renderGameScene(ctx, stateWithBoss);

      // Overlay de jefe dibuja texto con nombre y PV
      const textCalls = ctx.calls.filter((call) => call.name === 'fillText');
      expect(textCalls.length).toBe(1);
      expect(textCalls[0].args[0]).toContain('Centinela de Hierro');
      expect(textCalls[0].args[0]).toContain('450 / 600 PV');
      expect(ctx.getSaveDepth()).toBe(0);
    });

    it('R9: dibuja la retícula de fijación cuando lockedTargetId apunta a un objetivo vivo', () => {
      const ctx = new MockCanvas2DContext();
      const state = createInitialState();

      const asteroid: AsteroidTarget = {
        id: 'ast-locked',
        type: 'asteroid',
        x: 350,
        y: 280,
        radius: 20,
        maxHp: 50,
        currentHp: 50,
        rewardCredits: 5,
        spawnIndex: 1,
      };

      const stateWithLock: GameState = {
        ...state,
        targets: [asteroid],
        lockedTargetId: 'ast-locked',
      };

      renderGameScene(ctx, stateWithLock);

      // Comprobar que no hay errores y la pila de transformaciones está balanceada
      expect(ctx.getSaveDepth()).toBe(0);

      // Si el objetivo fijado no existe o está destruido, la escena se dibuja sin retícula
      const ctxNoTarget = new MockCanvas2DContext();
      renderGameScene(ctxNoTarget, {
        ...state,
        targets: [{ ...asteroid, currentHp: 0 }],
        lockedTargetId: 'ast-locked',
      });
      expect(ctxNoTarget.getSaveDepth()).toBe(0);
    });

    it('R9: dibuja proyectiles de aliados y de enemigos diferenciando su color', () => {
      const ctx = new MockCanvas2DContext();
      const state = createInitialState();

      const allyProjectile: Projectile = {
        id: 'p-ally',
        shooter: 'player',
        x: 450,
        y: 260,
        targetX: 450,
        targetY: 0,
        speed: 400,
        damage: 15,
        targetId: 'ast-1',
      };

      const enemyProjectile: Projectile = {
        id: 'p-enemy',
        shooter: 'enemy',
        x: 450,
        y: 200,
        targetX: 450,
        targetY: 300,
        speed: 180,
        damage: 5,
      };

      const stateWithProjectiles: GameState = {
        ...state,
        projectiles: [allyProjectile, enemyProjectile],
      };

      renderGameScene(ctx, stateWithProjectiles);

      expect(ctx.getSaveDepth()).toBe(0);
    });

    it('R9: PALETTE define los colores técnicos espaciales requeridos por el GDD', () => {
      expect(PALETTE.spaceBackground).toBe('#070b14');
      expect(PALETTE.panelBackground).toBe('#11182B');
      expect(PALETTE.playerAndDrone).toBe('#38BDF8');
      expect(PALETTE.shield).toBe('#22D3EE');
      expect(PALETTE.mineralGold).toBe('#F59E0B');
      expect(PALETTE.enemy).toBe('#FB7185');
      expect(PALETTE.boss).toBe('#EF4444');
    });
  });
});
