import type { SqlDb as Db } from '../db/sql'
import type { Expense } from '@shared/types'
import type { Month } from '@shared/months'
import { nowIso, notFound, placeholders } from './util'

interface Row {
  id: number
  subcategory_id: number
  category_id: number
  payment_method_id: number
  description: string
  purchase_date: string
  charge_month: string
  charge_month_locked: number
  amount_cents: number | null
  installment_plan_id: number | null
  installment_number: number | null
  installments_count: number | null
  recurring_template_id: number | null
  notes: string | null
}

export interface ExpenseWrite {
  subcategoryId: number
  paymentMethodId: number
  description: string
  purchaseDate: string
  chargeMonth: string
  chargeMonthLocked: boolean
  amountCents: number | null
  installmentPlanId: number | null
  installmentNumber: number | null
  recurringTemplateId: number | null
  notes: string | null
}

export interface ExpenseFilter {
  fromMonth: Month
  toMonth: Month
  text?: string | null
  categoryId?: number | null
  paymentMethodId?: number | null
}

const SELECT = `
  SELECT e.*, s.category_id, p.installments_count
  FROM expenses e
  JOIN subcategories s ON s.id = e.subcategory_id
  LEFT JOIN installment_plans p ON p.id = e.installment_plan_id`

const ORDER = 'ORDER BY e.purchase_date DESC, e.id DESC'

export function toExpense(r: Row): Expense {
  return {
    id: r.id,
    subcategoryId: r.subcategory_id,
    categoryId: r.category_id,
    paymentMethodId: r.payment_method_id,
    description: r.description,
    purchaseDate: r.purchase_date,
    chargeMonth: r.charge_month,
    chargeMonthLocked: r.charge_month_locked === 1,
    amountCents: r.amount_cents,
    installment:
      r.installment_plan_id !== null && r.installment_number !== null
        ? {
            planId: r.installment_plan_id,
            number: r.installment_number,
            count: r.installments_count ?? r.installment_number,
          }
        : null,
    recurringTemplateId: r.recurring_template_id,
    notes: r.notes,
  }
}

const toParams = (w: ExpenseWrite) => ({
  ...w,
  chargeMonthLocked: w.chargeMonthLocked ? 1 : 0,
})

export type ExpensesRepo = ReturnType<typeof createExpensesRepo>

