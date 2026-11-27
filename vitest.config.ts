import { getViteConfig } from 'astro/config';
import type { ViteUserConfig } from 'vitest/config';

type AstroViteUserConfig = Parameters<typeof getViteConfig>[0];

const testConfig: ViteUserConfig = {
  test: {
    include: ['tests/orbita-titan/**/*.test.ts'],
  },
};

// vitest/config and astro/config resolve separate Vite peer type instances under pnpm.
export default getViteConfig(testConfig as AstroViteUserConfig);
