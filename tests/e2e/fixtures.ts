import {
  _electron as electron,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

interface Fixtures {
  app: ElectronApplication
  page: Page
}

/** Abre la app con una carpeta de datos nueva (base vacía + seed) y la borra al terminar. */
export const test = base.extend<Fixtures>({
  // Playwright exige desestructurar los fixtures aunque no se use ninguno.
  // eslint-disable-next-line no-empty-pattern
  app: async ({}, use) => {
    const userData = mkdtempSync(join(tmpdir(), 'chanchito-e2e-'))
    const args = ['.', `--user-data-dir=${userData}`]
    if (process.platform === 'linux') args.push('--no-sandbox')
    const app = await electron.launch({ args, env: { ...process.env, NODE_ENV: 'production' } })
    await use(app)
    await app.close()
    rmSync(userData, { recursive: true, force: true })
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    await page.waitForSelector('text=Chanchito')
    await use(page)
  },
})

export { expect } from '@playwright/test'
