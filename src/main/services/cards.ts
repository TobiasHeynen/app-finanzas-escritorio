import { addMonths, clampDay, dateInMonth, monthRange, parseDate, type Month } from '@shared/months'
import type { CardsOverview, PlanProgress } from '@shared/types'
import { currentMonthOf, type ServiceContext } from './context'

const HORIZON_MONTHS = 12

/**
 * Pantalla de tarjetas: por cada tarjeta de crédito, lo que vence este mes, el resumen abierto
 * (el que se está acumulando), las cuotas activas y lo comprometido a futuro.
 */
export function createCardsService({ db, clock }: ServiceContext) {
  const totals = db.prepare<[number, string, string], { charge_month: string; total: number; n: number; pending: number }>(
    `SELECT charge_month, COALESCE(SUM(amount_cents), 0) AS total, COUNT(*) AS n,
            SUM(CASE WHEN amount_cents IS NULL THEN 1 ELSE 0 END) AS pending
     FROM expenses
     WHERE deleted_at IS NULL AND payment_method_id = ? AND charge_month BETWEEN ? AND ?
     GROUP BY charge_month`,
  )
  const plans = db.prepare<
    { method: number; month: string },
    {
      id: number
      description: string
      subcategory_id: number
      category_id: number
      installments_count: number
      last_month: string
      last_number: number
      remaining: number
      next_amount: number | null
      paid_count: number
    }
  >(
    `SELECT p.id, p.description, p.subcategory_id, s.category_id, p.installments_count,
            MAX(e.charge_month) AS last_month,
            MAX(e.installment_number) AS last_number,
            COALESCE(SUM(CASE WHEN e.charge_month > @month THEN e.amount_cents END), 0) AS remaining,
            (SELECT e2.amount_cents FROM expenses e2 WHERE e2.installment_plan_id = p.id
               AND e2.deleted_at IS NULL AND e2.charge_month >= @month
             ORDER BY e2.installment_number LIMIT 1) AS next_amount,
            MIN(e.installment_number) - 1
              + SUM(CASE WHEN e.charge_month <= @month THEN 1 ELSE 0 END) AS paid_count
     FROM installment_plans p
     JOIN subcategories s ON s.id = p.subcategory_id
     JOIN expenses e ON e.installment_plan_id = p.id AND e.deleted_at IS NULL
     WHERE p.payment_method_id = @method
     GROUP BY p.id
     HAVING MAX(e.charge_month) >= @month
     ORDER BY MAX(e.charge_month), p.id`,
  )
  const methods = db.prepare<[], { id: number; closing_day: number; due_day: number | null; archived_at: string | null }>(
    `SELECT id, closing_day, due_day, archived_at FROM payment_methods WHERE type = 'tarjeta_credito' ORDER BY sort_order, id`,
  )

  return {
    overview(): CardsOverview {
      const current = currentMonthOf(clock)
      const today = clock.today()
      const horizon = addMonths(current, HORIZON_MONTHS)
      const futureMonths = monthRange(addMonths(current, 1), horizon)
      const committed = new Map<Month, Record<number, number>>(futureMonths.map((m) => [m, {}]))

      const cards = methods.all().flatMap((m) => {
        const byMonth = new Map(totals.all(m.id, current, horizon).map((r) => [r.charge_month, r]))
        // Resumen abierto: si hoy es <= día de cierre, cierra este mes (se paga el que viene).
        const closingThisMonth = clampDay(current, m.closing_day)
        const closesThisMonth = parseDate(today).day <= closingThisMonth
        const openCharge = addMonths(current, closesThisMonth ? 1 : 2)
        const closingMonth = addMonths(openCharge, -1)
        const planRows = plans.all({ method: m.id, month: current })
        const hasActivity = byMonth.size > 0 || planRows.length > 0
        if (m.archived_at !== null && !hasActivity) return []

        let committedCents = 0
        for (const month of futureMonths) {
          const total = byMonth.get(month)?.total ?? 0
          committedCents += total
          const entry = committed.get(month)
          if (entry && total > 0) entry[m.id] = total
        }

        const due = byMonth.get(current)
        const open = byMonth.get(openCharge)
        const planProgress: PlanProgress[] = planRows.map((p) => ({
          planId: p.id,
          description: p.description,
          subcategoryId: p.subcategory_id,
          categoryId: p.category_id,
          installmentsCount: p.installments_count,
          paidCount: Math.max(0, p.paid_count),
          nextAmountCents: p.next_amount,
          remainingCents: p.remaining,
          lastMonth: p.last_month,
        }))

        return [
          {
            paymentMethodId: m.id,
            dueThisMonth: {
              month: current,
              dueDate: m.due_day ? dateInMonth(current, m.due_day) : null,
              totalCents: due?.total ?? 0,
              count: due?.n ?? 0,
              pendingCount: due?.pending ?? 0,
            },
            openStatement: {
              chargeMonth: openCharge,
              closingDate: dateInMonth(closingMonth, m.closing_day),
              totalCents: open?.total ?? 0,
              count: open?.n ?? 0,
            },
            plans: planProgress,
            committedCents,
          },
        ]
      })

      const committedByMonth = futureMonths.map((month) => {
        const byCard = committed.get(month) ?? {}
        return {
          month,
          byCard: Object.entries(byCard).map(([id, totalCents]) => ({
            paymentMethodId: Number(id),
            totalCents,
          })),
          totalCents: Object.values(byCard).reduce((a, b) => a + b, 0),
        }
      })

      return {
        currentMonth: current,
        cards,
        committedByMonth,
        committedTotalCents: committedByMonth.reduce((a, m) => a + m.totalCents, 0),
      }
    },
  }
}

export type CardsService = ReturnType<typeof createCardsService>
