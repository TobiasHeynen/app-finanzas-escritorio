import type { SqlDb as Db } from '../db/sql'
import type { Income, IncomeInput } from '@shared/types'
import type { Month } from '@shared/months'
import { nowIso, notFound } from './util'

interface Row {
  id: number
  month: string
  type: Income['type']
  description: string
  amount_cents: number
  date: string
}

const toIncome = (r: Row): Income => ({
  id: r.id,
  month: r.month,
  type: r.type,
  description: r.description,
  amountCents: r.amount_cents,
  date: r.date,
})

export type IncomesRepo = ReturnType<typeof createIncomesRepo>

export function createIncomesRepo(db: Db) {
  const stmts = {
    get: db.prepare<[number], Row>('SELECT * FROM incomes WHERE id = ? AND deleted_at IS NULL'),
    byMonth: db.prepare<[string], Row>(
      'SELECT * FROM incomes WHERE month = ? AND deleted_at IS NULL ORDER BY date, id',
    ),
    byRange: db.prepare<[string, string], Row>(
      'SELECT * FROM incomes WHERE month BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY date, id',
    ),
    lastOfTypeBefore: db.prepare<[string, string], Row>(
      `SELECT * FROM incomes WHERE type = ? AND month < ? AND deleted_at IS NULL
       ORDER BY month DESC, date DESC, id DESC LIMIT 1`,
    ),
    insert: db.prepare(
      'INSERT INTO incomes (month, type, description, amount_cents, date) VALUES (@month, @type, @description, @amountCents, @date)',
    ),
    update: db.prepare(
      `UPDATE incomes SET month = @month, type = @type, description = @description, amount_cents = @amountCents,
         date = @date, updated_at = @updatedAt WHERE id = @id AND deleted_at IS NULL`,
    ),
    softDelete: db.prepare('UPDATE incomes SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'),
    restore: db.prepare('UPDATE incomes SET deleted_at = NULL WHERE id = ?'),
    purge: db.prepare('DELETE FROM incomes WHERE deleted_at IS NOT NULL AND deleted_at < ?'),
  }

  const get = (id: number): Income => toIncome(stmts.get.get(id) ?? notFound('El ingreso'))

  return {
    get,
    listByMonth: (month: Month): Income[] => stmts.byMonth.all(month).map(toIncome),
    listByRange: (from: Month, to: Month): Income[] => stmts.byRange.all(from, to).map(toIncome),
    lastOfTypeBefore: (type: Income['type'], month: Month): Income | null => {
      const row = stmts.lastOfTypeBefore.get(type, month)
      return row ? toIncome(row) : null
    },
    insert: (input: IncomeInput): Income => get(Number(stmts.insert.run(input).lastInsertRowid)),
    update: (id: number, input: IncomeInput): Income => {
      if (stmts.update.run({ ...input, id, updatedAt: nowIso() }).changes === 0)
        notFound('El ingreso')
      return get(id)
    },
    softDelete: (id: number): void => {
      if (stmts.softDelete.run(nowIso(), id).changes === 0) notFound('El ingreso')
    },
    restore: (id: number): void => void stmts.restore.run(id),
    purgeDeletedBefore: (iso: string): number => stmts.purge.run(iso).changes,
  }
}
