import Database from 'better-sqlite3'
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { basename, join } from 'node:path'
import { AppError } from '@shared/errors'
import type { Db } from './connection'
import { migrations } from '@core/db/migrations'

export type BackupReason = 'inicio' | 'manual' | 'pre-migracion' | 'pre-restauracion'

export interface BackupInfo {
  name: string
  reason: BackupReason
  createdAt: string
  sizeBytes: number
}

/** Cuántos backups se guardan de cada tipo. */
export const BACKUPS_TO_KEEP = 15

const NAME_RE = /^finanzas-(\d{8})-(\d{6})-(inicio|manual|pre-migracion|pre-restauracion)\.db$/

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

function backupName(reason: BackupReason, now: Date): string {
  const date = `${String(now.getFullYear())}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `finanzas-${date}-${time}-${reason}.db`
}

export function isBackupName(name: string): boolean {
  return NAME_RE.test(name)
}

export function listBackups(dir: string): BackupInfo[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return names
    .flatMap((name) => {
      const m = NAME_RE.exec(name)
      if (!m) return []
      const stat = statSync(join(dir, name))
      return [
        {
          name,
          reason: m[3] as BackupReason,
          createdAt: stat.mtime.toISOString(),
          sizeBytes: stat.size,
        },
      ]
    })
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
}

/** Borra los más viejos de cada tipo, dejando los últimos `keep`. */
export function pruneBackups(dir: string, keep = BACKUPS_TO_KEEP): string[] {
  const removed: string[] = []
  const seen = new Map<BackupReason, number>()
  for (const b of listBackups(dir)) {
    const count = (seen.get(b.reason) ?? 0) + 1
    seen.set(b.reason, count)
    if (count > keep) {
      unlinkSync(join(dir, b.name))
      removed.push(b.name)
    }
  }
  return removed
}

/**
 * Backup con la API de backup de SQLite (consistente aunque la base esté abierta y en WAL).
 * Si en el mismo segundo ya hay uno con ese nombre, se le agrega un sufijo.
 */
export async function createBackup(
  db: Db,
  dir: string,
  reason: BackupReason,
  now = new Date(),
): Promise<BackupInfo> {
  mkdirSync(dir, { recursive: true })
  let name = backupName(reason, now)
  const existing = new Set(listBackups(dir).map((b) => b.name))
  for (let i = 1; existing.has(name); i++) {
    name = backupName(reason, new Date(now.getTime() + i * 1000))
  }
  await db.backup(join(dir, name))
  pruneBackups(dir)
  const info = listBackups(dir).find((b) => b.name === name)
  if (!info) throw new Error('No se encontró el backup recién creado')
  return info
}

/**
 * Verifica que un archivo sea una base de Chanchito sana y que esta versión de la app la
 * entienda: integrity_check, tablas esperadas y versión de schema no más nueva que la de la app.
 */
export function validateBackupFile(file: string): { schemaVersion: number } {
  let candidate: Database.Database | null = null
  try {
    candidate = new Database(file, { readonly: true, fileMustExist: true })
    const integrity = candidate.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') throw new Error(String(integrity))
    const tables = new Set(
      (
        candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
          name: string
        }[]
      ).map((r) => r.name),
    )
    for (const t of ['schema_migrations', 'categories', 'expenses', 'incomes']) {
      if (!tables.has(t)) throw new Error(`falta la tabla ${t}`)
    }
    const row = candidate.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as {
      v: number | null
    }
    const schemaVersion = row.v ?? 0
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
    throw new AppError(
      'VALIDATION',
      `"${basename(file)}" no es un backup válido de Chanchito (${reason}).`,
    )
  } finally {
    candidate?.close()
  }
}
