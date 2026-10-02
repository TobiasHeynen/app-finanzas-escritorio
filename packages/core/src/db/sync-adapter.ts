import type { SqlDb, SqlRunResult, SqlStatement } from './sql'

type BindValue = string | number | null
type BindParams = Record<string, BindValue> | BindValue[]

/**
 * Lo que usamos de la API sincrónica de expo-sqlite (`SQLiteDatabase`), escrito a mano para que core
 * no dependa de expo. Diferencias con better-sqlite3 que cubre el adaptador:
 * - los parámetros con nombre van con el prefijo en la clave (`{ '@monto': 1 }`);
 * - un parámetro con nombre que falta queda NULL en silencio (better-sqlite3 tira error);
 * - `getFirstSync` devuelve `null` cuando no hay fila;
 * - `runSync` devuelve `lastInsertRowId` (con "Id").
 */
export interface SyncSqliteDatabase {
  execSync(source: string): void
  runSync(source: string, params: BindParams): { lastInsertRowId: number; changes: number }
  getFirstSync(source: string, params: BindParams): unknown
  getAllSync(source: string, params: BindParams): unknown[]
}

const NAMED_PARAM = /@([A-Za-z_][A-Za-z0-9_]*)/g

/** Nombres de los parámetros `@nombre` del SQL, ignorando lo que está entre comillas. */
export function namedParams(sql: string): string[] {
  const code = sql.replace(/'(?:[^']|'')*'/g, "''")
  return [...new Set([...code.matchAll(NAMED_PARAM)].map((m) => m[1] ?? ''))]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toBindValue(value: unknown, where: string): BindValue {
  if (value === undefined) return null
  if (value === null || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Valor inválido para ${where}: ${String(value)}`)
    return value
  }
  if (typeof value === 'bigint') return Number(value)
  throw new Error(`Tipo no soportado para ${where}: ${typeof value}`)
}

/** Convierte los parámetros al estilo better-sqlite3 en los de expo-sqlite. */
export function toExpoParams(sql: string, params: unknown[], names = namedParams(sql)): BindParams {
  const [first] = params
  if (params.length === 1 && isPlainObject(first)) {
    const out: Record<string, BindValue> = {}
    for (const name of names) {
      if (!(name in first)) throw new Error(`Falta el parámetro @${name}`)
      out[`@${name}`] = toBindValue(first[name], `@${name}`)
    }
    return out
  }
  return params.map((p, i) => toBindValue(p, `el parámetro ${String(i + 1)}`))
}

/** Adapta una base de expo-sqlite (API sincrónica) a la interfaz SqlDb que usa core. */
export function wrapSyncSqlite(db: SyncSqliteDatabase): SqlDb {
  let depth = 0
  let savepoints = 0

  const statement = (sql: string): SqlStatement<unknown[], unknown> => {
    const names = namedParams(sql)
    return {
      run: (...params): SqlRunResult => {
        const r = db.runSync(sql, toExpoParams(sql, params, names))
        return { changes: r.changes, lastInsertRowid: r.lastInsertRowId }
      },
      get: (...params) => db.getFirstSync(sql, toExpoParams(sql, params, names)) ?? undefined,
      all: (...params) => db.getAllSync(sql, toExpoParams(sql, params, names)),
    }
  }

  return {
    prepare: statement as SqlDb['prepare'],
    exec: (sql) => db.execSync(sql),
    // Igual que better-sqlite3: anidar una transacción adentro de otra usa un SAVEPOINT.
    transaction:
      <T>(fn: () => T) =>
      (): T => {
        const savepoint = depth > 0 ? `sp_${String(++savepoints)}` : null
        db.execSync(savepoint ? `SAVEPOINT ${savepoint}` : 'BEGIN')
        depth++
        try {
          const result = fn()
          depth--
          db.execSync(savepoint ? `RELEASE ${savepoint}` : 'COMMIT')
          return result
        } catch (err) {
          depth--
          db.execSync(savepoint ? `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}` : 'ROLLBACK')
          throw err
        }
      },
  }
}
