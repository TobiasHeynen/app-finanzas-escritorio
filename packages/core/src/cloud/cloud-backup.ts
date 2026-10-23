import { AppError } from '@shared/errors'
import type { CloudBackupInfo, CloudStatus } from '@shared/types'
import { createDriveClient, type DriveFile, type FetchLike } from './drive'

/**
 * Backup automático en la carpeta oculta de Chanchito en el Drive del usuario. Es opcional: sin cuenta
 * conectada no hace nada. Se sube la misma imagen de la base que usan los backups locales (sirve en la PC
 * y en el celu) y se guardan los últimos `CLOUD_BACKUPS_TO_KEEP` de cada dispositivo.
 */

export const CLOUD_BACKUPS_TO_KEEP = 7

/** Con la app abierta, un backup por día como mucho (al iniciar). */
export const DAILY_MS = 24 * 60 * 60 * 1000
/** Al cerrar (o pasar a segundo plano en el celu), sólo si hubo cambios y pasó este tiempo. */
export const MIN_GAP_ON_CLOSE_MS = 10 * 60 * 1000

export type CloudPlatform = CloudBackupInfo['platform']
export type AutoTrigger = 'start' | 'close'

/** Sesión de Google de cada plataforma (navegador + PKCE en la PC, selector nativo en Android). */
export interface CloudAuth {
  /** false si esta compilación no tiene el cliente OAuth configurado. */
  isAvailable(): boolean
  account(): { email: string } | null
  connect(): Promise<{ email: string }>
  disconnect(): Promise<void>
  getAccessToken(forceRefresh?: boolean): Promise<string>
}

export interface CloudState {
  deviceId: string
  lastBackupAt: string | null
  lastError: string | null
}

export interface CloudStateStore {
  load(): CloudState | null
  save(state: CloudState): void
}

