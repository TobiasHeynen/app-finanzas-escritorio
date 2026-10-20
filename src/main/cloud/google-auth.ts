import { app, safeStorage, shell } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { join } from 'node:path'
import { DRIVE_SCOPE } from '@core/cloud/drive'
import type { CloudAuth } from '@core/cloud/cloud-backup'
import { AppError } from '@shared/errors'

/**
 * Login con Google para apps de escritorio: se abre el navegador del sistema, el usuario elige la cuenta y
 * Google redirige a un servidor local en 127.0.0.1 (OAuth 2.0 con PKCE). Sólo se pide `drive.appdata`
 * (más el mail, para mostrar con qué cuenta está conectado). El refresh token se guarda cifrado con
 * `safeStorage` (DPAPI en Windows) y nunca llega al renderer.
 *
 * El cliente OAuth ("App de escritorio" en Google Cloud) se inyecta al compilar con MAIN_VITE_GOOGLE_CLIENT_ID
 * y MAIN_VITE_GOOGLE_CLIENT_SECRET. En apps de escritorio Google no considera secreto ese "secret"; igual
 * no se versiona. Sin esas variables, la función queda oculta.
 */

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const SCOPES = ['openid', 'email', DRIVE_SCOPE]
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000
const HTTP_TIMEOUT_MS = 30_000

const clientId = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID ?? ''
const clientSecret = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET ?? ''

interface StoredAccount {
  email: string
  /** Refresh token cifrado con safeStorage, en base64. */
  refreshToken: string
}

const accountFile = () => join(app.getPath('userData'), 'cuenta-google.json')

const base64url = (buf: Buffer) => buf.toString('base64url')

function readAccount(): StoredAccount | null {
  try {
    if (!existsSync(accountFile())) return null
    const data = JSON.parse(readFileSync(accountFile(), 'utf8')) as Partial<StoredAccount>
    if (typeof data.email !== 'string' || typeof data.refreshToken !== 'string') return null
    return { email: data.email, refreshToken: data.refreshToken }
  } catch {
    return null
  }
}

/** Mail del id_token (llega directo del endpoint de tokens por HTTPS: no hace falta verificar la firma). */
export function emailFromIdToken(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null
  const payload = idToken.split('.')[1]
  if (!payload) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: unknown
    }
    return typeof data.email === 'string' ? data.email : null
  } catch {
    return null
  }
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  id_token?: string
  scope?: string
  error?: string
}

async function postForm(url: string, form: Record<string, string>): Promise<TokenResponse> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    })
  } catch {
    throw new AppError('INTERNAL', 'No hay conexión con Google. Probá de nuevo más tarde.')
  }
  const data = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok && !data.error) data.error = `http_${String(res.status)}`
  return data
}

const DONE_PAGE = `<!doctype html><html lang="es-AR"><meta charset="utf-8"><title>Chanchito</title>
<body style="font-family:system-ui;text-align:center;padding:48px">
<h1>Listo</h1><p>Ya podés cerrar esta pestaña y volver a Chanchito.</p></body></html>`

const ERROR_PAGE = `<!doctype html><html lang="es-AR"><meta charset="utf-8"><title>Chanchito</title>
<body style="font-family:system-ui;text-align:center;padding:48px">
<h1>No se pudo conectar</h1><p>Volvé a Chanchito y probá de nuevo.</p></body></html>`

/**
 * Espera la redirección de Google en 127.0.0.1 y devuelve el `code`. `cancel` corta la espera (por ejemplo,
 * si el usuario cerró el navegador y vuelve a tocar "Conectar").
 */
function waitForCode(server: Server, state: string) {
  let cancel: () => void = () => undefined
  const code = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError('CONFLICT', 'Se agotó el tiempo para elegir la cuenta. Probá de nuevo.'))
    }, LOGIN_TIMEOUT_MS)
    cancel = () => {
      clearTimeout(timer)
      reject(new AppError('CONFLICT', 'Se canceló la conexión anterior con Google.'))
    }
    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const received = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      if (url.pathname !== '/' || (!received && !error)) {
        res.writeHead(404).end()
        return
      }
      const ok = url.searchParams.get('state') === state && received
      res
        .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        .end(ok ? DONE_PAGE : ERROR_PAGE)
      clearTimeout(timer)
      if (ok) resolve(received)
      else if (error === 'access_denied') {
        reject(new AppError('CONFLICT', 'Cancelaste la conexión con Google.'))
      } else reject(new AppError('INTERNAL', 'Google no devolvió la autorización. Probá de nuevo.'))
    })
  })
  return { code, cancel }
}

