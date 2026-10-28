import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { File, Paths } from 'expo-file-system'
import type { CloudAuth } from '@core/cloud/cloud-backup'
import { DRIVE_SCOPE } from '@core/cloud/drive'
import { AppError } from '@shared/errors'

/**
 * Login con el selector de cuentas nativo de Android (Google Sign-In). Sólo se pide `drive.appdata`. Los
 * tokens los maneja Google Play Services; acá sólo se recuerda el mail para mostrarlo.
 */

const accountFile = () => new File(Paths.document, 'cuenta-google.json')

function readEmail(): string | null {
  try {
    const file = accountFile()
    if (!file.exists) return null
    const data = JSON.parse(file.textSync()) as { email?: unknown }
    return typeof data.email === 'string' ? data.email : null
  } catch {
    return null
  }
}

function writeEmail(email: string | null): void {
  const file = accountFile()
  if (email === null) {
    if (file.exists) file.delete()
    return
  }
  if (!file.exists) file.create()
  file.write(JSON.stringify({ email }))
}

const codeOf = (err: unknown) =>
  err && typeof err === 'object' && 'code' in err ? String(err.code) : ''

export function createGoogleAuth(): CloudAuth {
  GoogleSignin.configure({ scopes: [DRIVE_SCOPE] })
  let email = readEmail()
  let lastToken: string | null = null

  const signedOut = () => {
    email = null
    writeEmail(null)
    return new AppError('FORBIDDEN', 'Se cerró la sesión de Google. Volvé a conectar tu cuenta.')
  }

  return {
    isAvailable: () => true,
    account: () => (email ? { email } : null),

    async connect() {
      try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
        const res = await GoogleSignin.signIn()
        if (res.type !== 'success') {
          throw new AppError('CONFLICT', 'Cancelaste la conexión con Google.')
        }
        if (!res.data.scopes.includes(DRIVE_SCOPE)) {
          await GoogleSignin.signOut()
          throw new AppError(
            'FORBIDDEN',
            'Para hacer el backup tenés que permitir que Chanchito guarde sus datos en tu Drive.',
          )
        }
        email = res.data.user.email
        writeEmail(email)
        return { email }
      } catch (err) {
        if (err instanceof AppError) throw err
        const code = codeOf(err)
        if (code === statusCodes.SIGN_IN_CANCELLED) {
          throw new AppError('CONFLICT', 'Cancelaste la conexión con Google.')
        }
        if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          throw new AppError('FORBIDDEN', 'Este celular no tiene los servicios de Google Play.')
        }
        if (code === statusCodes.IN_PROGRESS) {
          throw new AppError('CONFLICT', 'Ya hay una conexión en curso.')
        }
        throw new AppError('INTERNAL', 'No se pudo conectar con Google. Probá de nuevo más tarde.')
      }
    },

    async disconnect() {
      email = null
      writeEmail(null)
      try {
        await GoogleSignin.revokeAccess()
        await GoogleSignin.signOut()
      } catch {
        /* sin conexión: igual queda desconectado en el celu */
      }
    },

    async getAccessToken(forceRefresh = false) {
      if (!email) throw new AppError('FORBIDDEN', 'Conectá tu cuenta de Google primero')
      try {
        if (!GoogleSignin.getCurrentUser()) {
          const res = await GoogleSignin.signInSilently()
          if (res.type !== 'success') throw signedOut()
        }
        if (forceRefresh && lastToken) await GoogleSignin.clearCachedAccessToken(lastToken)
        const { accessToken } = await GoogleSignin.getTokens()
        lastToken = accessToken
        return accessToken
      } catch (err) {
        if (err instanceof AppError) throw err
        if (codeOf(err) === statusCodes.SIGN_IN_REQUIRED) throw signedOut()
        throw new AppError('INTERNAL', 'No hay conexión con Google. Probá de nuevo más tarde.')
      }
    },
  }
}

/** Sólo la versión web vuelve de Google recargando la app; en Android el login no sale de la pantalla. */
export function consumeJustConnected(): boolean {
  return false
}