export function createExpensesRepo(db: Db) {
  const stmts = {
    get: db.prepare<[number], Row>(`${SELECT} WHERE e.id = ? AND e.deleted_at IS NULL`),
    byMonth: db.prepare<[string], Row>(
      `${SELECT} WHERE e.deleted_at IS NULL AND e.charge_month = ? ${ORDER}`,
    ),
    byRange: db.prepare<[string, string], Row>(
      `${SELECT} WHERE e.deleted_at IS NULL AND e.charge_month BETWEEN ? AND ? ${ORDER}`,
    ),
    byPlan: db.prepare<[number], Row>(
      `${SELECT} WHERE e.deleted_at IS NULL AND e.installment_plan_id = ? ORDER BY e.installment_number`,
    ),
    insert: db.prepare(
      `INSERT INTO expenses (subcategory_id, payment_method_id, description, purchase_date, charge_month,
         charge_month_locked, amount_cents, installment_plan_id, installment_number, recurring_template_id, notes)
       VALUES (@subcategoryId, @paymentMethodId, @description, @purchaseDate, @chargeMonth,
         @chargeMonthLocked, @amountCents, @installmentPlanId, @installmentNumber, @recurringTemplateId, @notes)`,
    ),
    update: db.prepare(
      `UPDATE expenses SET subcategory_id = @subcategoryId, payment_method_id = @paymentMethodId,
         description = @description, purchase_date = @purchaseDate, charge_month = @chargeMonth,
         charge_month_locked = @chargeMonthLocked, amount_cents = @amountCents, notes = @notes,
         updated_at = @updatedAt
       WHERE id = @id AND deleted_at IS NULL`,
    ),
    setAmount: db.prepare(
      'UPDATE expenses SET amount_cents = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    ),
    purge: db.prepare('DELETE FROM expenses WHERE deleted_at IS NOT NULL AND deleted_at < ?'),
    pendingCount: db.prepare<[string], { n: number }>(
      'SELECT COUNT(*) AS n FROM expenses WHERE deleted_at IS NULL AND charge_month = ? AND amount_cents IS NULL',
    ),
  }

  const get = (id: number): Expense => toExpense(stmts.get.get(id) ?? notFound('El gasto'))

  return {
    get,
    find: (id: number): Expense | null => {
      const row = stmts.get.get(id)
      return row ? toExpense(row) : null
    },
    listByMonth: (month: Month): Expense[] => stmts.byMonth.all(month).map(toExpense),
    listByRange: (from: Month, to: Month): Expense[] => stmts.byRange.all(from, to).map(toExpense),
    listByPlan: (planId: number): Expense[] => stmts.byPlan.all(planId).map(toExpense),

    search(filter: ExpenseFilter): Expense[] {
      const where = ['e.deleted_at IS NULL', 'e.charge_month BETWEEN @fromMonth AND @toMonth']
      const params: Record<string, unknown> = {
        fromMonth: filter.fromMonth,
        toMonth: filter.toMonth,
      }
      if (filter.categoryId) {
        where.push('s.category_id = @categoryId')
        params['categoryId'] = filter.categoryId
      }
      if (filter.paymentMethodId) {
        where.push('e.payment_method_id = @paymentMethodId')
        params['paymentMethodId'] = filter.paymentMethodId
      }
      if (filter.text?.trim()) {
        where.push(
          `(e.description LIKE @text ESCAPE '\\' OR e.notes LIKE @text ESCAPE '\\' OR s.name LIKE @text ESCAPE '\\')`,
        )
        params['text'] = `%${filter.text.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`
      }
      return db
        .prepare<Record<string, unknown>, Row>(
          `${SELECT} WHERE ${where.join(' AND ')} ${ORDER} LIMIT 2000`,
        )
        .all(params)
        .map(toExpense)
    },

    insert(w: ExpenseWrite): number {
      return Number(stmts.insert.run(toParams(w)).lastInsertRowid)
    },

    update(
      id: number,
      w: Omit<ExpenseWrite, 'installmentPlanId' | 'installmentNumber' | 'recurringTemplateId'>,
    ): void {
      const info = stmts.update.run({
        ...w,
        chargeMonthLocked: w.chargeMonthLocked ? 1 : 0,
        id,
        updatedAt: nowIso(),
      })
      if (info.changes === 0) notFound('El gasto')
    },

    setAmount(id: number, amountCents: number | null): void {
      const info = stmts.setAmount.run(amountCents, nowIso(), id)
      if (info.changes === 0) notFound('El gasto')
    },

    /** Soft delete: devuelve los ids efectivamente borrados (para "deshacer"). */
    softDelete(ids: number[]): number[] {
      if (ids.length === 0) return []
      const rows = db
        .prepare<number[], { id: number }>(
          `UPDATE expenses SET deleted_at = ? WHERE deleted_at IS NULL AND id IN (${placeholders(ids.length)}) RETURNING id`,
        )
        .all(...([nowIso(), ...ids] as unknown as number[]))
      return rows.map((r) => r.id)
    },

    restore(ids: number[]): number {
      if (ids.length === 0) return 0
      return db
        .prepare(
          `UPDATE expenses SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND id IN (${placeholders(ids.length)})`,
        )
        .run(...ids).changes
    },

    /** Borrado físico (al regenerar cuotas de un plan). */
    deleteHard(ids: number[]): void {
      if (ids.length === 0) return
      db.prepare(`DELETE FROM expenses WHERE id IN (${placeholders(ids.length)})`).run(...ids)
    },

    updateInstallment(
      id: number,
      w: {
        subcategoryId: number
        paymentMethodId: number
        description: string
        amountCents: number
        notes: string | null
      },
    ): void {
      const info = db
        .prepare(
          `UPDATE expenses SET subcategory_id = @subcategoryId, payment_method_id = @paymentMethodId,
             description = @description, amount_cents = @amountCents, notes = @notes, updated_at = @updatedAt
           WHERE id = @id AND deleted_at IS NULL`,
        )
        .run({ ...w, id, updatedAt: nowIso() })
      if (info.changes === 0) notFound('La cuota')
    },

    purgeDeletedBefore(iso: string): number {
      return stmts.purge.run(iso).changes
    },

    pendingCount: (month: Month): number => stmts.pendingCount.get(month)?.n ?? 0,
  }
}