export function createGoogleAuth(): CloudAuth {
  let account = readAccount()
  let cached: { token: string; expiresAt: number } | null = null
  let cancelPending: (() => void) | null = null

  function forget() {
    account = null
    cached = null
    rmSync(accountFile(), { force: true })
  }

  async function refresh(): Promise<string> {
    if (!account) throw new AppError('FORBIDDEN', 'Conectá tu cuenta de Google primero')
    let refreshToken: string
    try {
      refreshToken = safeStorage.decryptString(Buffer.from(account.refreshToken, 'base64'))
    } catch {
      forget()
      throw new AppError('FORBIDDEN', 'Se cerró la sesión de Google. Volvé a conectar tu cuenta.')
    }
    const data = await postForm(TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })
    if (data.error === 'invalid_grant') {
      // Revocado desde la cuenta de Google o vencido: hay que volver a conectar.
      forget()
      throw new AppError('FORBIDDEN', 'Se cerró la sesión de Google. Volvé a conectar tu cuenta.')
    }
    if (!data.access_token) {
      throw new AppError('INTERNAL', 'Google no devolvió el acceso. Probá de nuevo más tarde.')
    }
    cached = {
      token: data.access_token,
      expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
    }
    return data.access_token
  }

  return {
    isAvailable: () => clientId !== '' && clientSecret !== '',

    account: () => (account ? { email: account.email } : null),

    async connect() {
      // Si quedó una conexión a medias (se cerró el navegador), se cancela y se empieza de nuevo.
      cancelPending?.()
      if (!safeStorage.isEncryptionAvailable()) {
        throw new AppError('INTERNAL', 'Este equipo no permite guardar la sesión de forma segura.')
      }
      const server = createServer()
      let ownCancel: (() => void) | null = null
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject)
          server.listen(0, '127.0.0.1', resolve)
        })
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Sin puerto local')
        const redirectUri = `http://127.0.0.1:${String(address.port)}`
        const verifier = base64url(randomBytes(32))
        const state = base64url(randomBytes(16))
        const params = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          scope: SCOPES.join(' '),
          code_challenge: base64url(createHash('sha256').update(verifier).digest()),
          code_challenge_method: 'S256',
          state,
          access_type: 'offline',
          prompt: 'consent select_account',
        })
        const { code, cancel } = waitForCode(server, state)
        code.catch(() => undefined)
        ownCancel = cancel
        cancelPending = cancel
        await shell.openExternal(`${AUTH_URL}?${params.toString()}`)
        const data = await postForm(TOKEN_URL, {
          grant_type: 'authorization_code',
          code: await code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        })
        if (!data.refresh_token || !data.access_token) {
          throw new AppError('INTERNAL', 'Google no devolvió la autorización. Probá de nuevo.')
        }
        if (!data.scope?.split(' ').includes(DRIVE_SCOPE)) {
          throw new AppError(
            'FORBIDDEN',
            'Para hacer el backup tenés que permitir que Chanchito guarde sus datos en tu Drive.',
          )
        }
        const email = emailFromIdToken(data.id_token) ?? 'tu cuenta de Google'
        account = {
          email,
          refreshToken: safeStorage.encryptString(data.refresh_token).toString('base64'),
        }
        writeFileSync(accountFile(), JSON.stringify(account), { mode: 0o600 })
        cached = {
          token: data.access_token,
          expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
        }
        return { email }
      } finally {
        if (cancelPending === ownCancel) cancelPending = null
        server.close()
      }
    },

    async disconnect() {
      const current = account
      forget()
      if (!current) return
      // Revocar es lo prolijo, pero si no hay conexión igual queda desconectado en este equipo.
      try {
        const token = safeStorage.decryptString(Buffer.from(current.refreshToken, 'base64'))
        await postForm(REVOKE_URL, { token })
      } catch {
        /* ignorado */
      }
    },

    async getAccessToken(forceRefresh = false) {
      if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.token
      return refresh()
    },
  }
}
