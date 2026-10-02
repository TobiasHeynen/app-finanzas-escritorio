import { AppError } from '@shared/errors'
import { migrations } from './migrations'
import type { SqlDb } from './sql'

/**
 * Reglas de los backups comunes a la PC y al celu: nombre de archivo, rotación y validación. Un backup de
 * una app se puede restaurar en la otra (mismo nombre, misma base).
 */

export type BackupReason = 'inicio' | 'manual' | 'pre-migracion' | 'pre-restauracion'

/** Cuántos backups se guardan de cada tipo. */
export const BACKUPS_TO_KEEP = 15

const NAME_RE = /^finanzas-(\d{8})-(\d{6})-(inicio|manual|pre-migracion|pre-restauracion)\.db$/

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** `finanzas-AAAAMMDD-HHMMSS-<tipo>.db` con la hora local. */
export function backupFileName(reason: BackupReason, now: Date): string {
  const date = `${String(now.getFullYear())}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `finanzas-${date}-${time}-${reason}.db`
}

/** Nombre libre para `reason` a partir de `now` (si en ese segundo ya hay uno, suma segundos). */
export function uniqueBackupName(reason: BackupReason, now: Date, existing: Set<string>): string {
  let name = backupFileName(reason, now)
  for (let i = 1; existing.has(name); i++) {
    name = backupFileName(reason, new Date(now.getTime() + i * 1000))
  }
  return name
}

export function isBackupName(name: string): boolean {
  return NAME_RE.test(name)
}

export function backupReasonOf(name: string): BackupReason | null {
  const m = NAME_RE.exec(name)
  return m ? (m[3] as BackupReason) : null
}

/** Nombres de backup válidos, del más nuevo al más viejo. */
export function sortBackupNames(names: string[]): string[] {
  return names.filter(isBackupName).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
}

/** Los que sobran: deja los últimos `keep` de cada tipo. */
export function backupsToPrune(names: string[], keep = BACKUPS_TO_KEEP): string[] {
  const removed: string[] = []
  const seen = new Map<BackupReason, number>()
  for (const name of sortBackupNames(names)) {
    const reason = backupReasonOf(name)
    if (!reason) continue
    const count = (seen.get(reason) ?? 0) + 1
    seen.set(reason, count)
    if (count > keep) removed.push(name)
  }
  return removed
}

/**
 * Verifica que una base sea de Chanchito, sana, y que esta versión de la app la entienda:
 * integrity_check, tablas esperadas y versión de schema no más nueva que la de la app.
 * `label` es el nombre del archivo para el mensaje de error.
 */
export function validateBackupDb(db: SqlDb, label: string): { schemaVersion: number } {
  try {
    const integrity = db
      .prepare<[], Record<string, unknown>>('PRAGMA integrity_check')
      .all()
      .map((r) => String(Object.values(r)[0]))
    if (integrity.join(', ') !== 'ok') throw new Error(integrity.join(', '))
    const tables = new Set(
      db
        .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((r) => r.name),
    )
    for (const t of ['schema_migrations', 'categories', 'expenses', 'incomes']) {
      if (!tables.has(t)) throw new Error(`falta la tabla ${t}`)
    }
    const row = db
      .prepare<[], { v: number | null }>('SELECT MAX(version) AS v FROM schema_migrations')
      .get()
    const schemaVersion = row?.v ?? 0
    const latest = migrations.at(-1)?.version ?? 0
    if (schemaVersion > latest) {
      throw new AppError(
        'VALIDATION',
        'El backup es de una versión más nueva de la app. Actualizá la app para restaurarlo.',
      )
    }
    return { schemaVersion }
  } catch (err) {
    if (err instanceof AppError) throw err
    const reason = err instanceof Error ? err.message : String(err)
    throw new AppError('VALIDATION', `"${label}" no es un backup válido de Chanchito (${reason}).`)
  }
}

const SQLITE_MAGIC = 'SQLite format 3\u0000'

/** Primeros bytes de un archivo SQLite. */
export function looksLikeSqlite(bytes: Uint8Array): boolean {
  if (bytes.length < 100) return false
  for (let i = 0; i < SQLITE_MAGIC.length; i++) {
    if (bytes[i] !== SQLITE_MAGIC.charCodeAt(i)) return false
  }
  return true
}

/**
 * Copia de la imagen de la base marcada como "rollback journal" en vez de WAL (bytes 18 y 19 del
 * encabezado). Así se puede abrir en memoria (sqlite3_deserialize no soporta WAL) y como archivo suelto.
 */
export function withoutWal(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes)
  if (copy[18] === 2 && copy[19] === 2) {
    copy[18] = 1
    copy[19] = 1
  }
  return copy
}
