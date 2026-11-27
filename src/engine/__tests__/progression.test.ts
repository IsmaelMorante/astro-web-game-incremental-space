import { describe, expect, it } from 'vitest';
import {
  calculateTotalDps,
  canChallengeCurrentBoss,
  canPurchaseUpgrade,
  challengeBoss,
  collectLoot,
  createInitialState,
  dismissVictoryOverlay,
  getCannonDamage,
  getCargoCapacity,
  getDroneDamage,
  getFireRate,
  getNextUpgradeCost,
  isCargoFull,
  purchaseUpgrade,
  resetGameState,
  sellAllCargo,
  stepSimulation,
  travelToPlanet,
} from '../index';
import type { GameState } from '../types';

describe('Motor de progresión, economía y simulación (R4, R5, R6, R7, R8)', () => {
  it('[R6] bodega llena frena la recolección emitiendo cargo_full y descartando excedente', () => {
    let state = createInitialState(); // maxCapacity: 10
    expect(getCargoCapacity(0)).toBe(10);
    expect(state.cargo.maxCapacity).toBe(10);
    expect(isCargoFull(state)).toBe(false);

    // Recolectar 8 minerales de 10 créditos cada uno
    const step1 = collectLoot(state, 8, 80);
    state = step1.state;
    expect(state.cargo.units).toBe(8);
    expect(state.cargo.value).toBe(80);
    expect(step1.events.length).toBe(0);
    expect(isCargoFull(state)).toBe(false);

    // Recolectar 4 unidades de 10 créditos cada una: solo caben 2, las otras 2 se descartan
    const step2 = collectLoot(state, 4, 40);
    state = step2.state;
    expect(state.cargo.units).toBe(10);
    expect(state.cargo.value).toBe(100);
    expect(isCargoFull(state)).toBe(true);
    expect(step2.events).toEqual([
      {
        type: 'cargo_full',
        discardedResourceValue: 20,
      },
    ]);

    // Recolectar con bodega llena (10/10): frena completamente y descarta todo
    const step3 = collectLoot(state, 1, 24);
    expect(step3.state.cargo.units).toBe(10);
    expect(step3.state.cargo.value).toBe(100);
    expect(step3.events).toEqual([
      {
        type: 'cargo_full',
        discardedResourceValue: 24,
      },
    ]);
  });

  it('[R6] venta manual con sellAllCargo liquida bodega a créditos e incrementa estadísticas', () => {
    let state = createInitialState();
    state = {
      ...state,
      credits: 50,
      cargo: { units: 5, value: 120, maxCapacity: 10 },
    };

    // Venta con carga disponible
    const sellResult = sellAllCargo(state);
    expect(sellResult.state.credits).toBe(170); // 50 + 120
    expect(sellResult.state.cargo.units).toBe(0);
    expect(sellResult.state.cargo.value).toBe(0);
    expect(sellResult.state.stats.totalCreditsEarned).toBe(120);
    expect(sellResult.events).toEqual([
      {
        type: 'cargo_sold',
        unitsSold: 5,
        creditsEarned: 120,
      },
    ]);

    // Venta con bodega vacía no altera estado ni emite eventos
    const emptySell = sellAllCargo(sellResult.state);
    expect(emptySell.state.credits).toBe(170);
    expect(emptySell.events.length).toBe(0);
  });

  it('[R6] desbloqueo de autoventa liquida bodega previa y vende automáticamente botines futuros', () => {
    let state = createInitialState();
    state = {
      ...state,
      credits: 500,
      cargo: { units: 6, value: 90, maxCapacity: 10 },
    };

    // Compra de autoventa (coste 500 cr): consume 500 cr y liquida inmediatamente la bodega (90 cr)
    const purchaseResult = purchaseUpgrade(state, 'autoSell');
    state = purchaseResult.state;
    expect(state.upgrades.autoSell).toBe(true);
    expect(state.credits).toBe(90); // 500 - 500 + 90
    expect(state.cargo.units).toBe(0);
    expect(state.cargo.value).toBe(0);
    expect(state.stats.totalCreditsEarned).toBe(90);
    expect(purchaseResult.events.some((e) => e.type === 'upgrade_purchased')).toBe(true);
    expect(purchaseResult.events.some((e) => e.type === 'cargo_sold')).toBe(true);

    // Botín futuro con autoventa activa: va directo a créditos y no ocupa bodega
    const futureLoot = collectLoot(state, 1, 54);
    expect(futureLoot.state.credits).toBe(144); // 90 + 54
    expect(futureLoot.state.cargo.units).toBe(0);
    expect(futureLoot.state.stats.totalCreditsEarned).toBe(144);
    expect(futureLoot.events).toEqual([
      {
        type: 'cargo_sold',
        unitsSold: 1,
        creditsEarned: 54,
      },
    ]);
  });

  it('[R7] compra y efecto inmediato de las 5 mejoras lineales y topes máximos', () => {
    let state = createInitialState();
    state = { ...state, credits: 10000 };

    // 1. Daño de cañón (base 25 + 25*nivel, efecto 10 + 5*nivel, tope 20)
    expect(getCannonDamage(0)).toBe(10);
    expect(getNextUpgradeCost(state, 'cannonDamage')).toBe(25);
    state = purchaseUpgrade(state, 'cannonDamage').state;
    expect(state.upgrades.cannonDamage).toBe(1);
    expect(getCannonDamage(1)).toBe(15);
    expect(getNextUpgradeCost(state, 'cannonDamage')).toBe(50);

    // 2. Cadencia (base 30 + 35*nivel, efecto 1.0 + 0.25*nivel, tope 15)
    expect(getFireRate(0)).toBe(1.0);
    expect(getNextUpgradeCost(state, 'fireRate')).toBe(30);
    state = purchaseUpgrade(state, 'fireRate').state;
    expect(state.upgrades.fireRate).toBe(1);
    expect(getFireRate(1)).toBe(1.25);
    expect(getNextUpgradeCost(state, 'fireRate')).toBe(65);

    // 3. Casco y Escudo (base 35 + 30*nivel, efecto 80+25*n / 40+20*n, tope 15)
    expect(state.ship.maxHull).toBe(80);
    expect(state.ship.maxShield).toBe(40);
    state = purchaseUpgrade(state, 'hullShield').state;
    expect(state.upgrades.hullShield).toBe(1);
    expect(state.ship.maxHull).toBe(105);
    expect(state.ship.maxShield).toBe(60);
    expect(state.ship.currentHull).toBe(105);
    expect(state.ship.currentShield).toBe(60);

    // 4. Capacidad de bodega (base 30 + 25*nivel, efecto 10 + 5*nivel, tope 10)
    expect(state.cargo.maxCapacity).toBe(10);
    state = purchaseUpgrade(state, 'cargoCapacity').state;
    expect(state.upgrades.cargoCapacity).toBe(1);
    expect(state.cargo.maxCapacity).toBe(15);

    // 5. Dron de apoyo (base 60 + 60*nivel, efecto 12*nivel, tope 10)
    expect(getDroneDamage(0)).toBe(0);
    state = purchaseUpgrade(state, 'supportDrone').state;
    expect(state.upgrades.supportDrone).toBe(1);
    expect(getDroneDamage(1)).toBe(12);

    // Validación de tope máximo: cuando alcanza el tope, coste es null y no permite comprar
    const cappedState: GameState = {
      ...state,
      upgrades: {
        ...state.upgrades,
        cannonDamage: 20,
        autoSell: true,
      },
    };
    expect(getNextUpgradeCost(cappedState, 'cannonDamage')).toBeNull();
    expect(canPurchaseUpgrade(cappedState, 'cannonDamage')).toBe(false);
    expect(purchaseUpgrade(cappedState, 'cannonDamage').state).toBe(cappedState);

    expect(getNextUpgradeCost(cappedState, 'autoSell')).toBeNull();
    expect(canPurchaseUpgrade(cappedState, 'autoSell')).toBe(false);

    // Sin fondos suficientes: compra rechazada
    const brokeState: GameState = { ...state, credits: 0 };
    expect(canPurchaseUpgrade(brokeState, 'cannonDamage')).toBe(false);
    expect(purchaseUpgrade(brokeState, 'cannonDamage').state).toBe(brokeState);
  });

  it('[R4, R8] activación de jefe y derrota con reparación al 100 %, conservación y reinicio', () => {
    let state = resetGameState();
    expect(canChallengeCurrentBoss(state)).toBe(false);

    // Simula alcanzar el umbral de 25 objetivos en Planeta 1
    state = {
      ...state,
      objetivosPorPlaneta: { ...state.objetivosPorPlaneta, 1: 25 },
      credits: 400,
      cargo: { units: 5, value: 50, maxCapacity: 15 },
    };
    expect(canChallengeCurrentBoss(state)).toBe(true);

    // Desafiar al jefe: retira objetivos normales y genera el jefe
    const challengeResult = challengeBoss(state);
    state = challengeResult.state;
    expect(state.bossActive).toBe(true);
    expect(state.bossTargetId).toBeDefined();
    expect(state.targets.length).toBe(1);
    expect(state.targets[0].type).toBe('boss');
    expect(challengeResult.events.some((e) => e.type === 'boss_spawned')).toBe(true);

    // Configurar temporizador del jefe listo para disparar e impacto letal a la nave
    const bossTarget = state.targets[0];
    if (bossTarget.type !== 'boss') {
      throw new Error('Se esperaba un objetivo de tipo boss');
    }
    state = {
      ...state,
      targets: [{ ...bossTarget, fireTimer: bossTarget.fireCooldown }],
      ship: {
        ...state.ship,
        currentHull: 1,
        currentShield: 0,
      },
    };

    // Un tick de simulación donde el jefe impacta y abate a la nave
    const stepResult = stepSimulation(state, 0.1);
    state = stepResult.state;

    // Comprobaciones tras derrota según GDD sección 2:
    // 1. Evento de derrota emitido
    expect(stepResult.events.some((e) => e.type === 'player_defeated')).toBe(true);
    // 2. Nave reparada al 100 % de casco y escudo
    expect(state.ship.currentHull).toBe(state.ship.maxHull);
    expect(state.ship.currentShield).toBe(state.ship.maxShield);
    // 3. Conserva créditos, mejoras y bodega intactos
    expect(state.credits).toBe(400);
    expect(state.cargo.units).toBe(5);
    expect(state.cargo.value).toBe(50);
    // 4. El combate contra el jefe se cancela y se reinicia
    expect(state.bossActive).toBe(false);
    expect(state.bossTargetId).toBeNull();
    // 5. Los objetivos normales reaparecen
    expect(state.targets.length).toBeGreaterThan(0);
    expect(state.targets.every((t) => t.type !== 'boss')).toBe(true);
    // 6. El umbral sigue cumplido para permitir reintento inmediato
    expect(state.objetivosPorPlaneta[1]).toBe(25);
    expect(canChallengeCurrentBoss(state)).toBe(true);
  });

  it('[R4] desbloqueo secuencial de los 4 planetas y viaje bidireccional', () => {
    let state = resetGameState();
    expect(state.planetActual).toBe(1);
    expect(state.planetasDesbloqueados).toBe(1);

    // Intento de viajar a Planeta 2 bloqueado: no tiene efecto
    state = travelToPlanet(state, 2);
    expect(state.planetActual).toBe(1);

    // Desbloqueo progresivo simulado: vencer jefe 1 desbloquea planeta 2
    state = { ...state, planetasDesbloqueados: 2 };
    state = travelToPlanet(state, 2);
    expect(state.planetActual).toBe(2);
    expect(state.targets.length).toBeGreaterThan(0);

    // Viaje bidireccional de vuelta a Planeta 1
    state = travelToPlanet(state, 1);
    expect(state.planetActual).toBe(1);

    // Desbloqueo sucesivo de Planeta 3 y Planeta 4
    state = { ...state, planetasDesbloqueados: 4 };
    state = travelToPlanet(state, 4);
    expect(state.planetActual).toBe(4);
    state = travelToPlanet(state, 3);
    expect(state.planetActual).toBe(3);
  });

  it('[R8] victoria emitida al derrotar al cuarto jefe en Núcleo Estelar', () => {
    let state = resetGameState();
    state = {
      ...state,
      planetActual: 4,
      planetasDesbloqueados: 4,
      objetivosPorPlaneta: { ...state.objetivosPorPlaneta, 4: 50 },
    };

    // Desafiar al Guardián Solar (jefe 4)
    state = challengeBoss(state).state;
    expect(state.bossActive).toBe(true);
    const boss = state.targets[0];
    expect(boss.type).toBe('boss');

    // Dejar al jefe con 5 PV y la nave lista para disparar con alto daño
    state = {
      ...state,
      targets: [{ ...boss, currentHp: 5 }],
      ship: { ...state.ship, fireTimer: 1.0 },
      upgrades: { ...state.upgrades, cannonDamage: 20 },
    };

    const simResult = stepSimulation(state, 0.1);
    expect(simResult.events.some((e) => e.type === 'boss_defeated')).toBe(true);
    expect(simResult.events.some((e) => e.type === 'victory')).toBe(true);
    expect(simResult.state.bossActive).toBe(false);

    // Descartar superposición de victoria
    const postVictoryState = dismissVictoryOverlay(simResult.state);
    expect(postVictoryState.victoryAcknowledged).toBe(true);
  });

  it('[R5] simulación determinista de una partida activa completa dura entre 600 y 900 s', () => {
    let state = resetGameState();
    const dt = 0.1;
    let victoryEventEmitted = false;
    let simulatedSeconds = 0;

    // Niveles objetivo por planeta alineados con la curva del GDD Sección 5:
    // P1: 4 / 3 / 2 / 1 / 1 / 0
    // P2: 7 / 6 / 5 / 2 / 2 / 1
    // P3: 12 / 10 / 10 / 2 / 6 / 1
    // P4: 18 / 14 / 14 / 2 / 9 / 1
    const planetTargetCaps = {
      1: { cannonDamage: 4, fireRate: 3, hullShield: 2, cargoCapacity: 1, supportDrone: 1 },
      2: { cannonDamage: 7, fireRate: 6, hullShield: 5, cargoCapacity: 2, supportDrone: 2 },
      3: { cannonDamage: 12, fireRate: 10, hullShield: 10, cargoCapacity: 2, supportDrone: 6 },
      4: { cannonDamage: 18, fireRate: 14, hullShield: 14, cargoCapacity: 2, supportDrone: 9 },
    };

    const bossMinDps = {
      1: 35,
      2: 100,
      3: 250,
      4: 480,
    };

    while (!victoryEventEmitted && simulatedSeconds < 1200) {
      // Acción 1: Viajar al planeta superior recién desbloqueado
      if (state.planetasDesbloqueados > state.planetActual && !state.bossActive) {
        state = travelToPlanet(state, state.planetasDesbloqueados);
      }

      // Acción 2: Venta manual antes de autoventa
      if (!state.upgrades.autoSell && state.cargo.units > 0) {
        if (state.cargo.units >= state.cargo.maxCapacity) {
          state = sellAllCargo(state).state;
        } else {
          const availableFunds = state.credits + state.cargo.value;
          if (availableFunds >= 500) {
            state = sellAllCargo(state).state;
          } else {
            const nextCannon = getNextUpgradeCost(state, 'cannonDamage') ?? Infinity;
            const nextRate = getNextUpgradeCost(state, 'fireRate') ?? Infinity;
            const nextDrone = getNextUpgradeCost(state, 'supportDrone') ?? Infinity;
            const minCost = Math.min(nextCannon, nextRate, nextDrone);
            if (availableFunds >= minCost && state.credits < minCost) {
              state = sellAllCargo(state).state;
            }
          }
        }
      }

      // Acción 3: Desbloqueo prioritario de autoventa a los 500 cr
      if (!state.upgrades.autoSell && state.credits >= 500) {
        state = purchaseUpgrade(state, 'autoSell').state;
      }

      // Acción 4: Compra activa de mejoras priorizando DPS
      const targets = planetTargetCaps[state.planetActual];
      const dpsFirstKeys: (keyof typeof targets)[] = [
        'cannonDamage',
        'fireRate',
        'supportDrone',
        'hullShield',
        'cargoCapacity',
      ];

      for (const key of dpsFirstKeys) {
        if (!state.upgrades.autoSell && state.credits >= 400) {
          continue; // Reservar para autoventa
        }
        if (state.upgrades[key] < targets[key] && canPurchaseUpgrade(state, key)) {
          state = purchaseUpgrade(state, key).state;
        }
      }

      // Con autoventa activa, comprar mejoras hacia los topes finales de P4
      if (state.upgrades.autoSell) {
        const p4Targets = planetTargetCaps[4];
        const dpsPriority: ('cannonDamage' | 'fireRate' | 'supportDrone' | 'hullShield')[] = [
          'cannonDamage',
          'fireRate',
          'supportDrone',
          'hullShield',
        ];

        for (const key of dpsPriority) {
          if (state.upgrades[key] < p4Targets[key] && canPurchaseUpgrade(state, key)) {
            state = purchaseUpgrade(state, key).state;
          }
        }
      }

      // Acción 5: Desafiar al jefe cuando se cumpla el umbral y el DPS/casco sean seguros
      if (canChallengeCurrentBoss(state)) {
        const dps = calculateTotalDps(
          state.upgrades.cannonDamage,
          state.upgrades.fireRate,
          state.upgrades.supportDrone
        );
        const reqDps = bossMinDps[state.planetActual];
        const reqHull = targets.hullShield;

        if (dps >= reqDps && state.upgrades.hullShield >= reqHull) {
          state = challengeBoss(state).state;
        }
      }

      const res = stepSimulation(state, dt);
      state = res.state;
      simulatedSeconds = state.tiempoJugadoSegundos;

      for (const ev of res.events) {
        if (ev.type === 'victory') {
          victoryEventEmitted = true;
          break;
        }
      }
    }

    expect(victoryEventEmitted).toBe(true);
    // Verificación obligatoria: duración simulada entre 600 y 900 segundos (10 a 15 min)
    expect(simulatedSeconds).toBeGreaterThanOrEqual(600);
    expect(simulatedSeconds).toBeLessThanOrEqual(900);
  });
});
