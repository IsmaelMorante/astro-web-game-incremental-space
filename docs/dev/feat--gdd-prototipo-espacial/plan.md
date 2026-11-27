---
id: feat--gdd-prototipo-espacial
rama: feat/gdd-prototipo-espacial
---
# Plan: Juego web incremental espacial

## Arquitectura y puertas
El prototipo separa la simulación pura de las capas de navegador sin ciclos de dependencia. El motor en `src/engine/` omite el Modelo de Objetos del Documento (DOM) y el lienzo de dos dimensiones (Canvas 2D). Los adaptadores de `src/persistence/`, `src/audio/` y `src/render/` solo dependen de `src/engine/`. La capa `src/ui/` coordina esos adaptadores desde páginas Astro con TypeScript estricto. El proyecto entrega primero el Documento de Diseño de Juego (GDD) y 6 imágenes de prueba en Gráficos Vectoriales Escalables (SVG).

Puertas obligatorias del usuario:
1. Tras H1, revisa el GDD y las 6 imágenes de prueba en SVG.
2. Si apruebas H1, habilita H2.
3. Tras H2.1, ejecuta `pnpm install` para generar `pnpm-lock.yaml`.

Si el usuario cambia reglas operativas en `docs/dev/feat--gdd-prototipo-espacial/gdd.md` al aprobar H1, `architect` actualiza H3–H6 antes de iniciar H2.

## Hitos

### H1 Documento de Diseño de Juego (GDD) y 6 imágenes de prueba en SVG
- Objetivo: definir las reglas del juego, la curva lineal de 10 a 15 minutos y las 6 imágenes de prueba en SVG.
- Criterio: el usuario aprueba la entrega documental de R1 en `docs/dev/feat--gdd-prototipo-espacial/`.
- Traza: R1
- Frontera: el código del prototipo exige aprobar antes las reglas operativas de `docs/dev/feat--gdd-prototipo-espacial/gdd.md` y el diseño visual.
- Depende de: ninguno · Cota: 7 ficheros, 2 subhitos
- Estado: hecho
#### H1.1 Redacción del GDD completo (documenter)
- GOAL: redactar en `docs/dev/feat--gdd-prototipo-espacial/gdd.md` las 7 secciones de R1 con sus reglas operativas pendientes de aprobación en la puerta 1. OUTCOME: R1. SCOPE: `docs/dev/feat--gdd-prototipo-espacial/gdd.md`.
- CONSTRAINTS: P1, P6 y `ste-es`. El fichero `docs/dev/feat--gdd-prototipo-espacial/gdd.md` concreta fijación, autoapuntado, reaparición de jefes, acciones tras victoria, casco y escudo, topes y ritmo. También concreta bodega llena, autoventa, pantallas soportadas, momento de guardado, respaldo ante corrupción y control de silencio. ACCEPTANCE: `docs/dev/feat--gdd-prototipo-espacial/gdd.md` cubre las 7 secciones de R1, la tabla lineal de progresión y todas esas reglas operativas. VERIFY: Comprobar en `docs/dev/feat--gdd-prototipo-espacial/gdd.md` las 7 secciones de R1 con sus reglas operativas.
#### H1.2 Generación de 6 imágenes de prueba en SVG (documenter)
- GOAL: crear las 6 imágenes de prueba en SVG con estética espacial oscura. OUTCOME: R1. SCOPE: `docs/dev/feat--gdd-prototipo-espacial/assets/nave.svg`, `docs/dev/feat--gdd-prototipo-espacial/assets/asteroide.svg`, `docs/dev/feat--gdd-prototipo-espacial/assets/enemigo.svg`, `docs/dev/feat--gdd-prototipo-espacial/assets/jefe.svg`, `docs/dev/feat--gdd-prototipo-espacial/assets/mapa-planetas.svg`, `docs/dev/feat--gdd-prototipo-espacial/assets/maqueta-hud.svg`.
- CONSTRAINTS: P1, P6. Depende de: H1.1. ACCEPTANCE: las 6 imágenes de prueba en SVG reflejan los elementos definidos en `docs/dev/feat--gdd-prototipo-espacial/gdd.md`. VERIFY: Comprobar 6 imágenes de prueba en SVG con `viewBox` válido en `docs/dev/feat--gdd-prototipo-espacial/assets/`.

