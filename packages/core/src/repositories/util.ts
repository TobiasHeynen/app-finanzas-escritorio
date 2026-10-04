import { AppError } from '@shared/errors'
import type { ExpenseGroup } from '@shared/types'

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

/** Columnas group_id / paid_by_member_id de una fila → grupo del gasto (o null si es personal). */
export function toExpenseGroup(r: {
  group_id: number | null
  paid_by_member_id: number | null
}): ExpenseGroup | null {
  return r.group_id !== null && r.paid_by_member_id !== null
    ? { groupId: r.group_id, paidByMemberId: r.paid_by_member_id }
    : null
}

/** Parámetros @groupId / @paidByMemberId para los INSERT y UPDATE. */
export const groupParams = (g: ExpenseGroup | null) => ({
  groupId: g?.groupId ?? null,
  paidByMemberId: g?.paidByMemberId ?? null,
})
