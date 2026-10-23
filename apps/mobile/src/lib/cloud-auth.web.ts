import type { CloudAuth } from '@core/cloud/cloud-backup'
import { AppError } from '@shared/errors'

/** En la vista previa web no hay Google Sign-In: la sección no se muestra. */
export function createGoogleAuth(): CloudAuth {
  const unavailable = () =>
    Promise.reject(new AppError('FORBIDDEN', 'No disponible en la versión web'))
  return {
    isAvailable: () => false,
    account: () => null,
    connect: unavailable,
    disconnect: () => Promise.resolve(),
    getAccessToken: unavailable,
  }
}