### H2 Base del proyecto Astro, TypeScript y Vitest
- Objetivo: preparar la configuración inicial del repositorio para compilar Astro con TypeScript estricto y ejecutar Vitest con `pnpm`.
- Criterio: tras ejecutar el usuario `pnpm install`, `pnpm exec astro check` termina con código 0.
- Traza: R9, R10
- Frontera: los hitos de código necesitan el manifiesto, `tsconfig.json` estricto y `pnpm-lock.yaml` antes de importar módulos o ejecutar `pnpm`.
- Depende de: H1 · Cota: 7 ficheros, 1 subhito
- Estado: hecho
#### H2.1 Configuración inicial de Astro, TypeScript y Vitest (devops)
- GOAL: crear la base de configuración con `astro`, `typescript`, `@astrojs/check` y `vitest` sin instalar paquetes. OUTCOME: R9, R10. SCOPE: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/env.d.ts`, `src/pages/index.astro`.
- CONSTRAINTS: P1, P5. Configura scripts `dev`, `check`, `build` (`astro check && astro build`) y `test` (`vitest run`). `vitest.config.ts` usa `getViteConfig()` de `astro/config` para habilitar `experimental_AstroContainer`. H6.1 valida la compatibilidad real de `experimental_AstroContainer`. Omite `happy-dom` y `jsdom` (P5) porque `gameController.ts` usa interfaces inyectadas en Vitest. Si faltan dependencias instaladas, indica en `GUIDE` ejecutar `pnpm install`. ACCEPTANCE: los 7 ficheros existen con `strict` activo. `vitest.config.ts` exporta `getViteConfig()` sin dependencias de emulación DOM. VERIFY: `node -e "const fs=require('fs'); ['package.json','astro.config.mjs','tsconfig.json','vitest.config.ts','.gitignore','src/env.d.ts','src/pages/index.astro'].forEach((f)=>{if(!fs.existsSync(f))throw f}); JSON.parse(fs.readFileSync('package.json','utf8'))"`

### H3 Motor puro de simulación, combate y progresión
- Objetivo: implementar y verificar la lógica pura de combate, economía, planetas, jefes y curva de 10 a 15 minutos.
- Criterio: `pnpm exec vitest run src/engine/__tests__` supera todas las pruebas con código 0.
- Traza: R2, R3, R4, R5, R6, R7, R8
- Frontera: separar el motor puro permite probar toda la economía y el combate sin DOM ni Canvas 2D antes de construir adaptadores.
- Depende de: H2 · Cota: 8 ficheros, 5 subhitos
- Estado: hecho
#### H3.1 Tipos de dominio y tabla de balance lineal (frontend)
- GOAL: definir tipos con uniones discriminadas y fórmulas lineales de costes, recompensas y planetas según `docs/dev/feat--gdd-prototipo-espacial/gdd.md`. OUTCOME: R2, R4, R5, R7. SCOPE: `src/engine/types.ts`, `src/engine/balance.ts`.
- CONSTRAINTS: P1-P8, `stack-typescript`. Omite importaciones de navegador o DOM. ACCEPTANCE: tipos estrictos sin `any` con balance calibrado para 10 a 15 minutos. VERIFY: `pnpm exec tsc --noEmit`
#### H3.2 Módulo puro de combate y dron de apoyo (frontend)
- GOAL: programar combate, autoapuntado, fijación por puntero y dron de apoyo en `src/engine/combat.ts`. OUTCOME: R2, R3, R7. SCOPE: `src/engine/combat.ts`.
- CONSTRAINTS: P1-P8, `stack-typescript`. Depende de: H3.1. Omite importaciones de DOM o Canvas 2D. ACCEPTANCE: la nave prioriza objetivos fijados por puntero. El dron dispara en paralelo a la nave. VERIFY: `pnpm exec tsc --noEmit`
#### H3.3 Economía de bodega, venta y mejoras (frontend)
- GOAL: programar bodega, venta manual, autoventa y las 6 mejoras en `src/engine/economy.ts`. OUTCOME: R2, R6, R7. SCOPE: `src/engine/economy.ts`.
- CONSTRAINTS: P1-P8, `stack-typescript`. Depende de: H3.2. Omite importaciones de DOM o Canvas 2D. ACCEPTANCE: la bodega llena frena la recolección. Cada compra o venta aplica su efecto al instante. VERIFY: `pnpm exec tsc --noEmit`
#### H3.4 Simulación de planetas, jefes, derrota y victoria (frontend)
- GOAL: programar los 4 planetas, jefes, reparación tras derrota y victoria en `src/engine/simulation.ts` y `src/engine/index.ts`. OUTCOME: R2, R3, R4, R5, R6, R7, R8. SCOPE: `src/engine/simulation.ts`, `src/engine/index.ts`.
- CONSTRAINTS: P1-P8, `stack-typescript`. Depende de: H3.3. Omite importaciones de DOM o Canvas 2D. ACCEPTANCE: la derrota repara la nave en el planeta actual. El jugador conserva mejoras, créditos y bodega. VERIFY: `pnpm exec tsc --noEmit`
#### H3.5 Pruebas unitarias del motor y curva temporal (qa)
- GOAL: validar combate, fijación, bodega, autoventa, mejoras, derrota, jefes y duración simulada de 10 a 15 minutos. OUTCOME: R2, R3, R4, R5, R6, R7, R8. SCOPE: `src/engine/__tests__/combat.test.ts`, `src/engine/__tests__/progression.test.ts`.
- CONSTRAINTS: `qa-web`, `qa-tests`. Depende de: H3.4. ACCEPTANCE: todas las pruebas deterministas pasan. La partida simulada completa tarda entre 600 y 900 segundos. VERIFY: `pnpm exec vitest run src/engine/__tests__`

### H4 Persistencia local, audio sintético y renderizador Canvas 2D
- Objetivo: construir los adaptadores de `localStorage`, la Interfaz de Programación de Aplicaciones (API) Web Audio y Canvas 2D con relación de píxeles del dispositivo (DPR).
- Criterio: `pnpm exec vitest run src/persistence/__tests__ src/audio/__tests__ src/render/__tests__` supera todas las pruebas con código 0.
- Traza: R3, R9, R10, R11
- Frontera: estos adaptadores consumen el estado del motor sin acoplarse al marcado visual de los componentes Astro.
- Depende de: H3 · Cota: 8 ficheros, 4 subhitos
- Estado: hecho
#### H4.1 Adaptador de guardado en `localStorage` (frontend)
- GOAL: serializar, validar en frontera, restaurar y borrar el estado guardado según `docs/dev/feat--gdd-prototipo-espacial/gdd.md`. OUTCOME: R10, R11. SCOPE: `src/persistence/saveStorage.ts`.
- CONSTRAINTS: P1-P8, `stack-typescript`. Inyecta interfaz `StorageLike`. Valida datos en frontera con guardas de tipo. `saveStorage.ts` omite calcular tiempo transcurrido al cargar (sin progreso offline en R11). ACCEPTANCE: guarda y restaura los campos definidos en R11 y los ajustes aprobados en `docs/dev/feat--gdd-prototipo-espacial/gdd.md`. Ante datos corruptos, aplica el respaldo inicial seguro. VERIFY: `pnpm exec tsc --noEmit`
#### H4.2 Sintetizador Web Audio y lienzo Canvas 2D (frontend)
- GOAL: generar sonido sintético tras el primer gesto del jugador. Dibujar escenas vectoriales nítidas con `devicePixelRatio`. OUTCOME: R3, R9, R10. SCOPE: `src/audio/synthAudio.ts`, `src/render/renderer.ts`, `src/render/pointerHitTest.ts`.
- CONSTRAINTS: P1-P8, `stack-typescript`. `synthAudio.ts` recibe una factoría inyectada de `AudioContext`. `renderer.ts` recibe una interfaz mínima de contexto 2D inyectada para probar `devicePixelRatio` sin navegador. Omite activos gráficos y de audio externos. ACCEPTANCE: el audio respeta el silencio. `renderer.ts` escala el lienzo con `devicePixelRatio`. La función `pointerHitTest` resuelve objetivos bajo coordenadas del lienzo. VERIFY: `pnpm exec tsc --noEmit`
#### H4.3 Pruebas de persistencia y respaldo ante corrupción (qa)
- GOAL: probar guardado, carga sin progreso offline, reinicio y recuperación ante datos corruptos en `localStorage`. OUTCOME: R10, R11. SCOPE: `src/persistence/__tests__/saveStorage.test.ts`.
- CONSTRAINTS: `qa-web`, `qa-tests`. Depende de: H4.1. ACCEPTANCE: los datos válidos restauran el estado sin calcular tiempo transcurrido. Los datos corruptos devuelven el estado inicial seguro. VERIFY: `pnpm exec vitest run src/persistence/__tests__`
#### H4.4 Pruebas de audio sintético, renderizado y puntero (qa)
- GOAL: verificar el sintetizador Web Audio, el escalado con `devicePixelRatio` y la selección de objetivos para `PointerEvent`. OUTCOME: R3, R9, R10. SCOPE: `src/audio/__tests__/synthAudio.test.ts`, `src/render/__tests__/pointerHitTest.test.ts`, `src/render/__tests__/renderer.test.ts`.
- CONSTRAINTS: `qa-web`, `qa-tests`. Depende de: H4.2. Usa una factoría inyectada de `AudioContext` en `synthAudio.test.ts`. Inyecta la interfaz mínima de contexto 2D en `renderer.test.ts` para probar `devicePixelRatio` sin navegador. ACCEPTANCE: `synthAudio.test.ts` valida activación tras primer gesto, sonidos y silencio. `renderer.test.ts` valida el escalado con `devicePixelRatio`. `pointerHitTest.test.ts` devuelve el identificador del objetivo bajo el puntero o nulo fuera de alcance. VERIFY: `pnpm exec vitest run src/audio/__tests__ src/render/__tests__`

### H5 Interfaz Astro en castellano y bucle integrado
- Objetivo: conectar el motor y los adaptadores con los componentes Astro y la interfaz de estado (HUD) responsiva en castellano.
- Criterio: `pnpm build` compila el prototipo completo en `dist/` con código 0.
- Traza: R2, R3, R4, R6, R7, R8, R9, R10, R11
- Frontera: la vista y el controlador integran todos los módulos probados para compilar el prototipo jugable completo.
- Depende de: H4 · Cota: 6 ficheros, 2 subhitos
- Estado: hecho
#### H5.1 Controlador cliente y formateadores de HUD (frontend)
- GOAL: conectar bucle, `PointerEvent`, guardado automático, audio y acciones del HUD. OUTCOME: R2, R3, R4, R6, R7, R8, R10, R11. SCOPE: `src/ui/hudFormatters.ts`, `src/ui/gameController.ts`.
- CONSTRAINTS: P1-P8, `stack-typescript`, `antislop`. Todos los textos van en castellano. `gameController.ts` usa interfaces inyectadas para probarse en Vitest sin `happy-dom` ni `jsdom` (P5). Además acota el paso de tiempo (`dt`) a un máximo de 100 ms para impedir progreso con la pestaña inactiva. Guarda al instante en acciones clave con respaldo periódico. ACCEPTANCE: cada botón del HUD dispara su acción del motor. Cada acción actualiza `localStorage`. El controlador acota `dt` a 100 ms. VERIFY: `pnpm exec tsc --noEmit`
#### H5.2 Páginas y componentes Astro responsivos (frontend)
- GOAL: maquetar lienzo, HUD, 6 mejoras, 4 planetas, diálogo de reinicio y pantalla de victoria en castellano. OUTCOME: R2, R4, R6, R7, R8, R9, R10, R11. SCOPE: `src/layouts/Layout.astro`, `src/components/SpaceCanvas.astro`, `src/components/ControlPanel.astro`, `src/pages/index.astro`.
- CONSTRAINTS: P1-P8, `stack-astro`, `stack-typescript`, `antislop`, `antislop-ui`, `antislop-human`, `antislop-layoutmobile`. Depende de: H5.1. Soporta escritorio y móvil según `docs/dev/feat--gdd-prototipo-espacial/gdd.md`. Mantiene accesibilidad por teclado. ACCEPTANCE: `pnpm build` compila Astro con tipos estrictos sin errores ni activos externos. VERIFY: `pnpm build`

### H6 Validación integral de la interfaz y regresión completa
- Objetivo: confirmar el renderizado Astro, los formatos en castellano y la integración completa de mecánicas en Vitest.
- Criterio: `pnpm exec vitest run` supera toda la suite del proyecto con código 0.
- Traza: R2, R3, R4, R5, R6, R7, R8, R9, R10, R11
- Frontera: separa las pruebas de interfaz Astro y flujo integrado tras compilar el prototipo de las pruebas por capa.
- Depende de: H5 · Cota: 3 ficheros, 2 subhitos
- Estado: hecho
#### H6.1 Pruebas de formatos en castellano y marcado Astro (qa)
- GOAL: verificar los textos en castellano, los controles del HUD y el marcado semántico de `index.astro`. OUTCOME: R6, R7, R9, R10, R11. SCOPE: `src/ui/__tests__/hudFormatters.test.ts`, `src/pages/__tests__/index.test.ts`.
- CONSTRAINTS: `qa-web`, `qa-tests`. ACCEPTANCE: `index.test.ts` verifica con `experimental_AstroContainer` los textos clave, botones y `<canvas>`. VERIFY: `pnpm exec vitest run src/ui/__tests__ src/pages/__tests__`
#### H6.2 Pruebas de flujo completo y regresión total (qa)
- GOAL: validar el ciclo integrado, recarga sin progreso offline, cota de `dt`, reinicio confirmado, derrota y victoria. OUTCOME: R2, R3, R4, R5, R6, R7, R8, R9, R10, R11. SCOPE: `src/__tests__/gameFlow.test.ts`.
- CONSTRAINTS: `qa-web`, `qa-tests`, `qa-adversarial`. Depende de: H6.1. Comprueba en `gameFlow.test.ts` el límite de 100 ms en `dt`. Comprueba también que recargar omite progreso offline. Lista en `LIMITS` las comprobaciones manuales de Canvas 2D, audio real y táctil. ACCEPTANCE: toda la suite Vitest pasa sin fallos ni avisos de omisión. VERIFY: `pnpm exec vitest run`

## Matriz de trazabilidad
| R-id | hito | subhito | prueba (qa) | paso del GUIDE |
|---|---|---|---|---|
| R1 | H1 | H1.1, H1.2 | Revisión documental de `docs/dev/feat--gdd-prototipo-espacial/gdd.md` y 6 imágenes de prueba en SVG | Revisar `docs/dev/feat--gdd-prototipo-espacial/gdd.md` y las 6 imágenes de prueba en SVG |
| R2 | H3, H5, H6 | H3.1, H3.2, H3.3, H3.4, H3.5, H5.1, H5.2, H6.2 | `combat.test.ts`, `progression.test.ts`, `gameFlow.test.ts` | Destruir objetivos, recoger mineral, vender y comprar mejora |
| R3 | H3, H4, H5, H6 | H3.2, H3.4, H3.5, H4.2, H4.4, H5.1, H6.2 | `combat.test.ts`, `pointerHitTest.test.ts`, `gameFlow.test.ts` | Comprobar autoapuntado y pulsar objetivo para fijar disparo |
| R4 | H3, H5, H6 | H3.1, H3.4, H3.5, H5.1, H5.2, H6.2 | `progression.test.ts`, `gameFlow.test.ts` | Derrotar jefe, desbloquear planeta y viajar a uno anterior |
| R5 | H3, H6 | H3.1, H3.4, H3.5, H6.2 | `progression.test.ts`, `gameFlow.test.ts` | Confirmar duración simulada de 10 a 15 minutos en Vitest |
| R6 | H3, H5, H6 | H3.3, H3.4, H3.5, H5.1, H5.2, H6.1, H6.2 | `progression.test.ts`, `index.test.ts`, `gameFlow.test.ts` | Llenar bodega, pulsar «Vender todo» y activar autoventa |
| R7 | H3, H5, H6 | H3.1, H3.2, H3.3, H3.4, H3.5, H5.1, H5.2, H6.1, H6.2 | `combat.test.ts`, `progression.test.ts`, `index.test.ts`, `gameFlow.test.ts` | Comprar las 5 mejoras lineales y la autoventa viendo su efecto |
| R8 | H3, H5, H6 | H3.4, H3.5, H5.1, H5.2, H6.2 | `progression.test.ts`, `gameFlow.test.ts` | Sufrir derrota ante jefe y vencer al cuarto jefe para ver victoria |
| R9 | H2, H4, H5, H6 | H2.1, H4.2, H4.4, H5.2, H6.1, H6.2 | `renderer.test.ts`, `index.test.ts`, `gameFlow.test.ts` y `pnpm build` | Abrir en escritorio y móvil verificando Canvas 2D nítido |
| R10 | H2, H4, H5, H6 | H2.1, H4.1, H4.2, H4.3, H4.4, H5.1, H5.2, H6.1, H6.2 | `synthAudio.test.ts`, `hudFormatters.test.ts`, `index.test.ts`, `gameFlow.test.ts` | Verificar textos en castellano, audio sintético y botón de silencio |
| R11 | H4, H5, H6 | H4.1, H4.3, H5.1, H5.2, H6.1, H6.2 | `saveStorage.test.ts`, `index.test.ts`, `gameFlow.test.ts` | Recargar navegador comprobando guardado y usar «Reiniciar partida» |
