---
id: feat--gdd-prototipo-espacial
rama: feat/gdd-prototipo-espacial
---
# Requisitos: Juego web incremental espacial

## Outcome aprobado

El repositorio entrega primero un Documento de Diseño de Juego (GDD) con imágenes de prueba en Gráficos Vectoriales Escalables (SVG). Si el usuario aprueba el GDD y las imágenes de prueba en SVG, el repositorio entrega un prototipo jugable. El prototipo usa Astro, TypeScript y lienzo de dos dimensiones (Canvas 2D) puro. El jugador completa el ciclo de combate, recolección, venta y mejoras en 4 planetas en 10 a 15 minutos.

## Alcance

### Dentro del alcance
- GDD en castellano y 6 imágenes de prueba en SVG.
- Si el usuario aprueba el GDD y las imágenes de prueba en SVG, prototipo jugable en Astro, TypeScript y Canvas 2D puro.
- Guardado automático en `localStorage` y botón «Reiniciar partida» con confirmación.
- Sonidos sintéticos con la Interfaz de Programación de Aplicaciones (API) Web Audio y botón de silencio.
- Tratamiento de datos personales: ninguno.

### Fuera del alcance
- Cuentas de jugador, servidor backend y almacenamiento en la nube.
- Progreso sin conexión (offline) con la pestaña cerrada.
- Motores gráficos externos como Phaser o PixiJS.
- Activos gráficos externos y archivos de audio externos.
- Traducciones a idiomas distintos del castellano.

## Módulos afectados
- Raíz del repositorio (`package.json`, `tsconfig.json`, `astro.config.mjs`): configuración de Astro y TypeScript.
- `docs/`: GDD, imágenes de prueba en SVG y documentación de la rama.
- `src/`: prototipo en Astro, lógica en TypeScript, Canvas 2D, audio sintético y guardado local.

## Requisitos

### R1 GDD e imágenes de prueba en SVG
- Fuente: Solicitud inicial del usuario y confirmación del usuario en entrevista inicial.
- Criterio: `docs/dev/feat--gdd-prototipo-espacial/gdd.md` incluye 7 secciones mínimas en castellano. Las 4 primeras cubren resumen y ciclo principal, combate y controles, los 4 planetas y jefes, y economía y mejoras. Las 3 restantes cubren tabla de progresión lineal de 10 a 15 minutos, estilo visual y audio sintético, y criterios de prueba. `docs/dev/feat--gdd-prototipo-espacial/assets/` contiene 6 imágenes de prueba en SVG con estética espacial oscura. Estas imágenes son `nave.svg`, `asteroide.svg`, `enemigo.svg`, `jefe.svg`, `mapa-planetas.svg` y `maqueta-hud.svg`. Antes de programar el prototipo, el usuario aprueba el GDD y las imágenes de prueba en SVG.
- Datos personales: no
- Estado: pendiente

### R2 Ciclo principal incremental espacial
- Fuente: Solicitud inicial del usuario y confirmación del usuario en entrevista inicial.
- Criterio: En partida, la nave destruye asteroides y enemigos. La bodega recoge minerales y objetos valiosos. El jugador los vende por créditos. Con los créditos, el jugador compra mejoras.
- Datos personales: no
- Estado: pendiente

### R3 Combate automático con prioridad al puntero
- Fuente: Confirmación del usuario en entrevista inicial.
- Criterio: En partida, la nave dispara sola a ritmo base. Si el jugador pulsa un objetivo con ratón o pantalla táctil (`PointerEvent`), la nave prioriza disparar hacia ese objetivo.
- Datos personales: no
- Estado: pendiente

### R4 Cuatro planetas, jefes y viaje
- Fuente: Confirmación del usuario en entrevista inicial.
- Criterio: El prototipo ofrece 4 planetas con dificultad y recompensas crecientes. Tras destruir un número definido de objetivos en un planeta, el prototipo activa su jefe. Si el jugador vence al jefe, el prototipo desbloquea el siguiente planeta. El jugador puede volver a cualquier planeta desbloqueado.
- Datos personales: no
- Estado: pendiente

