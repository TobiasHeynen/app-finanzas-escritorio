import { backupDatabaseSync, deserializeDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'
import {
  backupReasonOf,
  backupsToPrune,
  isBackupName,
  looksLikeSqlite,
  sortBackupNames,
  uniqueBackupName,
  validateBackupDb,
  withoutWal,
  type BackupReason,
} from '@core/db/backup-rules'
import { wrapSyncSqlite } from '@core/db/sync-adapter'
import { AppError } from '@shared/errors'
import { addHandlers } from './api'
import { backupStore } from './backup-store'
import { pickFile, reloadApp } from './platform'

export interface BackupInfo {
  name: string
  reason: BackupReason
  createdAt: string
  sizeBytes: number
}

export function listBackups(): BackupInfo[] {
  const byName = new Map(backupStore.list().map((b) => [b.name, b]))
  return sortBackupNames([...byName.keys()]).flatMap((name) => {
    const b = byName.get(name)
    return b
      ? [
          {
            name,
            reason: backupReasonOf(name) ?? 'manual',
            createdAt: b.modifiedAt,
            sizeBytes: b.sizeBytes,
          },
        ]
      : []
  })
}

/**
 * Backup = imagen de la base (`serialize`) guardada como archivo, con el mismo nombre y formato que los de
 * la PC: se puede restaurar en cualquiera de las dos.
 */
export function createBackup(raw: SQLiteDatabase, reason: BackupReason): BackupInfo {
  const existing = new Set(backupStore.list().map((b) => b.name))
  const name = uniqueBackupName(reason, new Date(), existing)
  backupStore.write(name, withoutWal(raw.serializeSync()))
  for (const old of backupsToPrune([...existing, name])) backupStore.remove(old)
  const info = listBackups().find((b) => b.name === name)
  if (!info) throw new Error('No se encontró el backup recién creado')
  return info
}

let restoring = false

/**
 * Valida la base elegida en memoria, hace un backup de seguridad de la actual, copia la elegida encima con
 * la API de backup de SQLite y reinicia la app (al arrancar se aplican las migraciones que falten).
 */
export function restoreFromBytes(
  raw: SQLiteDatabase,
  bytes: Uint8Array,
  label: string,
): { restarting: boolean } {
  if (restoring) throw new AppError('CONFLICT', 'Ya se está restaurando un backup')
  if (!looksLikeSqlite(bytes)) {
    throw new AppError(
      'VALIDATION',
      `"${label}" no es un backup de Chanchito (no es una base SQLite).`,
    )
  }
  let candidate: SQLiteDatabase
  try {
    candidate = deserializeDatabaseSync(withoutWal(bytes))
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new AppError('VALIDATION', `"${label}" no es un backup válido de Chanchito (${reason}).`)
  }
  restoring = true
  try {
    validateBackupDb(wrapSyncSqlite(candidate), label)
    createBackup(raw, 'pre-restauracion')
    backupDatabaseSync({ sourceDatabase: candidate, destDatabase: raw })
  } catch (err) {
    restoring = false
    throw err
  } finally {
    candidate.closeSync()
  }
  // Se responde a la pantalla y después se reinicia con la base restaurada.
  setTimeout(reloadApp, 600)
  return { restarting: true }
}

export function shareBackup(name: string): Promise<boolean> {
  if (!isBackupName(name)) throw new AppError('VALIDATION', 'Nombre de backup inválido')
  return backupStore.share(name)
}

export function registerBackupHandlers(raw: SQLiteDatabase): void {
  addHandlers({
    'backups:list': () => listBackups(),
    'backups:create': () => createBackup(raw, 'manual'),
    'backups:restore': ({ name }) => {
      if (!isBackupName(name)) throw new AppError('VALIDATION', 'Nombre de backup inválido')
      let bytes: Uint8Array
      try {
        bytes = backupStore.read(name)
      } catch {
        throw new AppError('NOT_FOUND', 'El backup ya no existe')
      }
      return restoreFromBytes(raw, bytes, name)
    },
    'backups:restoreFromFile': async () => {
      const picked = await pickFile()
      if (!picked) return { restarting: false }
      return restoreFromBytes(raw, picked.bytes, picked.name)
    },
  })
}
