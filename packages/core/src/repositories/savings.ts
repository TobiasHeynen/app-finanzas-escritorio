import type { SqlDb as Db } from '../db/sql'
import type { SavingsGoal, SavingsGoalInput, SavingsMovement } from '@shared/types'
import type { Currency } from '@shared/money'
import type { Month } from '@shared/months'
import { nowIso, notFound, translateSqliteError } from './util'

interface MovementRow {
  id: number
  date: string
  month: string
  currency: Currency
  amount_minor: number
  ars_cost_cents: number | null
  rate_cents_per_usd: number | null
  goal_id: number | null
  note: string
}

interface GoalRow {
  id: number
  name: string
  currency: Currency
  target_minor: number
  target_date: string | null
  archived_at: string | null
  saved_minor: number
}

const toMovement = (r: MovementRow): SavingsMovement => ({
  id: r.id,
  date: r.date,
  month: r.month,
  currency: r.currency,
  amountMinor: r.amount_minor,
  arsCostCents: r.ars_cost_cents,
  rateCentsPerUsd: r.rate_cents_per_usd,
  goalId: r.goal_id,
  note: r.note,
})

const toGoal = (r: GoalRow): SavingsGoal => ({
  id: r.id,
  name: r.name,
  currency: r.currency,
  targetMinor: r.target_minor,
  targetDate: r.target_date,
  archived: r.archived_at !== null,
  savedMinor: r.saved_minor,
})

export interface MovementWrite {
  date: string
  month: string
  currency: Currency
  amountMinor: number
  arsCostCents: number | null
  rateCentsPerUsd: number | null
  goalId: number | null
  note: string
}

const GOAL_SELECT = `
  SELECT g.*, COALESCE((SELECT SUM(m.amount_minor) FROM savings_movements m
    WHERE m.goal_id = g.id AND m.deleted_at IS NULL), 0) AS saved_minor
  FROM savings_goals g`

export type SavingsRepo = ReturnType<typeof createSavingsRepo>

export function createSavingsRepo(db: Db) {
  const stmts = {
    movement: db.prepare<[number], MovementRow>(
      'SELECT * FROM savings_movements WHERE id = ? AND deleted_at IS NULL',
    ),
    movements: db.prepare<[], MovementRow>(
      'SELECT * FROM savings_movements WHERE deleted_at IS NULL ORDER BY date DESC, id DESC',
    ),
    byMonth: db.prepare<[string], MovementRow>(
      'SELECT * FROM savings_movements WHERE month = ? AND deleted_at IS NULL ORDER BY date, id',
    ),
    byRange: db.prepare<[string, string], MovementRow>(
      'SELECT * FROM savings_movements WHERE month BETWEEN ? AND ? AND deleted_at IS NULL ORDER BY date, id',
    ),
    balances: db.prepare<[], { currency: Currency; total: number }>(
      'SELECT currency, SUM(amount_minor) AS total FROM savings_movements WHERE deleted_at IS NULL GROUP BY currency',
    ),
    lastRate: db.prepare<[], { rate: number; date: string }>(
      `SELECT rate_cents_per_usd AS rate, date FROM savings_movements
       WHERE rate_cents_per_usd IS NOT NULL AND deleted_at IS NULL ORDER BY date DESC, id DESC LIMIT 1`,
    ),
    insert: db.prepare(
      `INSERT INTO savings_movements (date, month, currency, amount_minor, ars_cost_cents, rate_cents_per_usd, goal_id, note)
       VALUES (@date, @month, @currency, @amountMinor, @arsCostCents, @rateCentsPerUsd, @goalId, @note)`,
    ),
    update: db.prepare(
      `UPDATE savings_movements SET date = @date, month = @month, currency = @currency, amount_minor = @amountMinor,
         ars_cost_cents = @arsCostCents, rate_cents_per_usd = @rateCentsPerUsd, goal_id = @goalId, note = @note,
         updated_at = @updatedAt
       WHERE id = @id AND deleted_at IS NULL`,
    ),
    softDelete: db.prepare(
      'UPDATE savings_movements SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    ),
    restore: db.prepare('UPDATE savings_movements SET deleted_at = NULL WHERE id = ?'),
    purge: db.prepare(
      'DELETE FROM savings_movements WHERE deleted_at IS NOT NULL AND deleted_at < ?',
    ),
    goals: db.prepare<[], GoalRow>(`${GOAL_SELECT} ORDER BY g.archived_at IS NOT NULL, g.id`),
    goal: db.prepare<[number], GoalRow>(`${GOAL_SELECT} WHERE g.id = ?`),
    insertGoal: db.prepare(
      'INSERT INTO savings_goals (name, currency, target_minor, target_date) VALUES (@name, @currency, @targetMinor, @targetDate)',
    ),
    updateGoal: db.prepare(
      'UPDATE savings_goals SET name = @name, currency = @currency, target_minor = @targetMinor, target_date = @targetDate WHERE id = @id',
    ),
    archiveGoal: db.prepare('UPDATE savings_goals SET archived_at = ? WHERE id = ?'),
  }

  const getMovement = (id: number): SavingsMovement =>
    toMovement(stmts.movement.get(id) ?? notFound('El movimiento'))
  const getGoal = (id: number): SavingsGoal => toGoal(stmts.goal.get(id) ?? notFound('La meta'))
  const DUP = { unique: 'Ya existe una meta con ese nombre' }

  return {
    getMovement,
    listMovements: (): SavingsMovement[] => stmts.movements.all().map(toMovement),
    listByMonth: (month: Month): SavingsMovement[] => stmts.byMonth.all(month).map(toMovement),
    listByRange: (from: Month, to: Month): SavingsMovement[] =>
      stmts.byRange.all(from, to).map(toMovement),
    balances(): Record<Currency, number> {
      const result: Record<Currency, number> = { ARS: 0, USD: 0 }
      for (const row of stmts.balances.all()) result[row.currency] = row.total
      return result
    },
    lastRate: (): { rateCentsPerUsd: number; date: string } | null => {
      const row = stmts.lastRate.get()
      return row ? { rateCentsPerUsd: row.rate, date: row.date } : null
    },
    insertMovement: (w: MovementWrite): SavingsMovement =>
      getMovement(Number(stmts.insert.run(w).lastInsertRowid)),
    updateMovement: (id: number, w: MovementWrite): SavingsMovement => {
      if (stmts.update.run({ ...w, id, updatedAt: nowIso() }).changes === 0)
        notFound('El movimiento')
      return getMovement(id)
    },
    softDeleteMovement: (id: number): void => {
      if (stmts.softDelete.run(nowIso(), id).changes === 0) notFound('El movimiento')
    },
    restoreMovement: (id: number): void => void stmts.restore.run(id),
    purgeDeletedBefore: (iso: string): number => stmts.purge.run(iso).changes,

    getGoal,
    listGoals: (): SavingsGoal[] => stmts.goals.all().map(toGoal),
    insertGoal: (input: SavingsGoalInput): SavingsGoal => {
      try {
        return getGoal(Number(stmts.insertGoal.run(input).lastInsertRowid))
      } catch (err) {
        return translateSqliteError(err, DUP)
      }
    },
    updateGoal: (id: number, input: SavingsGoalInput): SavingsGoal => {
      if (stmts.updateGoal.run({ ...input, id }).changes === 0) notFound('La meta')
      return getGoal(id)
    },
    setGoalArchived: (id: number, archived: boolean): SavingsGoal => {
      if (stmts.archiveGoal.run(archived ? nowIso() : null, id).changes === 0) notFound('La meta')
      return getGoal(id)
    },
  }
}
