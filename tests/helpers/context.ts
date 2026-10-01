import { openDatabase } from '@main/db/connection'
import { migrate } from '@main/db/migrate'
import { seed } from '@main/db/seed'
import { createRepos } from '@main/repositories'
import type { Clock, ServiceContext } from '@main/services/context'

export interface TestContext extends ServiceContext {
  clock: Clock & { set(date: string): void }
}

/** Base en memoria con las migraciones reales y (opcional) el seed. */
export function createTestContext(today = '2026-10-15', { withSeed = true } = {}): TestContext {
  const db = openDatabase(':memory:')
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
