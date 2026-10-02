import Database from 'better-sqlite3'
import { namedParams, type SyncSqliteDatabase } from '@core/db/sync-adapter'

type Params = Record<string, unknown> | unknown[]

/**
 * Imita la API sincrónica de expo-sqlite sobre better-sqlite3, con sus diferencias: claves con prefijo
 * (`@nombre`), parámetros con nombre faltantes en NULL, booleanos como 0/1 y `null` cuando no hay fila.
 */
export function fakeExpoSqlite(
  filename = ':memory:',
): SyncSqliteDatabase & { raw: Database.Database } {
  const raw = new Database(filename)
  raw.pragma('foreign_keys = ON')

  const bind = (sql: string, params: Params): unknown[] => {
    const norm = (v: unknown) => (typeof v === 'boolean' ? Number(v) : v)
    if (Array.isArray(params)) return params.map(norm)
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (!/^[@$:]/.test(key)) continue // expo no encuentra el parámetro y lo ignora
      out[key.slice(1)] = norm(value)
    }
    for (const name of namedParams(sql)) {
      if (!(name in out)) out[name] = null // expo deja NULL lo que falta, sin error
    }
    return [out]
  }

  return {
    raw,
    execSync: (source) => {
      raw.exec(source)
    },
    runSync: (source, params) => {
      const r = raw.prepare(source).run(...bind(source, params))
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes }
    },
    getFirstSync: (source: string, params: Params) => {
      const stmt = raw.prepare(source)
      return stmt.reader ? (stmt.get(...bind(source, params)) ?? null) : null
    },
    getAllSync: (source: string, params: Params) => {
      const stmt = raw.prepare(source)
      return stmt.reader ? stmt.all(...bind(source, params)) : []
    },
  }
}
