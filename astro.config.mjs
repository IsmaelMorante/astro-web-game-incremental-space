// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/** @typedef {NonNullable<NonNullable<import('astro').AstroUserConfig['vite']>['plugins']>} VitePlugins */

export default defineConfig({
  integrations: [react()],
  vite: {
    // @tailwindcss/vite@4.3.5 resolves vite@8 Plugin types while Astro 5 expects vite@6 PluginOption.
    plugins: /** @type {VitePlugins} */ ([tailwindcss()]),
  },
});
