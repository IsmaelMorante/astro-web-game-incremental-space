---
id: feat--gdd-prototipo-espacial
rama: feat/gdd-prototipo-espacial
---
# Documento de Diseño de Juego (GDD): Prototipo incremental espacial

## 1. Resumen y ciclo principal

Este documento define las reglas del prototipo incremental espacial para web. El prototipo funciona en Astro, TypeScript y lienzo de dos dimensiones (Canvas 2D) puro. El jugador avanza por 4 planetas y derrota al cuarto jefe en 10 a 15 minutos.

El ciclo principal sigue estos 5 pasos:
1. Destruye asteroides y enemigos en el planeta actual.
2. Recoge minerales y objetos valiosos en la bodega de la nave.
3. Vende la carga de la bodega para obtener créditos.
4. Compra mejoras de la nave con los créditos obtenidos.
5. Desafía al jefe del planeta para desbloquear el siguiente planeta.

## 2. Combate y controles

### Posición, disparo y pulso manual
La nave permanece en el centro del área lógica de juego (`900 x 600` píxeles). Dispara proyectiles automáticamente (`600` px/s). El dron de apoyo dispara un proyectil por segundo en paralelo.
Al pulsar sobre un objetivo fijado, la nave emite un «Pulso Manual» (`60 %` daño base, `0,25 s` enfriamiento).

### Respuesta visual y sacudida
El sistema genera feedback visual dinámico:
- Destellos de impacto.
- Partículas, fragmentos y ondas de explosión al destruir.
- Números flotantes de daño y créditos.
- Sacudida de cámara en jefes y derrota.
- Movimiento y rotación suave de asteroides y enemigos.
- Órbita animada del dron de apoyo.

### Autoapuntado y fijación
El sistema prioriza jefes, enemigos agresivos y asteroides. El puntero permite fijar objetivos manualmente, marcados con un anillo. Pulsar en vacío libera la fijación.

### Casco, escudo y regeneración
El escudo absorbe el daño primero.
- Si la nave pasa `2,0` segundos sin recibir impactos, el escudo regenera un `20 %` por segundo.
- Bajo fuego constante, el escudo regenera un `25 %` de la tasa pasiva normal.
- Si el casco llega a `0`, la nave se repara al instante.


## 3. Los 4 planetas y jefes

Cada planeta tiene una identidad visual distinta mediante colores y ambientación en Canvas 2D.

| Planeta | Asteroide (PV) | Enemigo (PV) | Jefe (nombre / PV) |
|---|---|---|---|
| 1. Cinturón de Hierro | 60 | 110 | Perforadora Titán / 1.200 |
| 2. Órbita de Cobalto | 220 | 400 | Fragata Cobalto / 4.800 |
| 3. Nebulosa de Plasma | 650 | 1.150 | Crucero Nebular / 14.500 |
| 4. Núcleo Estelar | 1.600 | 1.900 | Guardián Solar / 19.000 |


## 4. Mejoras, escalones y sumideros de créditos

### Las 6 mejoras
El menú ofrece `5` mejoras lineales y `1` desbloqueo único. El coste sigue la fórmula `base + incremento * nivelActual`.

| Mejora | Tipo | Coste (créditos) | Efecto por nivel | Tope |
|---|---|---|---|---|
| Daño de cañón | Lineal | `25 + 25 * nivel` | `10 + 5 * nivel` de daño por disparo | 20 |
| Cadencia | Lineal | `30 + 35 * nivel` | `1,0 + 0,25 * nivel` disparos por segundo | 15 |
| Casco y Escudo | Lineal | `35 + 30 * nivel` | `80 + 25 * nivel` de casco y `40 + 20 * nivel` de escudo | 15 |
| Capacidad de bodega | Lineal | `30 + 25 * nivel` | `10 + 5 * nivel` espacios de bodega | 10 |
| Dron de apoyo | Lineal | `60 + 60 * nivel` | `0` en nivel 0; `12 * nivel` de daño | 10 |
| Autoventa | Único | `500` fijos | Vende bodega y convierte recursos futuros al instante | 1 |

### Escalones de poder
Cada cinco niveles, la mejora cambia de escalón (`Mk I` a `Omega`). Cada escalón aplica un multiplicador de `+15 %` al efecto base.

