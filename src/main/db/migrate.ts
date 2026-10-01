import type { Db } from './connection'
import { migrations as defaultMigrations, type Migration } from './migrations'

export class SchemaTooNewError extends Error {
  constructor(
    readonly dbVersion: number,
    readonly appVersion: number,
  ) {
    super(
      `La base de datos es de una versión más nueva de la app (schema ${dbVersion}, la app conoce hasta ${appVersion}).`,
    )
    this.name = 'SchemaTooNewError'
  }
}

export function getSchemaVersion(db: Db): number {
  ensureMigrationsTable(db)
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as {
    v: number | null
  }
  return row.v ?? 0
}

export function pendingMigrations(db: Db, list: Migration[] = defaultMigrations): Migration[] {
  const current = getSchemaVersion(db)
  const latest = list.at(-1)?.version ?? 0
  if (current > latest) throw new SchemaTooNewError(current, latest)
  return list.filter((m) => m.version > current)
}

/**
 * Aplica las migraciones pendientes, cada una en su transacción. Devuelve las versiones aplicadas.
 * Si una falla, se revierte esa migración y se corta (las anteriores quedan aplicadas).
 */
export function migrate(db: Db, list: Migration[] = defaultMigrations): number[] {
  const applied: number[] = []
  const insert = () =>
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
  for (const migration of pendingMigrations(db, list)) {
    db.transaction(() => {
      db.exec(migration.sql)
      insert().run(migration.version, migration.name, new Date().toISOString())
    })()
    applied.push(migration.version)
  }
  const fkErrors = db.pragma('foreign_key_check') as unknown[]
  if (fkErrors.length > 0) throw new Error('Las migraciones dejaron claves foráneas inválidas')
  return applied
}

function ensureMigrationsTable(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`)
}
