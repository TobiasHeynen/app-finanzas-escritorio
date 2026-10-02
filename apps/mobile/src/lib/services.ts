import { openDatabaseSync } from 'expo-sqlite'
import { initDatabase } from '@core/db/init'
import { wrapSyncSqlite } from '@core/db/sync-adapter'
import { createRepos } from '@core/repositories'
import { createServices, type Services } from '@core/services'
import { systemClock } from '@core/services/context'

/** Mismo nombre de archivo que en la PC: un backup de un lado se restaura en el otro. */
export const DB_NAME = 'finanzas.db'

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
  const { seeded } = initDatabase(db)
  const services = createServices({ db, repos: createRepos(db), clock: systemClock })
  services.recurring.generateDue()
  current = { services, seeded }
  return current
}