export interface CloudBackupDeps {
  auth: CloudAuth
  fetch: FetchLike
  store: CloudStateStore
  platform: CloudPlatform
  /** Nombre que se muestra al restaurar en otro dispositivo ("PC", "Celular"). */
  deviceName: string
  /** Imagen de la base lista para restaurar (sin WAL). */
  snapshot(): Uint8Array | Promise<Uint8Array>
  /** Contador de cambios de la conexión (SQLite `total_changes()`). */
  changeCounter(): number
  /** Restaura los bytes con el mismo camino que un backup local. */
  restore(
    bytes: Uint8Array,
    label: string,
  ): { restarting: boolean } | Promise<{ restarting: boolean }>
  randomId(): string
  now?: () => Date
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `chanchito-<plataforma>-AAAAMMDD-HHMMSS.db` con la hora local. */
export function cloudBackupFileName(platform: CloudPlatform, now: Date): string {
  const date = `${String(now.getFullYear())}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `chanchito-${platform}-${date}-${time}.db`
}

const isOurs = (f: DriveFile) => f.appProperties['app'] === 'chanchito'

/** Los del dispositivo `deviceId` que sobran (deja los `keep` más nuevos). Los de otros no se tocan. */
export function cloudBackupsToPrune(
  files: DriveFile[],
  deviceId: string,
  keep = CLOUD_BACKUPS_TO_KEEP,
): DriveFile[] {
  return files
    .filter((f) => isOurs(f) && f.appProperties['device'] === deviceId)
    .sort((a, b) => (a.createdTime < b.createdTime ? 1 : a.createdTime > b.createdTime ? -1 : 0))
    .slice(keep)
}

/** ¿Toca backup automático? */
export function shouldAutoBackup(opts: {
  trigger: AutoTrigger
  now: Date
  lastBackupAt: string | null
  changed: boolean
}): boolean {
  const last = opts.lastBackupAt ? Date.parse(opts.lastBackupAt) : NaN
  const elapsed = Number.isNaN(last) ? Infinity : opts.now.getTime() - last
  if (opts.trigger === 'start') return elapsed >= DAILY_MS
  return opts.changed && elapsed >= MIN_GAP_ON_CLOSE_MS
}

export function createCloudBackup(deps: CloudBackupDeps) {
  const now = deps.now ?? (() => new Date())
  const drive = createDriveClient({
    fetch: deps.fetch,
    getAccessToken: (force) => deps.auth.getAccessToken(force),
  })

  let state: CloudState = deps.store.load() ?? {
    deviceId: deps.randomId(),
    lastBackupAt: null,
    lastError: null,
  }
  const save = (patch: Partial<CloudState>) => {
    state = { ...state, ...patch }
    deps.store.save(state)
  }
  // Los cambios se cuentan desde que arrancó la app (o desde el último backup).
  let changesAtLastBackup = deps.changeCounter()
  let running: Promise<CloudStatus> | null = null

  function status(): CloudStatus {
    const account = deps.auth.isAvailable() ? deps.auth.account() : null
    return {
      available: deps.auth.isAvailable(),
      connected: account !== null,
      email: account?.email ?? null,
      lastBackupAt: account ? state.lastBackupAt : null,
      lastError: account ? state.lastError : null,
    }
  }

  function requireConnected() {
    if (!deps.auth.isAvailable()) {
      throw new AppError(
        'FORBIDDEN',
        'El backup en Google Drive no está disponible en esta versión',
      )
    }
    if (!deps.auth.account()) throw new AppError('FORBIDDEN', 'Conectá tu cuenta de Google primero')
  }

  async function upload(): Promise<CloudStatus> {
    requireConnected()
    const changes = deps.changeCounter()
    try {
      const bytes = await deps.snapshot()
      const at = now()
      await drive.upload(cloudBackupFileName(deps.platform, at), bytes, {
        app: 'chanchito',
        device: state.deviceId,
        deviceName: deps.deviceName,
        platform: deps.platform,
      })
      changesAtLastBackup = changes
      save({ lastBackupAt: at.toISOString(), lastError: null })
    } catch (err) {
      save({ lastError: err instanceof Error ? err.message : String(err) })
      throw err
    }
    // La rotación no es crítica: si falla, se reintenta en el próximo backup.
    try {
      const files = await drive.list()
      for (const old of cloudBackupsToPrune(files, state.deviceId)) await drive.remove(old.id)
    } catch {
      /* ignorado */
    }
    return status()
  }

  /** Un solo backup a la vez: si ya hay uno en curso, se espera ese. */
  function backupNow(): Promise<CloudStatus> {
    running ??= upload().finally(() => {
      running = null
    })
    return running
  }

  return {
    status,

    async connect(): Promise<CloudStatus> {
      if (!deps.auth.isAvailable()) {
        throw new AppError(
          'FORBIDDEN',
          'El backup en Google Drive no está disponible en esta versión',
        )
      }
      await deps.auth.connect()
      save({ lastBackupAt: null, lastError: null })
      return status()
    },

    async disconnect(): Promise<void> {
      await deps.auth.disconnect()
      save({ lastBackupAt: null, lastError: null })
    },

    backupNow,

    async list(): Promise<CloudBackupInfo[]> {
      requireConnected()
      const files = await drive.list()
      return files.filter(isOurs).map((f) => ({
        id: f.id,
        createdAt: f.createdTime,
        sizeBytes: f.size,
        deviceName: f.appProperties['deviceName'] ?? 'Otro dispositivo',
        platform: f.appProperties['platform'] === 'android' ? 'android' : 'pc',
        thisDevice: f.appProperties['device'] === state.deviceId,
      }))
    },

    async restore(id: string): Promise<{ restarting: boolean }> {
      requireConnected()
      const bytes = await drive.download(id)
      return deps.restore(bytes, 'el backup de Google Drive')
    },

    /** Backup automático según el momento. Nunca tira: el error queda en el estado. */
    async auto(trigger: AutoTrigger): Promise<void> {
      if (!deps.auth.isAvailable() || !deps.auth.account()) return
      const due = shouldAutoBackup({
        trigger,
        now: now(),
        lastBackupAt: state.lastBackupAt,
        changed: deps.changeCounter() !== changesAtLastBackup,
      })
      if (!due) return
      try {
        await backupNow()
      } catch {
        /* queda en lastError */
      }
    },
  }
}

export type CloudBackup = ReturnType<typeof createCloudBackup>
