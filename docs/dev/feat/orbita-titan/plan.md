id: plan-orbita-titan
rama: feat/orbita-titan
requisitos: docs/dev/feat/orbita-titan/requisitos.md

## Plan de hitos

### H1 Configuración base de Astro 5, React y Tailwind CSS v4
- Estado: hecho
- Traza: R1, R5
- Criterio: `pnpm check` termina sin errores.
- Objetivo: configurar Astro 5 y TypeScript para compilar islas React y hojas de estilo en cascada (CSS) con Tailwind v4.
- Frontera: la compilación del motor y los componentes depende de esta configuración; este hito se verifica solo antes de migrar código.
- Depende de: ninguno · Cota: 2 ficheros, 1 subhito

#### H1.1 Configuración de Astro y TypeScript (frontend)
- GOAL: activar `@astrojs/react` y `@tailwindcss/vite` en Astro y JavaScript XML (JSX) en TypeScript.
- OUTCOME: R1, R5.
- SCOPE: `astro.config.mjs`, `tsconfig.json`.
- CONSTRAINTS: P1-P8. No modificar `package.json`. No añadir dependencias descartadas (`express`, `dotenv`, `@google/genai`, `tsx`, `motion`, `@vitejs/plugin-react`, `autoprefixer`, `@types/express`).
- ACCEPTANCE: `astro.config.mjs` usa `vite: { plugins: [tailwindcss()] }` e `integrations: [react()]`. `tsconfig.json` declara `"jsx": "react-jsx"` y `"jsxImportSource": "react"`.
- VERIFY: `pnpm check`

### H2 Integración del motor puro de Órbita Titán
- Estado: hecho
- Traza: R2, R6
- Criterio: `pnpm check` valida los 8 módulos de `src/features/orbita-titan/game/`.
- Objetivo: migrar el motor de simulación, fórmulas, entidades, partículas, audio, renderizado y persistencia al proyecto Astro.
- Frontera: los componentes React y las pruebas unitarias dependen del motor puro; aislar estos 8 ficheros respeta la cota de tamaño.
- Depende de: H1 · Cota: 8 ficheros, 1 subhito

