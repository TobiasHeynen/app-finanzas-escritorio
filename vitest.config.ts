import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'packages/core/src/shared'),
      '@core': resolve(__dirname, 'packages/core/src'),
      '@main': resolve(__dirname, 'src/main'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: [],
    environment: 'node',
    // Vitest corre adentro del Node de Electron (ver scripts/run-vitest.mjs): un solo ABI nativo.
    pool: 'forks',
  },
})
