import { app } from 'electron'
import type { Services } from '../services'
import type { IpcHandlers } from './dispatch'

export function createHandlers(_services: Services): IpcHandlers {
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