#### H2.1 Migración del núcleo puro (frontend)
- GOAL: copiar el motor desde `D:\Proyectos\orbita-titan\src\game\` a `src/features/orbita-titan/game/`.
- OUTCOME: R2, R6.
- SCOPE: `src/features/orbita-titan/game/types.ts`, `src/features/orbita-titan/game/formulas.ts`, `src/features/orbita-titan/game/particles.ts`, `src/features/orbita-titan/game/audio.ts`, `src/features/orbita-titan/game/storage.ts`, `src/features/orbita-titan/game/entities.ts`, `src/features/orbita-titan/game/renderer.ts`, `src/features/orbita-titan/game/engine.ts`.
- CONSTRAINTS: P1-P8. Depende de: H1.1. Conservar la clave `astro-incremental-save-v1` y la validación segura en `validateSaveData()`. Permitir ajustes mínimos de tipado estricto si `astro check` los exige. No borrar archivos del prototipo anterior.
- ACCEPTANCE: los 8 módulos compilan en modo estricto dentro de `src/features/orbita-titan/game/`.
- VERIFY: `pnpm check`

### H3 Migración de componentes React de Órbita Titán
- Estado: hecho
- Traza: R2, R3, R6
- Criterio: `pnpm check` valida los 6 componentes React de `src/features/orbita-titan/`.
- Objetivo: migrar las vistas React y encapsular `App.tsx` como `OrbitTitanGame.tsx`.
- Frontera: los componentes dependen del motor (H2) y se separan del layout Astro (H4) para cumplir la cota de 8 ficheros por hito.
- Depende de: H2 · Cota: 6 ficheros, 1 subhito

#### H3.1 Migración de componentes y contenedor principal (frontend)
- GOAL: copiar `D:\Proyectos\orbita-titan\src\components\*` y `App.tsx` como `OrbitTitanGame.tsx`.
- OUTCOME: R2, R3, R6.
- SCOPE: `src/features/orbita-titan/OrbitTitanGame.tsx`, `src/features/orbita-titan/components/TitleScreen.tsx`, `src/features/orbita-titan/components/ControlPanel.tsx`, `src/features/orbita-titan/components/TechTreeTab.tsx`, `src/features/orbita-titan/components/TalentDraftModal.tsx`, `src/features/orbita-titan/components/Modals.tsx`.
- CONSTRAINTS: P1-P8. Depende de: H2.1. Ajustar importaciones relativas hacia `./game/*` y `./components/*`. Permitir ajustes mínimos de tipado estricto si `astro check` los exige. Exportar `export function OrbitTitanGame()` en `src/features/orbita-titan/OrbitTitanGame.tsx`. No borrar archivos del prototipo anterior.
- ACCEPTANCE: `OrbitTitanGame.tsx` exporta el componente principal y todos los componentes pasan el chequeo estricto de tipos.
- VERIFY: `pnpm check`

### H4 Estilos Tailwind CSS v4, fuentes y montaje en portada
- Estado: hecho
- Traza: R3, R4, R6
- Criterio: `pnpm build` genera el sitio estático con `OrbitTitanGame` en `src/pages/index.astro`.
- Objetivo: integrar estilos Tailwind CSS v4, cargar tipografías y montar el juego en la portada solo en cliente.
- Frontera: la portada y el layout dependen de `OrbitTitanGame.tsx` (H3) y agrupan los 3 ficheros de presentación global.
- Depende de: H3 · Cota: 3 ficheros, 1 subhito

#### H4.1 Estilos globales, fuentes y página principal (frontend)
- GOAL: migrar `D:\Proyectos\orbita-titan\src\index.css` a `src/styles/orbita-titan.css`, actualizar `src/layouts/Layout.astro` y montar `OrbitTitanGame` en `src/pages/index.astro`.
- OUTCOME: R3, R4, R6.
- SCOPE: `src/styles/orbita-titan.css`, `src/layouts/Layout.astro`, `src/pages/index.astro`.
- CONSTRAINTS: P1-P8. Depende de: H3.1. Importar `../styles/orbita-titan.css` desde `src/layouts/Layout.astro`. Adaptar el selector `#root` a Astro (`html, body`). Limpiar estilos sin capa en `Layout.astro`. Montar `<OrbitTitanGame client:only="react" />` en `src/pages/index.astro`. Cargar `Oxanium`, `DM Sans` y `JetBrains Mono` desde Google Fonts.
- ACCEPTANCE: `pnpm build` termina sin errores y la portada monta `OrbitTitanGame` solo en cliente con estilos Tailwind CSS v4 intactos. La verificación visual en navegador (hidratación cliente, fuentes Google y ausencia de scroll doble en `>=1024px` y `360px`) se valida manualmente en el GUIDE del hito al no existir runner de navegador en `package.json`.
- VERIFY: `pnpm build`

### H5 Pruebas unitarias del motor (qa)
- Estado: hecho
- Traza: R2, R6
- Criterio: `pnpm test` supera las pruebas existentes y las de `tests/orbita-titan/`.
- Objetivo: cubrir el motor con pruebas unitarias ejecutadas con Vitest en entorno Node.
- Frontera: las pruebas requieren el juego integrado (H4) y se limitan a la suite unitaria del motor.
- Depende de: H4 · Cota: 3 ficheros, 1 subhito

#### H5.1 Pruebas unitarias con mocks de Node (qa)
- GOAL: escribir pruebas unitarias para fórmulas, persistencia y ciclo del motor en `tests/orbita-titan/`.
- OUTCOME: R2, R6.
- SCOPE: `tests/orbita-titan/formulas.test.ts`, `tests/orbita-titan/storage.test.ts`, `tests/orbita-titan/engine.test.ts`.
- CONSTRAINTS: P1-P8. Depende de: H4.1. Usar mocks de `window`/`localStorage` en `tests/orbita-titan/storage.test.ts` (Vitest corre en Node). No modificar código fuente ni pruebas existentes.
- ACCEPTANCE: las pruebas verifican fórmulas de daño y costes, reinicio seguro de guardados antiguos en `validateSaveData()` y avance de `SpaceGameEngine`.
- VERIFY: `pnpm test`

### H6 Verificación adversarial L2 (qa)
- Estado: hecho
- Traza: R1, R2, R3, R4, R5, R6
- Criterio: `pnpm test` supera la auditoría adversarial.
- Objetivo: ejecutar `MODE: ADVERSARIAL` sobre los archivos de la integración.
- Frontera: la auditoría adversarial audita el diff completo de la rama.
- Depende de: H5 · Cota: 10 ficheros, 1 subhito

#### H6.1 Auditoría adversarial L2 (qa)
- GOAL: ejecutar `MODE: ADVERSARIAL` sobre la integración completa.
- OUTCOME: R1, R2, R3, R4, R5, R6.
- SCOPE: `astro.config.mjs`, `tsconfig.json`, `package.json`, `src/layouts/Layout.astro`, `src/pages/index.astro`, `src/styles/orbita-titan.css`, `tests/orbita-titan/formulas.test.ts`, `tests/orbita-titan/storage.test.ts`, `tests/orbita-titan/engine.test.ts`.
- CONSTRAINTS: P1-P8. Depende de: H5.1. Solo lectura sobre código fuente. Comprobar hidratación cliente, persistencia, ausencia de dependencias descartadas y ausencia de scroll doble.
- ACCEPTANCE: cero hallazgos bloqueantes en la verificación adversarial.
- VERIFY: `pnpm test`

### H7 Revisión de calidad y arquitectura del diff (L2)
- Estado: hecho
- Traza: R1, R2, R3, R4, R5, R6
- Criterio: `reviewer` aprueba el diff completo sin bloqueos.
- Objetivo: auditar el cumplimiento de requisitos, tipado, modularidad y conservación de archivos antiguos.
- Frontera: la revisión L2 requiere el código y las pruebas cerradas en H6 y usa un propietario independiente.
- Depende de: H6 · Cota: 10 ficheros, 1 subhito

#### H7.1 Revisión del diff integrado (reviewer)
- GOAL: revisar el diff completo de la rama frente al plan y requisitos.
- OUTCOME: R1, R2, R3, R4, R5, R6.
- SCOPE: `astro.config.mjs`, `tsconfig.json`, `package.json`, `src/layouts/Layout.astro`, `src/pages/index.astro`, `src/styles/orbita-titan.css`, `tests/orbita-titan/formulas.test.ts`, `tests/orbita-titan/storage.test.ts`, `tests/orbita-titan/engine.test.ts`.
- CONSTRAINTS: P1-P8. Depende de: H6.1. Solo lectura. Verificar que los archivos previos en `src/engine/` y `src/components/*.astro` no se han borrado.
- ACCEPTANCE: informe `DONE` sin defectos críticos ni desvíos respecto a los requisitos.
- VERIFY: `pnpm build`

## Matriz de trazabilidad

| R-id | hito | subhito | prueba (qa) | paso del GUIDE |
|---|---|---|---|---|
| R1 | H1, H6, H7 | H1.1, H6.1, H7.1 | `pnpm check` | Comprobar `astro.config.mjs` y `tsconfig.json` |
| R2 | H2, H3, H5, H6, H7 | H2.1, H3.1, H5.1, H6.1, H7.1 | `tests/orbita-titan/storage.test.ts`, `tests/orbita-titan/engine.test.ts` | Abrir el juego y verificar guardado en `localStorage` |
| R3 | H3, H4, H6, H7 | H3.1, H4.1, H6.1, H7.1 | `MODE: ADVERSARIAL` (H6.1) | Abrir `/` y confirmar montaje cliente de Órbita Titán |
| R4 | H4, H6, H7 | H4.1, H6.1, H7.1 | `MODE: ADVERSARIAL` (H6.1) | Comprobar fuentes Google y ausencia de scroll doble en escritorio y móvil (manual en GUIDE) |
| R5 | H1, H6, H7 | H1.1, H6.1, H7.1 | `MODE: ADVERSARIAL` (H6.1) | Revisar `package.json` sin dependencias descartadas |
| R6 | H2, H3, H4, H5, H6, H7 | H2.1, H3.1, H4.1, H5.1, H6.1, H7.1 | `pnpm test` (`tests/orbita-titan/*.test.ts`) | Ejecutar `pnpm check`, `pnpm build` y `pnpm test` |