### R5 Curva de progresión lineal de 10 a 15 minutos
- Fuente: Confirmación del usuario en entrevista inicial.
- Criterio: Los costes de las mejoras y las recompensas crecen de forma lineal. Una partida desde el planeta 1 hasta vencer al cuarto jefe dura entre 10 y 15 minutos.
- Datos personales: no
- Estado: pendiente

### R6 Bodega, venta manual y autoventa
- Fuente: Confirmación del usuario en entrevista inicial.
- Criterio: Si la bodega se llena, la nave deja de recoger minerales y objetos valiosos. Si el jugador pulsa «Vender todo», la bodega queda vacía. Tras cada venta, los créditos aumentan. Si la bodega vuelve a tener espacio, la nave reanuda la recolección. Si el jugador desbloquea autoventa y la nave recoge minerales u objetos valiosos, el prototipo los vende al instante.
- Datos personales: no
- Estado: pendiente

### R7 Seis mejoras de la nave
- Fuente: Confirmación del usuario en entrevista inicial.
- Criterio: El menú incluye 5 mejoras lineales y 1 desbloqueo único. Las 5 mejoras lineales son daño de cañón, cadencia, casco y escudo, capacidad de bodega y dron de apoyo. El dron de apoyo añade un disparo autónomo extra en paralelo al de la nave. El desbloqueo único es la autoventa. Si el jugador compra una mejora lineal o la autoventa, su efecto cambia la partida de inmediato.
- Datos personales: no
- Estado: pendiente

### R8 Reparación tras derrota y victoria final
- Fuente: Confirmación del usuario en entrevista inicial.
- Criterio: Si los enemigos destruyen la nave, el prototipo la repara en el planeta actual. En ese caso, el jugador conserva sus mejoras, sus créditos y su carga de bodega. Si el combate contra el jefe estaba activo, el prototipo reinicia ese combate. Si el jugador vence al jefe del cuarto planeta, el prototipo muestra la pantalla de victoria.
- Datos personales: no
- Estado: pendiente

### R9 Visuales nítidos en Canvas 2D sin activos gráficos externos
- Fuente: Solicitud inicial del usuario y confirmación del usuario en entrevista inicial.
- Criterio: El prototipo usa Astro, TypeScript y Canvas 2D puro. Omite Phaser, PixiJS y los activos gráficos externos. El prototipo escala el Canvas 2D con `devicePixelRatio` sobre una estética espacial oscura.
- Datos personales: no
- Estado: pendiente

### R10 Interfaz en castellano, audio sintético y botón de silencio
- Fuente: Confirmación del usuario en entrevista inicial.
- Criterio: Todos los textos de la interfaz aparecen en castellano. Tras el primer gesto del jugador, el prototipo activa la API Web Audio. Si el jugador dispara, destruye objetivos o compra mejoras, el prototipo reproduce sonidos sintéticos. El prototipo omite archivos de audio externos. La interfaz incluye un botón de silencio.
- Datos personales: no
- Estado: pendiente

### R11 Guardado local automático y reinicio con confirmación
- Fuente: Confirmación del usuario en entrevista inicial.
- Criterio: El prototipo guarda automáticamente en `localStorage` créditos, mejoras, autoventa, planetas desbloqueados, planeta actual y carga de bodega. Si el jugador recarga el navegador, el prototipo restaura esos datos. El prototipo omite el progreso sin conexión (offline) con la pestaña cerrada. Si el jugador pulsa «Reiniciar partida», el prototipo pide confirmación. Si el jugador confirma, el prototipo borra los datos de `localStorage`. Tras borrar los datos, el prototipo vuelve al inicio.
- Datos personales: no
- Estado: pendiente
