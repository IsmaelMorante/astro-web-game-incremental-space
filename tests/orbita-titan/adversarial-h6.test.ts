import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import reactRenderer from '@astrojs/react/server.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import pkg from '../../package.json';
import layoutRaw from '../../src/layouts/Layout.astro?raw';
import IndexPage from '../../src/pages/index.astro';
import orbitTitanGameRaw from '../../src/features/orbita-titan/OrbitTitanGame.tsx?raw';
import controlPanelRaw from '../../src/features/orbita-titan/components/ControlPanel.tsx?raw';
import {
  clearSaveData,
  exportSaveJson,
  loadSaveData,
  parseAndValidateSaveJson,
  persistSaveData,
  validateSaveData,
} from '../../src/features/orbita-titan/game/storage';
import {
  SAVE_STORAGE_KEY,
  createInitialSaveData,
} from '../../src/features/orbita-titan/game/types';

const EXCLUDED_DEPENDENCIES = [
  'express',
  'dotenv',
  '@google/genai',
  'tsx',
  'motion',
  '@vitejs/plugin-react',
  'autoprefixer',
  '@types/express',
] as const;

describe('Adversarial H6.1 — Dependencias excluidas y configuración', () => {
  it('package.json no declara ninguna dependencia excluida del prototipo anterior', () => {
    const typedPkg = pkg as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = {
      ...(typedPkg.dependencies ?? {}),
      ...(typedPkg.devDependencies ?? {}),
    };

    for (const excluded of EXCLUDED_DEPENDENCIES) {
      expect(allDeps).not.toHaveProperty(excluded);
    }
  });
});

describe('Adversarial H6.1 — Hidratación Astro client:only="react" sin SSR', () => {
  it('src/pages/index.astro monta OrbitTitanGame con client:only="react" y sin contenido SSR', async () => {
    const container = await AstroContainer.create();
    container.addServerRenderer({
      name: '@astrojs/react',
      renderer: reactRenderer,
    });
    container.addClientRenderer({
      name: '@astrojs/react',
      entrypoint: '@astrojs/react/client.js',
    });

    const html = await container.renderToString(IndexPage);

    expect(html).toContain('<astro-island');
    expect(html).toContain('client="only"');
    expect(html).toContain('OrbitTitanGame');
    // Sin SSR del componente React ni del DOM del juego
    expect(html).not.toContain('<main');
    expect(html).not.toContain('Iniciar misión');
    expect(html).not.toContain('Continuar partida');
  });
});

describe('Adversarial H6.1 — Layout y prevención de scroll doble', () => {
  it('src/layouts/Layout.astro no define resets globales sin capa ni overflow-y conflictivo en body', () => {
    expect(layoutRaw).toContain("import '../styles/orbita-titan.css';");
    expect(layoutRaw).not.toContain('<style is:global>');
    expect(layoutRaw).not.toContain('overflow-y-scroll');
    expect(layoutRaw).not.toContain('overflow-y-auto');
  });

  it('OrbitTitanGame y ControlPanel aíslan el viewport (100dvh + overflow-hidden) y limitan el scroll vertical al panel', () => {
    expect(orbitTitanGameRaw).toContain('h-[100dvh]');
    expect(orbitTitanGameRaw).toContain('overflow-hidden');
    expect(controlPanelRaw).toContain('overflow-y-auto overflow-x-hidden');
  });
});

