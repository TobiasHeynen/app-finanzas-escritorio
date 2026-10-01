import { AppError } from '@shared/errors'

export const nowIso = (): string => new Date().toISOString()

interface SqliteError {
  code?: unknown
  message?: unknown
}

/** Traduce errores de constraints de SQLite a AppError con mensaje para el usuario. */
export function translateSqliteError(
  err: unknown,
  messages: { unique?: string; foreignKey?: string } = {},
): never {
  const e = err as SqliteError
  if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
    throw new AppError('CONFLICT', messages.unique ?? 'Ya existe un registro con ese nombre')
  }
  if (e.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    throw new AppError('CONFLICT', messages.foreignKey ?? 'El registro está en uso')
  }
  throw err
}

export function notFound(what: string): never {
  throw new AppError('NOT_FOUND', `${what} no existe`)
}

/** Placeholders "?, ?, ?" para un IN (...). */
export const placeholders = (n: number): string => Array(n).fill('?').join(', ')
