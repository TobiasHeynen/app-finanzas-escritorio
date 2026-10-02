import { openDatabase } from '@main/db/connection'
import { wrapSyncSqlite } from '@core/db/sync-adapter'
import type { SqlDb } from '@core/db/sql'
import { migrate } from '@core/db/migrate'
import { seed } from '@core/db/seed'
import { createRepos } from '@core/repositories'
import type { Clock, ServiceContext } from '@core/services/context'
import { fakeExpoSqlite } from './fake-expo-sqlite'

export interface TestContext extends ServiceContext {
  clock: Clock & { set(date: string): void }
}

/**
 * Base en memoria para los tests de core. Con `CORE_DB=expo` (npm run test:core-expo) la misma suite
 * corre a través del adaptador del celu, para verificar que se comporta igual que better-sqlite3.
 */
export function openTestDb(): SqlDb {
  return process.env['CORE_DB'] === 'expo'
    ? wrapSyncSqlite(fakeExpoSqlite())
    : openDatabase(':memory:')
}

/** Base en memoria con las migraciones reales y (opcional) el seed. */
export function createTestContext(today = '2026-10-15', { withSeed = true } = {}): TestContext {
  const db = openTestDb()
  migrate(db)
  if (withSeed) seed(db)
  let now = today
  const clock = {
    today: () => now,
    set: (date: string) => {
      now = date
    },
  }
  return { db, repos: createRepos(db), clock }
}

export function idsByName(ctx: ServiceContext) {
  const categories = ctx.repos.catalog.listCategories()
  const methods = ctx.repos.paymentMethods.list()
  const sub = (name: string): number => {
    for (const c of categories) {
      const s = c.subcategories.find((x) => x.name === name)
      if (s) return s.id
    }
    throw new Error(`Subcategoría ${name} no encontrada`)
  }
  const method = (name: string): number => {
    const m = methods.find((x) => x.name === name)
    if (!m) throw new Error(`Medio de pago ${name} no encontrado`)
    return m.id
  }
  const category = (name: string): number => {
    const c = categories.find((x) => x.name === name)
    if (!c) throw new Error(`Categoría ${name} no encontrada`)
    return c.id
  }
  return { sub, method, category }
}
