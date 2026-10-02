import Database from 'better-sqlite3'
import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { basename, join } from 'node:path'
import {
  backupReasonOf,
  backupsToPrune,
  BACKUPS_TO_KEEP,
  sortBackupNames,
  uniqueBackupName,
  validateBackupDb,
  type BackupReason,
} from '@core/db/backup-rules'
import { AppError } from '@shared/errors'
import type { Db } from './connection'

export { BACKUPS_TO_KEEP, isBackupName, type BackupReason } from '@core/db/backup-rules'

export interface BackupInfo {
  name: string
  reason: BackupReason
  createdAt: string
  sizeBytes: number
}

export function listBackups(dir: string): BackupInfo[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return []
  }
  return sortBackupNames(names).map((name) => {
    const stat = statSync(join(dir, name))
    return {
      name,
      reason: backupReasonOf(name) ?? 'manual',
      createdAt: stat.mtime.toISOString(),
      sizeBytes: stat.size,
    }
  })
}

/** Borra los más viejos de cada tipo, dejando los últimos `keep`. */
export function pruneBackups(dir: string, keep = BACKUPS_TO_KEEP): string[] {
  const removed = backupsToPrune(
    listBackups(dir).map((b) => b.name),
    keep,
  )
  for (const name of removed) unlinkSync(join(dir, name))
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
  const name = uniqueBackupName(reason, now, new Set(listBackups(dir).map((b) => b.name)))
  await db.backup(join(dir, name))
  pruneBackups(dir)
  const info = listBackups(dir).find((b) => b.name === name)
  if (!info) throw new Error('No se encontró el backup recién creado')
  return info
}

/**
 * Verifica que un archivo sea una base de Chanchito sana y que esta versión de la app la
 * entienda (ver `validateBackupDb` en core).
 */
export function validateBackupFile(file: string): { schemaVersion: number } {
  let candidate: Database.Database
  try {
    candidate = new Database(file, { readonly: true, fileMustExist: true })
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new AppError(
      'VALIDATION',
      `"${basename(file)}" no es un backup válido de Chanchito (${reason}).`,
    )
  }
  try {
    return validateBackupDb(candidate, basename(file))
  } finally {
    candidate.close()
  }
}
