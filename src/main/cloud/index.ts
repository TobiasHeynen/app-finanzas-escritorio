import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { withoutWal } from '@core/db/backup-rules'
import { createCloudBackup, type CloudState } from '@core/cloud/cloud-backup'
import type { BackupActions } from '../backups'
import type { Db } from '../db/connection'
import { createGoogleAuth } from './google-auth'

const stateFile = () => join(app.getPath('userData'), 'nube.json')

/** Backup en Google Drive de la PC (ver `@core/cloud/cloud-backup`). */
export function createDesktopCloud(db: Db, backups: BackupActions) {
  return createCloudBackup({
    auth: createGoogleAuth(),
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60_000) }),
    platform: 'pc',
    deviceName: 'PC',
    store: {
      load() {
        try {
          const data = JSON.parse(readFileSync(stateFile(), 'utf8')) as Partial<CloudState>
          if (typeof data.deviceId !== 'string') return null
          return {
            deviceId: data.deviceId,
            lastBackupAt: typeof data.lastBackupAt === 'string' ? data.lastBackupAt : null,
            lastError: typeof data.lastError === 'string' ? data.lastError : null,
          }
        } catch {
          return null
        }
      },
      save: (state) => writeFileSync(stateFile(), JSON.stringify(state)),
    },
    // Con la API de backup de SQLite: una copia consistente aunque la base esté en uso.
    async snapshot() {
      const file = join(app.getPath('userData'), `nube-${randomUUID()}.db`)
      try {
        await db.backup(file)
        return withoutWal(readFileSync(file))
      } finally {
        rmSync(file, { force: true })
      }
    },
    changeCounter: () =>
      (db.prepare('SELECT total_changes() AS n').get() as { n: number } | undefined)?.n ?? 0,
    restore: (bytes) => backups.restoreFromBytes(bytes),
    randomId: () => randomUUID(),
  })
}

export type DesktopCloud = ReturnType<typeof createDesktopCloud>
