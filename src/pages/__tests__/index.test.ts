import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import IndexPage from '../index.astro';

describe('src/pages/index.astro', () => {
  it('renderiza la estructura semántica y el lienzo Canvas 2D (R2, R3, R9)', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(IndexPage);

    // Contenedor del juego y Canvas 2D
    expect(html).toContain('class="game-wrapper"');
    expect(html).toContain('<canvas');
    expect(html).toContain('id="space-canvas"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Área táctica de combate espacial"');

    // Landmarks semánticos
    expect(html).toContain('class="hud-header"');
    expect(html).toContain('role="banner"');
    expect(html).toContain('class="game-main"');
    expect(html).toContain('class="control-column"');
    expect(html).toContain('aria-label="Panel de control táctico"');
    expect(html).toContain('class="game-footer"');
  });

  it('incluye todos los textos de acción y controles en castellano (R6, R7, R10, R11)', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(IndexPage);

    // Acciones principales
    expect(html).toContain('Vender todo');
    expect(html).toContain('Desafiar jefe');
    expect(html).toContain('Reiniciar partida');
    expect(html).toContain('Silenciar');

    // Diálogo de confirmación de reinicio
    expect(html).toContain('¿Seguro que quieres reiniciar la partida?');
    expect(html).toContain('Confirmar reinicio');
    expect(html).toContain('Cancelar');

    // Diálogo de victoria
    expect(html).toContain('¡Victoria Estelar!');
    expect(html).toContain('Seguir jugando');
    expect(html).toContain('Nueva partida');
  });

  it('presenta las 6 mejoras de la nave en castellano (R7, R11)', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(IndexPage);

    // Las 5 mejoras progresivas
    expect(html).toContain('Daño de cañón');
    expect(html).toContain('Cadencia');
    expect(html).toContain('Casco y Escudo');
    expect(html).toContain('Capacidad de bodega');
    expect(html).toContain('Dron de apoyo');

    // Mejora binaria de autoventa
    expect(html).toContain('Autoventa');
    expect(html).toContain('Vende botín automáticamente');
  });

  it('incluye los 4 sistemas planetarios del juego (R6, R9, R10)', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(IndexPage);

    expect(html).toContain('Cinturón de Hierro');
    expect(html).toContain('Órbita de Cobalto');
    expect(html).toContain('Nebulosa de Plasma');
    expect(html).toContain('Núcleo Estelar');
  });

  it('no contiene enlaces ni referencias a motores o activos gráficos externos (R3, R11)', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(IndexPage);

    // Sin scripts o estilos externos que llamen a CDNs o librerías de motores
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).not.toMatch(/pixi/i);
    expect(html).not.toMatch(/three/i);
    expect(html).not.toMatch(/phaser/i);
    expect(html).not.toMatch(/cdn\./i);
    expect(html).not.toMatch(/unpkg\.com/i);
    expect(html).not.toMatch(/cdnjs/i);

    // Cero imágenes rasterizadas o externas en el HTML renderizado
    expect(html).not.toContain('<img');
  });
});
