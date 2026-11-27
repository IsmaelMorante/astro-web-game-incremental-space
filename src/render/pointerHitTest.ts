/**
 * Detección de objetivos por puntero y conversión de coordenadas.
 * Resuelve puntos de pantalla a coordenadas lógicas y selecciona el objetivo más cercano.
 */

import type { Target, Vector2D } from '../engine/types';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../engine/balance';

export interface BoundingRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Convierte coordenadas de puntero del cliente a coordenadas lógicas del mundo de juego.
 */
export function clientToWorldPoint(
  clientX: number,
  clientY: number,
  rect: BoundingRectLike,
  worldWidth: number = ARENA_WIDTH,
  worldHeight: number = ARENA_HEIGHT
): Vector2D {
  if (rect.width <= 0 || rect.height <= 0) {
    return { x: 0, y: 0 };
  }

  const relativeX = clientX - rect.left;
  const relativeY = clientY - rect.top;
  const scaleX = worldWidth / rect.width;
  const scaleY = worldHeight / rect.height;

  return {
    x: relativeX * scaleX,
    y: relativeY * scaleY,
  };
}

/**
 * Encuentra el objetivo vivo más cercano bajo las coordenadas del mundo.
 * Devuelve el identificador del objetivo si entra en su radio efectivo (radio + margen táctil),
 * o null si no hay impacto con ningún objetivo.
 */
export function hitTestTarget(
  worldPoint: Vector2D,
  targets: readonly Target[],
  touchPadding: number = 0
): string | null {
  const padding = Math.max(0, touchPadding);
  let closestId: string | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    if (target.currentHp <= 0) {
      continue;
    }

    const deltaX = target.x - worldPoint.x;
    const deltaY = target.y - worldPoint.y;
    const distance = Math.hypot(deltaX, deltaY);
    const effectiveRadius = target.radius + padding;

    if (distance <= effectiveRadius && distance < minDistance) {
      minDistance = distance;
      closestId = target.id;
    }
  }

  return closestId;
}
