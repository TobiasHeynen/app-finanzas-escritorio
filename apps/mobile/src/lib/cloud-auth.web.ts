import type { CloudAuth } from '@core/cloud/cloud-backup'
import { DRIVE_SCOPE } from '@core/cloud/drive'
import { AppError } from '@shared/errors'

/**
 * Versión web (PWA del iPhone): OAuth de Google por redirección, sin popup (el aislamiento entre orígenes
 * que necesita SQLite corta la comunicación con un popup) y sin servidor: flujo implícito, que da un token
 * de acceso de una hora y ningún refresh token. Cuando vence, una acción del usuario vuelve a pasar por
 * Google (si la sesión sigue abierta, es ir y volver sin tocar nada).
 */

const CLIENT_ID = process.env['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'] ?? ''
const ACCOUNT_KEY = 'chanchito:cuenta-google'
const PENDING_KEY = 'chanchito:google-pendiente'
const JUST_CONNECTED_KEY = 'chanchito:google-recien-conectado'
const RESUME_KEY = 'chanchito:google-retomar'

/** Qué se estaba haciendo al ir a Google, para retomarlo al volver. */
export type ResumeAction = 'backup' | 'none'

interface Account {
  email: string
  token: string | null
  expiresAt: number
}

interface Pending {
  state: string
  resume: ResumeAction
  path: string
  silent: boolean
  email: string | null
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(storage: Storage, key: string, value: unknown): void {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    /* sin almacenamiento: la próxima vez se vuelve a pedir */
  }
}

let account = readJson<Account>(localStorage, ACCOUNT_KEY)

const setAccount = (next: Account | null) => {
  account = next
  writeJson(localStorage, ACCOUNT_KEY, next)
}

const randomState = () => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Va a Google. La página se va: la promesa que espera esto nunca termina. */
export function goToGoogle(
  resume: ResumeAction,
  opts: { silent?: boolean; path?: string } = {},
): Promise<never> {
  const pending: Pending = {
    state: randomState(),
    resume,
    path: opts.path ?? window.location.pathname,
    silent: opts.silent ?? false,
    email: account?.email ?? null,
  }
  writeJson(sessionStorage, PENDING_KEY, pending)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${window.location.origin}/`,
    response_type: 'token',
    scope: `openid email ${DRIVE_SCOPE}`,
    state: pending.state,
    include_granted_scopes: 'true',
  })
  if (pending.email) params.set('login_hint', pending.email)
  if (pending.silent) params.set('prompt', 'none')
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  return new Promise<never>(() => undefined)
}

/** ¿Hay un token que dure al menos un minuto más? */
export function hasValidToken(): boolean {
  return account?.token != null && account.expiresAt - Date.now() > 60_000
}

/** Después de conectar por primera vez: la pantalla de backups ofrece traer datos de otro equipo. */
export function consumeJustConnected(): boolean {
  const value = sessionStorage.getItem(JUST_CONNECTED_KEY) === '1'
  sessionStorage.removeItem(JUST_CONNECTED_KEY)
  return value
}

/** Qué hacer después de volver de Google (sólo una vez). */
export function consumeResume(): ResumeAction | 'no-permission' | 'connected' {
  const value = sessionStorage.getItem(RESUME_KEY)
  sessionStorage.removeItem(RESUME_KEY)
  return value === 'backup' || value === 'no-permission' || value === 'connected' ? value : 'none'
}

/**
 * Al arrancar, antes de abrir la base: si volvemos de Google, se guarda el token del fragmento de la URL y
 * se recarga en la pantalla donde estaba el usuario (sin el token en la barra). Devuelve true si recarga.
 */
export async function completeGoogleRedirect(): Promise<boolean> {
  const pending = readJson<Pending>(sessionStorage, PENDING_KEY)
  const hash = new URLSearchParams(window.location.hash.slice(1))
  if (!pending || !hash.has('state')) return false
  writeJson(sessionStorage, PENDING_KEY, null)
  window.history.replaceState(null, '', window.location.pathname)
  if (hash.get('state') !== pending.state) return false
  await saveGoogleResponse(hash, pending)
  window.location.replace(pending.path)
  return true
}

async function saveGoogleResponse(hash: URLSearchParams, pending: Pending): Promise<void> {
  const error = hash.get('error')
  if (error) {
    // Con prompt=none Google no puede mostrar nada: se repite pidiendo la cuenta.
    if (pending.silent && /interaction_required|login_required|consent_required/.test(error)) {
      await goToGoogle(pending.resume, { path: pending.path })
    }
    return
  }
  const token = hash.get('access_token')
  const scopes = (hash.get('scope') ?? '').split(' ')
  const expiresIn = Number(hash.get('expires_in') ?? '3600')
  if (!token || !scopes.includes(DRIVE_SCOPE)) {
    sessionStorage.setItem(RESUME_KEY, 'no-permission')
    return
  }
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)
  const email = res?.ok ? ((await res.json()) as { email?: string }).email : undefined
  const first = account === null
  setAccount({
    email: email ?? account?.email ?? 'tu cuenta de Google',
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  })
  if (first) sessionStorage.setItem(JUST_CONNECTED_KEY, '1')
  // Recién conectado, la pantalla de backups decide qué subir: no se hace el backup automático.
  sessionStorage.setItem(RESUME_KEY, first ? 'connected' : pending.resume)
}

export function createGoogleAuth(): CloudAuth {
  return {
    isAvailable: () => CLIENT_ID !== '',
    account: () => (account ? { email: account.email } : null),
    connect: () => goToGoogle('none'),
    async disconnect() {
      const token = account?.token
      setAccount(null)
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
        }).catch(() => undefined)
      }
    },
    getAccessToken(forceRefresh = false) {
      if (!account)
        return Promise.reject(new AppError('FORBIDDEN', 'Conectá tu cuenta de Google primero'))
      if (forceRefresh || !hasValidToken() || !account.token) {
        // Google rechazó el token (o venció): se descarta y la próxima acción vuelve a pedirlo.
        setAccount({ ...account, token: null, expiresAt: 0 })
        return Promise.reject(
          new AppError(
            'FORBIDDEN',
            'Venció el permiso de Google. Tocá "Hacer backup ahora" para renovarlo.',
          ),
        )
      }
      return Promise.resolve(account.token)
    },
  }
}
