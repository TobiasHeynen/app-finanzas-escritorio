import { app } from 'electron'
import type { IpcHandlers } from './dispatch'

export function createHandlers(): IpcHandlers {
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
  }
}
