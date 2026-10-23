import { AppState } from 'react-native'
import { fetch as expoFetch } from 'expo/fetch'
import { File, Paths } from 'expo-file-system'
import type { SQLiteDatabase } from 'expo-sqlite'
import { withoutWal } from '@core/db/backup-rules'
import { createCloudBackup, type CloudState } from '@core/cloud/cloud-backup'
import type { FetchLike } from '@core/cloud/drive'
import { addHandlers } from './api'
import { restoreFromBytes } from './backups'
import { createGoogleAuth } from './cloud-auth'

const stateFile = () => new File(Paths.document, 'nube.json')

/** `fetch` de Expo: maneja bien cuerpos y respuestas binarias (el de React Native no). */
const fetchBinary: FetchLike = (url, init = {}) => {
  const body = init.body instanceof Uint8Array ? init.body.slice().buffer : init.body
  return expoFetch(url, { method: init.method, headers: init.headers, body })
}

/** Id del dispositivo (no es un secreto: sólo separa los backups de cada uno). Hermes no tiene `crypto`. */
const randomId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`

/**
 * Backup en Google Drive del celu (ver `@core/cloud/cloud-backup`): uno por día al abrir la app y al pasar a
 * segundo plano si hubo cambios.
 */
export function registerCloudHandlers(raw: SQLiteDatabase): void {
  const cloud = createCloudBackup({
    auth: createGoogleAuth(),
    fetch: fetchBinary,
    platform: 'android',
    deviceName: 'Celular',
    store: {
      load() {
        try {
          const file = stateFile()
          if (!file.exists) return null
          const data = JSON.parse(file.textSync()) as Partial<CloudState>
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
      save(state) {
        const file = stateFile()
        if (!file.exists) file.create()
        file.write(JSON.stringify(state))
      },
    },
    snapshot: () => withoutWal(raw.serializeSync()),
    changeCounter: () => raw.getFirstSync<{ n: number }>('SELECT total_changes() AS n')?.n ?? 0,
    restore: (bytes, label) => restoreFromBytes(raw, bytes, label),
    randomId,
  })

  addHandlers({
    'cloud:status': () => cloud.status(),
    'cloud:connect': () => cloud.connect(),
    'cloud:disconnect': async () => {
      await cloud.disconnect()
      return { ok: true } as const
    },
    'cloud:backupNow': () => cloud.backupNow(),
    'cloud:list': () => cloud.list(),
    'cloud:restore': ({ id }) => cloud.restore(id),
  })

  void cloud.auto('start')
  AppState.addEventListener('change', (state) => {
    if (state === 'background') void cloud.auto('close')
  })
}
