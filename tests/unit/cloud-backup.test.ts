import { describe, expect, it } from 'vitest'
import {
  cloudBackupFileName,
  cloudBackupsToPrune,
  createCloudBackup,
  shouldAutoBackup,
  type CloudAuth,
  type CloudState,
} from '@core/cloud/cloud-backup'
import { multipartBody, type DriveFile, type FetchLike } from '@core/cloud/drive'

/** Drive falso en memoria: entiende list, upload multipart, alt=media y DELETE. */
function fakeDrive() {
  const files = new Map<string, DriveFile & { bytes: Uint8Array }>()
  const tokens: string[] = []
  let seq = 0
  let clock = Date.parse('2026-10-20T10:00:00Z')
  let expireNext = false

  const res = (status: number, body: unknown = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    arrayBuffer: () =>
      Promise.resolve(body instanceof Uint8Array ? body.slice().buffer : new ArrayBuffer(0)),
  })

  const fetch: FetchLike = (url, init = {}) => {
    const auth = init.headers?.['Authorization'] ?? ''
    tokens.push(auth)
    if (expireNext) {
      expireNext = false
      return Promise.resolve(res(401))
    }
    if (auth !== 'Bearer bueno' && auth !== 'Bearer renovado') return Promise.resolve(res(401))
    const u = new URL(url)
    const id = u.pathname.split('/').pop() ?? ''
    if (init.method === 'POST') {
      const body = init.body as Uint8Array
      const text = new TextDecoder('latin1').decode(body)
      const meta = JSON.parse(text.split('\r\n\r\n')[1]?.split('\r\n')[0] ?? '{}') as {
        name: string
        appProperties: Record<string, string>
      }
      const start = text.indexOf('application/octet-stream\r\n\r\n') + 28
      const end = text.lastIndexOf('\r\n--')
      const file = {
        id: `archivo-${String(++seq).padStart(4, '0')}`,
        name: meta.name,
        createdTime: new Date((clock += 1000)).toISOString(),
        size: end - start,
        appProperties: meta.appProperties,
        bytes: body.slice(start, end),
      }
      files.set(file.id, file)
      return Promise.resolve(res(200, file))
    }
    if (init.method === 'DELETE') {
      files.delete(id)
      return Promise.resolve(res(204))
    }
    if (u.searchParams.get('alt') === 'media') {
      const file = files.get(id)
      return Promise.resolve(file ? res(200, file.bytes) : res(404))
    }
    expect(u.searchParams.get('spaces')).toBe('appDataFolder')
    return Promise.resolve(res(200, { files: [...files.values()] }))
  }

  return {
    fetch,
    files,
    tokens,
    expireToken: () => (expireNext = true),
  }
}

function setup(opts: { connected?: boolean; state?: CloudState | null } = {}) {
  const drive = fakeDrive()
  let saved: CloudState | null = opts.state ?? null
  let changes = 0
  let connected = opts.connected ?? true
  const restored: Uint8Array[] = []
  const auth: CloudAuth = {
    isAvailable: () => true,
    account: () => (connected ? { email: 'yo@gmail.com' } : null),
    connect: () => {
      connected = true
      return Promise.resolve({ email: 'yo@gmail.com' })
    },
    disconnect: () => {
      connected = false
      return Promise.resolve()
    },
    getAccessToken: (force) => Promise.resolve(force ? 'renovado' : 'bueno'),
  }
  let now = new Date('2026-10-20T10:00:00Z')
  let ids = 0
  const cloud = createCloudBackup({
    auth,
    fetch: drive.fetch,
    store: { load: () => saved, save: (s) => (saved = s) },
    platform: 'pc',
    deviceName: 'PC',
    snapshot: () => new Uint8Array([1, 2, 3, changes]),
    changeCounter: () => changes,
    restore: (bytes) => {
      restored.push(bytes)
      return { restarting: true }
    },
    randomId: () => `dispositivo-${String(++ids)}`,
    now: () => now,
  })
  return {
    cloud,
    drive,
    restored,
    saved: () => saved,
    change: () => changes++,
    advance: (ms: number) => (now = new Date(now.getTime() + ms)),
  }
}

