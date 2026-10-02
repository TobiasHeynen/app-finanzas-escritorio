import { initDatabase } from '@core/db/init'
import { openDatabase, type Db } from './connection'

export interface BootstrapResult {
  db: Db
  appliedMigrations: number[]
  seeded: boolean
}

/** Abre la base con better-sqlite3 y la deja lista (migraciones, seed y purga, en core). */
export function bootstrapDatabase(
  filename: string,
  beforeMigrate?: (db: Db) => void,
): BootstrapResult {
  const db = openDatabase(filename)
  try {
    beforeMigrate?.(db)
    return { db, ...initDatabase(db) }
  } catch (err) {
    db.close()
    throw err
  }
}
