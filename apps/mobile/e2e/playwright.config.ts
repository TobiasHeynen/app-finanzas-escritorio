import { defineConfig, devices } from '@playwright/test'

// E2E de la app del celu sobre su export web (npm run test:e2e lo genera en dist-web/).
// No es Android de verdad, pero corre las mismas pantallas y la misma lógica de core.
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:8781',
    locale: 'es-AR',
    trace: 'retain-on-failure',
    ...(process.env['PW_CHROMIUM_PATH'] && {
      launchOptions: { executablePath: process.env['PW_CHROMIUM_PATH'] },
    }),
  },
  webServer: {
    command: 'node e2e/serve.mjs',
    cwd: '..',
    url: 'http://127.0.0.1:8781',
    reuseExistingServer: false,
  },
})
