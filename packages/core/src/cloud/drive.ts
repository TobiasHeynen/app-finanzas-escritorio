import { AppError } from '@shared/errors'

/**
 * Cliente mínimo de la API de Google Drive para la carpeta oculta de la app (`appDataFolder`, scope
 * `drive.appdata`): sólo ve los archivos que creó Chanchito, nunca el resto del Drive del usuario.
 * Recibe `fetch` y el token por parámetro, así lo usan igual la PC (Node) y el celu (React Native).
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

/** Lo que usamos de `fetch` (Node y React Native lo cumplen). */
export type FetchLike = (
  url: string,
  init?: {
    method?: string
    headers?: Record<string, string>
    body?: string | Uint8Array | ArrayBuffer
  },
) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}>

export interface DriveFile {
  id: string
  name: string
  createdTime: string
  size: number
  appProperties: Record<string, string>
}

export interface DriveClient {
  list(): Promise<DriveFile[]>
  upload(name: string, bytes: Uint8Array, appProperties: Record<string, string>): Promise<DriveFile>
  download(id: string): Promise<Uint8Array>
  remove(id: string): Promise<void>
}

export interface DriveClientOptions {
  fetch: FetchLike
  /** Token de acceso vigente. Con `forceRefresh` tiene que pedir uno nuevo (el anterior dio 401). */
  getAccessToken(forceRefresh?: boolean): Promise<string>
}

const API = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const FIELDS = 'id,name,createdTime,size,appProperties'

const ID_RE = /^[\w-]{10,200}$/

export function isDriveFileId(id: string): boolean {
  return ID_RE.test(id)
}

interface RawFile {
  id?: unknown
  name?: unknown
  createdTime?: unknown
  size?: unknown
  appProperties?: unknown
}

function toDriveFile(raw: RawFile): DriveFile | null {
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  const props: Record<string, string> = {}
  if (raw.appProperties && typeof raw.appProperties === 'object') {
    for (const [k, v] of Object.entries(raw.appProperties)) {
      if (typeof v === 'string') props[k] = v
    }
  }
  return {
    id: raw.id,
    name: raw.name,
    createdTime: typeof raw.createdTime === 'string' ? raw.createdTime : new Date(0).toISOString(),
    size: Number(raw.size ?? 0) || 0,
    appProperties: props,
  }
}

/** Cuerpo `multipart/related` con los metadatos (JSON) y el contenido del archivo. */
export function multipartBody(
  metadata: unknown,
  bytes: Uint8Array,
  boundary: string,
): Uint8Array {
  const enc = new TextEncoder()
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
  )
  const tail = enc.encode(`\r\n--${boundary}--\r\n`)
  const body = new Uint8Array(head.length + bytes.length + tail.length)
  body.set(head, 0)
  body.set(bytes, head.length)
  body.set(tail, head.length + bytes.length)
  return body
}

export function createDriveClient(options: DriveClientOptions): DriveClient {
  const { fetch } = options
  const getAccessToken = (force?: boolean) => options.getAccessToken(force)
  type Init = NonNullable<Parameters<FetchLike>[1]>

  async function request(url: string, init: Init = {}) {
    let token = await getAccessToken()
    for (let attempt = 0; ; attempt++) {
      let res: Awaited<ReturnType<FetchLike>>
      try {
        res = await fetch(url, {
          ...init,
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
        })
      } catch {
        throw new AppError('INTERNAL', 'No hay conexión con Google Drive. Probá de nuevo más tarde.')
      }
      if (res.status === 401 && attempt === 0) {
        token = await getAccessToken(true)
        continue
      }
      if (res.ok) return res
      if (res.status === 403 || res.status === 401) {
        throw new AppError(
          'FORBIDDEN',
          'Google Drive no dio permiso. Desconectá la cuenta y volvé a conectarla.',
        )
      }
      if (res.status === 404) throw new AppError('NOT_FOUND', 'El backup ya no está en Drive')
      throw new AppError(
        'INTERNAL',
        `Google Drive respondió con un error (${String(res.status)}). Probá de nuevo más tarde.`,
      )
    }
  }

  return {
    async list() {
      const files: DriveFile[] = []
      let pageToken: string | undefined
      do {
        const params = new URLSearchParams({
          spaces: 'appDataFolder',
          fields: `nextPageToken,files(${FIELDS})`,
          orderBy: 'createdTime desc',
          pageSize: '100',
          q: 'trashed = false',
        })
        if (pageToken) params.set('pageToken', pageToken)
        const res = await request(`${API}?${params.toString()}`)
        const data = (await res.json()) as { files?: RawFile[]; nextPageToken?: string }
        for (const raw of data.files ?? []) {
          const file = toDriveFile(raw)
          if (file) files.push(file)
        }
        pageToken = data.nextPageToken
      } while (pageToken)
      return files
    },

    async upload(name, bytes, appProperties) {
      const boundary = `chanchito-${Math.random().toString(36).slice(2)}`
      const body = multipartBody({ name, parents: ['appDataFolder'], appProperties }, bytes, boundary)
      const res = await request(`${UPLOAD}?uploadType=multipart&fields=${FIELDS}`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      })
      const file = toDriveFile((await res.json()) as RawFile)
      if (!file) throw new AppError('INTERNAL', 'Google Drive no devolvió el archivo subido')
      return file
    },

    async download(id) {
      if (!isDriveFileId(id)) throw new AppError('VALIDATION', 'Backup inválido')
      const res = await request(`${API}/${id}?alt=media`)
      return new Uint8Array(await res.arrayBuffer())
    },

    async remove(id) {
      if (!isDriveFileId(id)) throw new AppError('VALIDATION', 'Backup inválido')
      await request(`${API}/${id}`, { method: 'DELETE' })
    },
  }
}