describe('backup en Google Drive', () => {
  it('arma el nombre con la plataforma y la hora local', () => {
    expect(cloudBackupFileName('android', new Date(2026, 0, 5, 7, 8, 9))).toBe(
      'chanchito-android-20260105-070809.db',
    )
  })

  it('el cuerpo multipart lleva los metadatos y los bytes tal cual', () => {
    const body = multipartBody({ name: 'x' }, new Uint8Array([0, 255, 10]), 'b')
    const text = new TextDecoder('latin1').decode(body)
    expect(text.startsWith('--b\r\nContent-Type: application/json')).toBe(true)
    expect(text).toContain('{"name":"x"}')
    expect(text.endsWith('\r\n--b--\r\n')).toBe(true)
    expect([...body.slice(body.length - 12, body.length - 9)]).toEqual([0, 255, 10])
  })

  it('sube un backup, guarda el estado y lo puede restaurar', async () => {
    const t = setup()
    const status = await t.cloud.backupNow()
    expect(status.connected).toBe(true)
    expect(status.lastBackupAt).toBe('2026-10-20T10:00:00.000Z')
    const list = await t.cloud.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ deviceName: 'PC', platform: 'pc', thisDevice: true })
    await t.cloud.restore(list[0]?.id ?? '')
    expect([...(t.restored[0] ?? [])]).toEqual([1, 2, 3, 0])
  })

  it('deja los últimos 7 de este dispositivo y no toca los de otros', async () => {
    const t = setup()
    t.drive.files.set('otro-celular-1', {
      id: 'otro-celular-1',
      name: 'chanchito-android-x.db',
      createdTime: '2020-01-01T00:00:00.000Z',
      size: 3,
      appProperties: { app: 'chanchito', device: 'otro', deviceName: 'Celular', platform: 'android' },
      bytes: new Uint8Array(3),
    })
    for (let i = 0; i < 9; i++) await t.cloud.backupNow()
    const list = await t.cloud.list()
    expect(list.filter((b) => b.thisDevice)).toHaveLength(7)
    expect(list.find((b) => !b.thisDevice)).toMatchObject({
      deviceName: 'Celular',
      platform: 'android',
    })
  })

  it('cloudBackupsToPrune ignora archivos que no son de Chanchito', () => {
    const file = (id: string, device: string, app = 'chanchito'): DriveFile => ({
      id,
      name: id,
      createdTime: id,
      size: 1,
      appProperties: { app, device },
    })
    const files = [file('3', 'a'), file('2', 'a'), file('1', 'a'), file('0', 'a', 'otra')]
    expect(cloudBackupsToPrune(files, 'a', 1).map((f) => f.id)).toEqual(['2', '1'])
  })

  it('con un 401 renueva el token una vez y reintenta', async () => {
    const t = setup()
    t.drive.expireToken()
    await t.cloud.backupNow()
    expect(t.drive.tokens.slice(0, 2)).toEqual(['Bearer bueno', 'Bearer renovado'])
  })

  it('si falla la subida, guarda el error y lo tira', async () => {
    const cloud = createCloudBackup({
      auth: {
        isAvailable: () => true,
        account: () => ({ email: 'yo@gmail.com' }),
        connect: () => Promise.resolve({ email: '' }),
        disconnect: () => Promise.resolve(),
        getAccessToken: () => Promise.resolve('bueno'),
      },
      fetch: () => Promise.reject(new Error('sin red')),
      store: { load: () => null, save: () => undefined },
      platform: 'pc',
      deviceName: 'PC',
      snapshot: () => new Uint8Array(1),
      changeCounter: () => 0,
      restore: () => ({ restarting: false }),
      randomId: () => 'x',
    })
    await expect(cloud.backupNow()).rejects.toThrow('No hay conexión con Google Drive')
    expect(cloud.status().lastError).toContain('No hay conexión')
  })

  it('sin cuenta conectada no hace backups automáticos', async () => {
    const t = setup({ connected: false })
    await t.cloud.auto('start')
    expect(t.drive.files.size).toBe(0)
    expect(t.cloud.status()).toMatchObject({ connected: false, lastBackupAt: null })
  })

  it('auto: al iniciar, uno por día; al cerrar, sólo si hubo cambios', async () => {
    const t = setup()
    await t.cloud.auto('start')
    expect(t.drive.files.size).toBe(1)
    t.advance(60 * 60 * 1000)
    await t.cloud.auto('start')
    await t.cloud.auto('close')
    expect(t.drive.files.size).toBe(1)
    t.change()
    await t.cloud.auto('close')
    expect(t.drive.files.size).toBe(2)
  })

  it('shouldAutoBackup respeta los tiempos', () => {
    const now = new Date('2026-10-20T10:00:00Z')
    const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString()
    expect(shouldAutoBackup({ trigger: 'start', now, lastBackupAt: null, changed: false })).toBe(
      true,
    )
    expect(
      shouldAutoBackup({ trigger: 'start', now, lastBackupAt: ago(23 * 60), changed: true }),
    ).toBe(false)
    expect(
      shouldAutoBackup({ trigger: 'start', now, lastBackupAt: ago(24 * 60), changed: false }),
    ).toBe(true)
    expect(shouldAutoBackup({ trigger: 'close', now, lastBackupAt: ago(5), changed: true })).toBe(
      false,
    )
    expect(shouldAutoBackup({ trigger: 'close', now, lastBackupAt: ago(11), changed: true })).toBe(
      true,
    )
    expect(
      shouldAutoBackup({ trigger: 'close', now, lastBackupAt: ago(60), changed: false }),
    ).toBe(false)
  })

  it('conectar y desconectar limpian el estado del último backup', async () => {
    const t = setup({ connected: false })
    expect((await t.cloud.connect()).connected).toBe(true)
    await t.cloud.backupNow()
    await t.cloud.disconnect()
    expect(t.cloud.status()).toMatchObject({ connected: false, email: null })
    expect(t.saved()?.lastBackupAt).toBeNull()
    expect(t.saved()?.deviceId).toBe('dispositivo-1')
  })
})
