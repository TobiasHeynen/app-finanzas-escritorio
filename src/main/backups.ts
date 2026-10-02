import { app, BrowserWindow, dialog, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { AppError } from '@shared/errors'
import {
  createBackup,
  isBackupName,
  listBackups,
  validateBackupFile,
  type BackupInfo,
} from './db/backup'
import { openDatabase, type Db } from './db/connection'
import { getSchemaVersion, pendingMigrations } from './db/migrate'
import { backupsDir, dbPath } from './paths'

/** Antes de migrar una base existente, la respalda (por si la migración sale mal). */
export async function backupBeforeMigrations(): Promise<void> {
  if (!existsSync(dbPath())) return
  const db = openDatabase(dbPath())
  try {
    if (getSchemaVersion(db) > 0 && pendingMigrations(db).length > 0) {
      await createBackup(db, backupsDir(), 'pre-migracion')
    }
  } finally {
    db.close()
  }
}

export function createBackupActions(db: Db) {
  let restoring = false

  async function restoreFrom(file: string): Promise<{ restarting: boolean }> {
    if (restoring) throw new AppError('CONFLICT', 'Ya se está restaurando un backup')
    validateBackupFile(file)
    restoring = true
    const target = dbPath()
    const staged = `${target}.restaurando`
    let closed = false
    try {
      // Copia primero el elegido (por si el backup de seguridad rota el archivo que se restaura).
      copyFileSync(file, staged)
      await createBackup(db, backupsDir(), 'pre-restauracion')
      db.close()
      closed = true
      for (const suffix of ['-wal', '-shm']) rmSync(`${target}${suffix}`, { force: true })
      renameSync(staged, target)
    } catch (err) {
      restoring = false
      rmSync(staged, { force: true })
      // Con la base ya cerrada la app no puede seguir: se reinicia con la base original.
      if (closed) {
        app.relaunch()
        app.exit(1)
      }
      throw err
    }
    // Se responde al renderer y después se reinicia con la base restaurada.
    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 600)
    return { restarting: true }
  }

  return {
    list: (): BackupInfo[] => listBackups(backupsDir()),
    create: (): Promise<BackupInfo> => createBackup(db, backupsDir(), 'manual'),
    async openFolder(): Promise<void> {
      mkdirSync(backupsDir(), { recursive: true })
      const error = await shell.openPath(backupsDir())
      if (error) throw new AppError('INTERNAL', `No se pudo abrir la carpeta: ${error}`)
    },
    restore(name: string) {
      if (!isBackupName(name)) throw new AppError('VALIDATION', 'Nombre de backup inválido')
      const file = join(backupsDir(), name)
      if (!existsSync(file)) throw new AppError('NOT_FOUND', 'El backup ya no existe')
      return restoreFrom(file)
    },
    async restoreFromFile(): Promise<{ restarting: boolean }> {
      const options: Electron.OpenDialogOptions = {
        title: 'Elegí un backup de Chanchito',
        defaultPath: backupsDir(),
        properties: ['openFile'],
        filters: [{ name: 'Base de datos', extensions: ['db', 'sqlite'] }],
      }
      const win = BrowserWindow.getFocusedWindow()
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      const file = result.filePaths[0]
      if (result.canceled || !file) return { restarting: false }
      return restoreFrom(file)
    },
  }
}
