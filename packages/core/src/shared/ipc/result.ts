export type IpcErrorCode = 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN' | 'INTERNAL'

export interface IpcError {
  code: IpcErrorCode
  message: string
  /** Detalle por campo para errores de validación (path → mensaje). */
  fields?: Record<string, string>
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }
