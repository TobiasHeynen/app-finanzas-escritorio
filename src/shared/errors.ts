import type { IpcErrorCode } from './ipc/result'

/** Error de dominio con código estable, apto para viajar por IPC. */
export class AppError extends Error {
  constructor(
    readonly code: IpcErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
