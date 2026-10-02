import { migrate } from './migrate'
import { seed } from './seed'
import type { SqlDb } from './sql'

const SOFT_DELETE_RETENTION_DAYS = 30

export interface InitResult {
  appliedMigrations: number[]
  seeded: boolean
}

/**
 * Deja lista una base recién abierta: aplica migraciones pendientes, siembra la primera vez y purga
 * lo borrado hace más de 30 días (el "deshacer" sólo necesita unos segundos; el margen es por seguridad).
 */
export function initDatabase(db: SqlDb): InitResult {
  const appliedMigrations = migrate(db)
  const seeded = seed(db)
  purgeSoftDeleted(db)
  return { appliedMigrations, seeded }
}

export function purgeSoftDeleted(db: SqlDb, now = new Date()): void {
  const cutoff = new Date(now.getTime() - SOFT_DELETE_RETENTION_DAYS * 86_400_000).toISOString()
  db.transaction(() => {
    for (const table of ['expenses', 'incomes', 'savings_movements']) {
      db.prepare(`DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < ?`).run(cutoff)
    }
    db.prepare(
      `DELETE FROM installment_plans WHERE id NOT IN
        (SELECT installment_plan_id FROM expenses WHERE installment_plan_id IS NOT NULL)`,
    ).run()
  })()
}