### Sumideros de créditos
El jugador dispone de tres sumideros adicionales:
1. **Consumibles**: Sobrecarga (+50 % daño durante 15 s), Reparación de emergencia (100 % casco y escudo) y Pulso EMP (daño masivo en área).
2. **Sobremarcha**: Niveles infinitos con `+12 %` de daño global por nivel, disponible tras alcanzar el tope de Daño de cañón y Dron de apoyo.
3. **Flota de naves**: Caza Interceptor (máx. 6), Corbeta Láser (máx. 4) y Fragata Pesada (máx. 3). Las naves orbitan y disparan automáticamente.


## 5. Tabla de progresión lineal de 10 a 15 minutos

El perfil de referencia corresponde a una partida semiautomática activa. Antes de autoventa, el jugador vende al llenar bodega. El jugador compra mejoras en cuanto dispone de créditos y fija con puntero a enemigos o jefes. El daño por segundo (DPS) combina el cañón de la nave y el dron de apoyo. El margen esperado en simulación abarca de `600` a `900` segundos (`10` a `15` minutos).

| Fase | Tiempo acumulado | Duración fase | DPS total | Casco + Escudo | Niveles aproximados (Ca/Cd/CE/Bo/Dr/Au) | Créditos acumulados |
|---|---|---|---|---|---|---|
| Inicio Planeta 1 | 00:00 (0 s) | — | 10,0 | 80 + 40 | 0 / 0 / 0 / 0 / 0 / 0 | 0 |
| Umbral Planeta 1 | 01:40 (100 s) | 100 s | 64,5 | 130 + 80 | 4 / 3 / 2 / 1 / 1 / 0 | 460 |
| Fin Jefe 1 | 02:05 (125 s) | 25 s | 64,5 | 130 + 80 | 4 / 3 / 2 / 1 / 1 / 0 | 680 |
| Umbral Planeta 2 | 04:30 (270 s) | 145 s | 136,5 | 205 + 140 | 7 / 6 / 5 / 2 / 2 / 1 | 2.210 |
| Fin Jefe 2 | 05:05 (305 s) | 35 s | 136,5 | 205 + 140 | 7 / 6 / 5 / 2 / 2 / 1 | 2.760 |
| Umbral Planeta 3 | 07:50 (470 s) | 165 s | 317,0 | 330 + 240 | 12 / 10 / 10 / 2 / 6 / 1 | 6.060 |
| Fin Jefe 3 | 08:40 (520 s) | 50 s | 317,0 | 330 + 240 | 12 / 10 / 10 / 2 / 6 / 1 | 7.460 |
| Umbral Planeta 4 | 12:20 (740 s) | 220 s | 558,0 | 430 + 320 | 18 / 14 / 14 / 2 / 9 / 1 | 14.960 |
| Fin Jefe 4 (Victoria) | 13:15 (795 s) | 55 s | 558,0 | 430 + 320 | 18 / 14 / 14 / 2 / 9 / 1 | 17.460 |

Las siglas de niveles representan Daño de cañón (`Ca`), Cadencia (`Cd`) y Casco y Escudo (`CE`). Las tres últimas representan Capacidad de bodega (`Bo`), Dron de apoyo (`Dr`) y Autoventa (`Au`). El coste de la configuración final (`18/14/14/2/9/1`) suma `14.385` créditos, inferior a los `14.960` créditos disponibles antes del Jefe 4.

## 6. Panel de Estadísticas y Estilo visual

### Panel de Estadísticas (Stats)
El panel de control incluye un bloque compacto con datos en tiempo real:
- DPS total (nave, dron y flota).
- Daño por disparo.
- Cadencia.
- Escudo actual y tasa de regeneración.
- Capacidad de bodega.
- Objetivos destruidos.
- Créditos totales.

### Paleta espacial oscura y planetas
Todos los gráficos usan Canvas 2D con una paleta hexadecimal contrastada (ej. `#080C18` para espacio profundo). Cada uno de los 4 planetas tiene colores y ambientación diferenciada. El sistema genera todo el sonido mediante la API Web Audio.


## 7. Persistencia

El sistema guarda la partida en `localStorage` con la clave `astro-incremental-save-v1`. El guardado incluye retrocompatibilidad para partidas v1 previas.
Campos añadidos:
- `fleet`: estado de la flota (cazas, corbetas, fragatas).
- `overclockLevel`: nivel de sobremarcha.

