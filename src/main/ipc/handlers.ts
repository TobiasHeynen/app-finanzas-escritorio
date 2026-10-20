import { app } from 'electron'
import type { BackupActions } from '../backups'
import type { DesktopCloud } from '../cloud'
import { exportToFile, revealLastExport } from '../export-file'
import { dbPath } from '../paths'
import type { Services } from '../services'
import { createCoreHandlers } from '@core/api/handlers'
import type { IpcHandlers } from '@core/api/dispatch'

const ok = { ok: true } as const

export function createHandlers(
  services: Services,
  backups: BackupActions,
  cloud: DesktopCloud,
): IpcHandlers {
  const { clock } = services.ctx
  return {
    'app:ping': ({ message }) => ({
      reply: `pong: ${message}`,
      receivedAt: new Date().toISOString(),
      versions: {
        app: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
      },
    }),
    'app:info': () => ({ version: app.getVersion(), dataPath: dbPath(), today: clock.today() }),

    ...createCoreHandlers(services),

    // Exportación
    'export:run': (req) => exportToFile(services.exporter, req),
    'export:reveal': () => {
      revealLastExport()
      return ok
    },

    // Backups
    'backups:list': () => backups.list(),
    'backups:create': () => backups.create(),
    'backups:openFolder': async () => {
      await backups.openFolder()
      return ok
    },
    'backups:restore': ({ name }) => backups.restore(name),
    'backups:restoreFromFile': () => backups.restoreFromFile(),

    // Backup en Google Drive
    'cloud:status': () => cloud.status(),
    'cloud:connect': () => cloud.connect(),
    'cloud:disconnect': async () => {
      await cloud.disconnect()
      return ok
    },
    'cloud:backupNow': () => cloud.backupNow(),
    'cloud:list': () => cloud.list(),
    'cloud:restore': ({ id }) => cloud.restore(id),
  }
}
