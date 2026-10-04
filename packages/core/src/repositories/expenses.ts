import type { SqlDb as Db } from '../db/sql'
import type { Expense, ExpenseGroup, ExpenseSplit } from '@shared/types'
import type { Month } from '@shared/months'
import { groupParams, nowIso, notFound, placeholders, toExpenseGroup } from './util'

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
  group_id: number | null
  paid_by_member_id: number | null
  /** "12:,13:" (partes iguales) o "12:1000,13:3000" (a mano): ver SELECT. */
  shares: string | null
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
  group: ExpenseGroup | null
}

export interface ExpenseFilter {
  fromMonth: Month
  toMonth: Month
  text?: string | null
  categoryId?: number | null
  paymentMethodId?: number | null
  groupId?: number | null
}

/** Persona de un gasto de grupo: cents null = parte igual. */
export interface ShareWrite {
  memberId: number
  cents: number | null
}

const SELECT = `
  SELECT e.*, s.category_id, p.installments_count,
    (SELECT group_concat(x, ',') FROM (
      SELECT es.member_id || ':' || COALESCE(es.share_cents, '') AS x FROM expense_shares es
      WHERE es.expense_id = e.id ORDER BY es.member_id)) AS shares
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
    group: toGroupWithSplit(r),
  }
}

function toGroupWithSplit(r: Row): (ExpenseGroup & { split: ExpenseSplit }) | null {
  const group = toExpenseGroup(r)
  if (!group) return null
  const parts = (r.shares ?? '')
    .split(',')
    .filter(Boolean)
    .map((p) => {
      const [member, cents] = p.split(':')
      return { memberId: Number(member), cents: cents ? Number(cents) : null }
    })
  const custom = parts.length > 0 && parts.every((p) => p.cents !== null)
  return {
    ...group,
    split: custom
      ? {
          kind: 'custom',
          shares: parts.map((p) => ({ memberId: p.memberId, cents: p.cents ?? 0 })),
        }
      : { kind: 'equal', memberIds: parts.map((p) => p.memberId) },
  }
}

const toParams = ({ group, ...w }: ExpenseWrite) => ({
  ...w,
  ...groupParams(group),
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
         charge_month_locked, amount_cents, installment_plan_id, installment_number, recurring_template_id, notes,
         group_id, paid_by_member_id)
       VALUES (@subcategoryId, @paymentMethodId, @description, @purchaseDate, @chargeMonth,
         @chargeMonthLocked, @amountCents, @installmentPlanId, @installmentNumber, @recurringTemplateId, @notes,
         @groupId, @paidByMemberId)`,
    ),
    update: db.prepare(
      `UPDATE expenses SET subcategory_id = @subcategoryId, payment_method_id = @paymentMethodId,
         description = @description, purchase_date = @purchaseDate, charge_month = @chargeMonth,
         charge_month_locked = @chargeMonthLocked, amount_cents = @amountCents, notes = @notes,
         group_id = @groupId, paid_by_member_id = @paidByMemberId, updated_at = @updatedAt
       WHERE id = @id AND deleted_at IS NULL`,
    ),
    setAmount: db.prepare(
      'UPDATE expenses SET amount_cents = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
    ),
    purge: db.prepare('DELETE FROM expenses WHERE deleted_at IS NOT NULL AND deleted_at < ?'),
    byGroup: db.prepare<[number], Row>(
      `${SELECT} WHERE e.deleted_at IS NULL AND e.group_id = ? ${ORDER}`,
    ),
    deleteShares: db.prepare('DELETE FROM expense_shares WHERE expense_id = ?'),
    insertShare: db.prepare(
      'INSERT INTO expense_shares (expense_id, member_id, share_cents) VALUES (?, ?, ?)',
    ),
    sharesToEqual: db.prepare('UPDATE expense_shares SET share_cents = NULL WHERE expense_id = ?'),
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
    listByGroup: (groupId: number): Expense[] => stmts.byGroup.all(groupId).map(toExpense),

    /** Reemplaza quiénes participan de un gasto (vacío = gasto personal). */
    setShares(expenseId: number, shares: ShareWrite[]): void {
      stmts.deleteShares.run(expenseId)
      for (const s of shares) stmts.insertShare.run(expenseId, s.memberId, s.cents)
    },

    /** Pasa un reparto a mano a partes iguales entre las mismas personas (cuando cambia el monto). */
    sharesToEqual(expenseId: number): void {
      stmts.sharesToEqual.run(expenseId)
    },

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
      if (filter.groupId) {
        where.push('e.group_id = @groupId')
        params['groupId'] = filter.groupId
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
      const { group, ...rest } = w
      const info = stmts.update.run({
        ...rest,
        ...groupParams(group),
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
        group: ExpenseGroup | null
      },
    ): void {
      const { group, ...rest } = w
      const info = db
        .prepare(
          `UPDATE expenses SET subcategory_id = @subcategoryId, payment_method_id = @paymentMethodId,
             description = @description, amount_cents = @amountCents, notes = @notes,
             group_id = @groupId, paid_by_member_id = @paidByMemberId, updated_at = @updatedAt
           WHERE id = @id AND deleted_at IS NULL`,
        )
        .run({ ...rest, ...groupParams(group), id, updatedAt: nowIso() })
      if (info.changes === 0) notFound('La cuota')
    },

    purgeDeletedBefore(iso: string): number {
      return stmts.purge.run(iso).changes
    },

    pendingCount: (month: Month): number => stmts.pendingCount.get(month)?.n ?? 0,
  }
}
