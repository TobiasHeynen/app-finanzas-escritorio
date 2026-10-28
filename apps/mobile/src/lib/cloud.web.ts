import type { SQLiteDatabase } from 'expo-sqlite'
import { withoutWal } from '@core/db/backup-rules'
import { createCloudBackup, DAILY_MS, type CloudState } from '@core/cloud/cloud-backup'
import type { FetchLike } from '@core/cloud/drive'
import { addHandlers } from './api'
import { restoreFromBytes } from './backups'
import { consumeResume, createGoogleAuth, goToGoogle, hasValidToken } from './cloud-auth.web'
import { queryClient } from './query'
import { toast } from './toast'

const STATE_KEY = 'chanchito:nube'

const fetchWeb: FetchLike = (url, init = {}) =>
  fetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body instanceof Uint8Array ? new Uint8Array(init.body) : init.body,
  })

const randomId = () => crypto.randomUUID()

/**
 * Backup en Google Drive de la versión web (ver `@core/cloud/cloud-backup`). El permiso de Google dura una
 * hora: las acciones del usuario que lo necesitan pasan por Google si venció, y el backup del día se ofrece
 * con un aviso en vez de hacerlo solo (no se puede sacar al usuario de la app sin que toque nada).
 */
export function registerCloudHandlers(raw: SQLiteDatabase): void {
  const auth = createGoogleAuth()
  const cloud = createCloudBackup({
    auth,
    fetch: fetchWeb,
    platform: 'iphone',
    deviceName: 'iPhone',
    store: {
      load() {
        try {
          const data = JSON.parse(
            localStorage.getItem(STATE_KEY) ?? 'null',
          ) as Partial<CloudState> | null
          if (typeof data?.deviceId !== 'string') return null
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
        try {
          localStorage.setItem(STATE_KEY, JSON.stringify(state))
        } catch {
          /* sin almacenamiento: se pierde el estado, no los backups */
        }
      },
    },
    snapshot: () => withoutWal(raw.serializeSync()),
    changeCounter: () => raw.getFirstSync<{ n: number }>('SELECT total_changes() AS n')?.n ?? 0,
    restore: (bytes, label) => restoreFromBytes(raw, bytes, label),
    randomId,
  })

  /** Si el permiso venció, primero se pasa por Google y al volver se retoma `resume`. */
  const withToken = <T>(run: () => Promise<T>, resume: 'backup' | 'none'): Promise<T> =>
    auth.account() && !hasValidToken() ? goToGoogle(resume, { silent: true }) : run()

  addHandlers({
    'cloud:status': () => cloud.status(),
    'cloud:connect': () => cloud.connect(),
    'cloud:disconnect': async () => {
      await cloud.disconnect()
      return { ok: true } as const
    },
    'cloud:backupNow': () => withToken(() => cloud.backupNow(), 'backup'),
    'cloud:list': () => withToken(() => cloud.list(), 'none'),
    'cloud:restore': ({ id }) => withToken(() => cloud.restore(id), 'none'),
  })

  const backupAndTell = () => {
    cloud.backupNow().then(
      () => {
        toast.success('Backup subido a Google Drive')
        void queryClient.invalidateQueries()
      },
      (err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'No se pudo subir el backup')
      },
    )
  }

  const resume = consumeResume()
  if (resume === 'backup') backupAndTell()
  else if (resume === 'no-permission') {
    toast.error(
      'Para hacer el backup tenés que permitir que Chanchito guarde sus datos en tu Drive.',
    )
  } else if (resume === 'none' && auth.account()) {
    const status = cloud.status()
    const last = status.lastBackupAt ? Date.parse(status.lastBackupAt) : 0
    if (Date.now() - last >= DAILY_MS) {
      if (hasValidToken()) void cloud.auto('start')
      else {
        toast.info('Toca el backup del día en Google Drive', {
          duration: 15_000,
          action: { label: 'Hacer', onPress: () => void goToGoogle('backup', { silent: true }) },
        })
      }
    }
  }

  // Al salir de la app (o pasar a otra), si hubo cambios y el permiso sigue vigente.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && hasValidToken()) void cloud.auto('close')
  })
}
