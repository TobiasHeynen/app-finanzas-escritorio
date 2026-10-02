import { app } from 'electron'
import { createBackupActions } from '../backups'
import { exportToFile, revealLastExport } from '../export-file'
import { dbPath } from '../paths'
import type { Services } from '../services'
import { createCoreHandlers } from '@core/api/handlers'
import type { IpcHandlers } from '@core/api/dispatch'

const ok = { ok: true } as const

export function createHandlers(services: Services): IpcHandlers {
  const { clock } = services.ctx
  const backups = createBackupActions(services.ctx.db)
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
  }
}
