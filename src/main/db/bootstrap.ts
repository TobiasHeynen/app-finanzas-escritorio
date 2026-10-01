import { openDatabase, type Db } from './connection'
import { migrate } from './migrate'
import { seed } from './seed'

const SOFT_DELETE_RETENTION_DAYS = 30

export interface BootstrapResult {
  db: Db
  appliedMigrations: number[]
  seeded: boolean
}

/**
 * Abre la base, aplica migraciones pendientes, siembra la primera vez y purga lo borrado hace
 * más de 30 días (el "deshacer" sólo necesita unos segundos; el margen es por seguridad).
 */
export function bootstrapDatabase(filename: string, beforeMigrate?: (db: Db) => void): BootstrapResult {
  const db = openDatabase(filename)
  try {
    beforeMigrate?.(db)
    const appliedMigrations = migrate(db)
    const seeded = seed(db)
    purgeSoftDeleted(db)
    return { db, appliedMigrations, seeded }
  } catch (err) {
    db.close()
    throw err
  }
}

export function purgeSoftDeleted(db: Db, now = new Date()): void {
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
