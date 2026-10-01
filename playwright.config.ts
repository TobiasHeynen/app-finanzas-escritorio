import { defineConfig } from '@playwright/test'

// E2E contra la app Electron ya buildeada (npm run build antes). Cada test usa un userData propio.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
})