describe('Adversarial H6.1 — storage.ts resiliencia ante corrupción, inglés, cuota y sin localStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no lanza excepción cuando window no está definido (SSR / Node)', () => {
    vi.stubGlobal('window', undefined);

    expect(() => loadSaveData()).not.toThrow();
    const loaded = loadSaveData();
    expect(loaded.hasExistingSave).toBe(false);
    expect(loaded.data.version).toBe(1);

    expect(() => persistSaveData(createInitialSaveData())).not.toThrow();
    expect(() => clearSaveData()).not.toThrow();
  });

  it('no lanza excepción cuando acceder a window.localStorage lanza SecurityError', () => {
    const fakeWindow = {};
    Object.defineProperty(fakeWindow, 'localStorage', {
      get() {
        throw new DOMException('Blocked by sandbox', 'SecurityError');
      },
    });
    vi.stubGlobal('window', fakeWindow);

    expect(() => loadSaveData()).not.toThrow();
    expect(loadSaveData().hasExistingSave).toBe(false);
    expect(() => persistSaveData(createInitialSaveData())).not.toThrow();
    expect(() => clearSaveData()).not.toThrow();
  });

  it('no lanza excepción cuando window.localStorage es null o getItem/setItem/removeItem lanzan error', () => {
    vi.stubGlobal('window', { localStorage: null });
    expect(() => loadSaveData()).not.toThrow();
    expect(loadSaveData().hasExistingSave).toBe(false);
    expect(() => persistSaveData(createInitialSaveData())).not.toThrow();
    expect(() => clearSaveData()).not.toThrow();

    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new DOMException('Blocked', 'SecurityError');
        },
        setItem: () => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        },
        removeItem: () => {
          throw new DOMException('Blocked', 'SecurityError');
        },
      },
    });

    expect(() => loadSaveData()).not.toThrow();
    expect(loadSaveData().hasExistingSave).toBe(false);
    expect(() => persistSaveData(createInitialSaveData())).not.toThrow();
    expect(() => clearSaveData()).not.toThrow();
  });

  it('rechaza payloads corruptos, fuera de rango y prototype pollution sin lanzar excepciones', () => {
    const corruptInputs = [
      '',
      '   ',
      '{json-truncado',
      'null',
      '[]',
      '123',
      '"texto"',
      'true',
      '{"__proto__":{"polluted":true},"version":1}',
      '{"constructor":{"prototype":{"polluted":true}},"version":1}',
    ];

    for (const raw of corruptInputs) {
      expect(parseAndValidateSaveJson(raw)).toBeNull();
    }
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();

    const base = createInitialSaveData();
    expect(validateSaveData({ ...base, creditos: Number.NaN })).toBeNull();
    expect(validateSaveData({ ...base, creditos: Number.POSITIVE_INFINITY })).toBeNull();
    expect(validateSaveData({ ...base, creditos: -1 })).toBeNull();
    expect(validateSaveData({ ...base, planetaActual: 3, planetasDesbloqueados: 1 })).toBeNull();
    expect(validateSaveData({ ...base, rango: 0 })).toBeNull();
    expect(validateSaveData({ ...base, mejoras: { ...base.mejoras, danoCanon: 999 } })).toBeNull();
    expect(validateSaveData({ ...base, estadisticas: { ...base.estadisticas, mejorDps: -5 } })).toBeNull();
  });

  it('maneja campos en inglés del prototipo anterior sin lanzar excepciones no capturadas', () => {
    const legacyPrototypeSave = {
      version: 1,
      creditos: 1500,
      planetaActual: 2,
      planetasDesbloqueados: 2,
      objetivosPorPlaneta: { '1': 25, '2': 10, '3': 0, '4': 0 },
      bodega: { units: 3, value: 45 },
      mejoras: {
        cannonDamage: 4,
        fireRate: 2,
        hullShield: 1,
        cargoCapacity: 2,
        supportDrone: 1,
        autoSell: false,
      },
      silencio: false,
      muted: false,
      tiempoJugadoSegundos: 120,
      estadisticas: {
        targetsDestroyed: 35,
        bossesDefeated: 1,
        totalCreditsEarned: 2000,
      },
      fleet: { interceptor: 1, corvette: 0, frigate: 0 },
      overclockLevel: 0,
    };

    const fullEnglishSave = {
      version: 1,
      credits: 900,
      currentPlanet: 2,
      unlockedPlanets: 2,
      planetObjectives: { '1': 25, '2': 5, '3': 0, '4': 0 },
      cargo: { units: 2, value: 30 },
      upgrades: {
        cannonDamage: 2,
        fireRate: 1,
        hullShield: 1,
        cargoCapacity: 1,
        supportDrone: 0,
        autoSell: false,
      },
      muted: true,
      timePlayedSeconds: 90,
      stats: {
        targetsDestroyed: 30,
        bossesDefeated: 1,
        totalCreditsEarned: 1100,
      },
    };

    for (const payload of [legacyPrototypeSave, fullEnglishSave]) {
      const store = new Map<string, string>([[SAVE_STORAGE_KEY, JSON.stringify(payload)]]);
      vi.stubGlobal('window', {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
          removeItem: (k: string) => store.delete(k),
        },
      });

      expect(() => loadSaveData()).not.toThrow();
      const loaded = loadSaveData();
      expect(loaded.data.version).toBe(1);
    }
  });

  it('exportSaveJson y parseAndValidateSaveJson realizan round-trip fiel', () => {
    const initial = createInitialSaveData();
    initial.creditos = 420;
    initial.nucleos = 3;
    const json = exportSaveJson(initial);
    const parsed = parseAndValidateSaveJson(json);
    expect(parsed).toEqual(initial);
  });
});
