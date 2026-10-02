import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite'
import { initDatabase } from '@core/db/init'
import { getSchemaVersion, pendingMigrations } from '@core/db/migrate'
import { wrapSyncSqlite } from '@core/db/sync-adapter'
import { createRepos } from '@core/repositories'
import { createServices, type Services } from '@core/services'
import { systemClock } from '@core/services/context'
import { initApi } from './api'
import { DB_NAME } from './db-name'
import { createBackup, registerBackupHandlers } from './backups'
import { registerExportHandlers } from './export'

export interface AppServices {
  services: Services
  seeded: boolean
}

let current: AppServices | null = null

/**
 * Abre la base (sincrónico), aplica migraciones, siembra la primera vez y genera los recurrentes que
 * falten. Se llama una vez al arrancar; después devuelve lo mismo.
 */
export function getAppServices(): AppServices {
  if (current) return current
  const raw = openDatabaseSync(DB_NAME)
  raw.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  const db = wrapSyncSqlite(raw)
  // Antes de migrar una base existente, se respalda (por si la migración sale mal).
  if (getSchemaVersion(db) > 0 && pendingMigrations(db).length > 0) {
    safeBackup(raw, 'pre-migracion')
  }
  const { seeded } = initDatabase(db)
  // Backup de cada inicio (una base recién creada no hace falta).
  if (!seeded) safeBackup(raw, 'inicio')
  const services = createServices({ db, repos: createRepos(db), clock: systemClock })
  services.recurring.generateDue()
  initApi(services)
  registerExportHandlers(services)
  registerBackupHandlers(raw)
  current = { services, seeded }
  return current
}

/** Un backup automático que falla no puede impedir que la app arranque. */
function safeBackup(raw: SQLiteDatabase, reason: 'inicio' | 'pre-migracion'): void {
  try {
    createBackup(raw, reason)
  } catch (err) {
    console.error(`No se pudo hacer el backup de ${reason}`, err)
  }
}
