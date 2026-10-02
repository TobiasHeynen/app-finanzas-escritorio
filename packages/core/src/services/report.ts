import { mulDivRound } from '@shared/money'
import { compareMonths, monthsOfYear, parseMonth, type Month } from '@shared/months'
import type { ReportRow, YearReport } from '@shared/types'
import { currentMonthOf, type ServiceContext } from './context'
import type { RecurringService } from './recurring'
import { savingsArsOutflow } from './summary-calc'

const zeros = (): number[] => Array.from({ length: 12 }, () => 0)
const inc = (arr: number[], i: number, v: number) => {
  arr[i] = (arr[i] ?? 0) + v
}
const at = (arr: number[], i: number) => arr[i] ?? 0

function row(byMonth: number[], monthsWithData: number): ReportRow {
  const totalCents = byMonth.reduce((a, b) => a + b, 0)
  return {
    byMonth,
    totalCents,
    averageCents: monthsWithData > 0 ? mulDivRound(totalCents, 1, monthsWithData) : 0,
  }
}

export type ReportService = ReturnType<typeof createReportService>

export function createReportService(
  { db, repos, clock }: ServiceContext,
  recurring: RecurringService,
) {
  const yearsStmt = db.prepare<[], { year: string }>(`
    SELECT substr(charge_month, 1, 4) AS year FROM expenses WHERE deleted_at IS NULL
    UNION SELECT substr(month, 1, 4) FROM incomes WHERE deleted_at IS NULL
    UNION SELECT substr(month, 1, 4) FROM savings_movements WHERE deleted_at IS NULL`)

  return {
    /**
     * Reporte anual: gastos por categoría y subcategoría mes a mes, ingresos, ahorro y disponible.
     * Los meses futuros incluyen los recurrentes proyectados con monto (igual que la vista del mes).
     * El promedio mensual divide por los meses del año que tienen algún gasto o ingreso.
     */
    year(year: number): YearReport {
      recurring.generateDue()
      const months = monthsOfYear(year)
      const first = months[0] ?? `${String(year)}-01`
      const last = months[11] ?? `${String(year)}-12`
      const current = currentMonthOf(clock)
      const index = (m: Month) => parseMonth(m).month - 1

      const income = zeros()
      for (const i of repos.incomes.listByRange(first, last))
        inc(income, index(i.month), i.amountCents)

      const saved = zeros()
      for (const s of repos.savings.listByRange(first, last))
        inc(saved, index(s.month), savingsArsOutflow(s))

      const byCategory = new Map<number, { months: number[]; subs: Map<number, number[]> }>()
      let pendingCount = 0
      const add = (categoryId: number, subcategoryId: number, month: Month, cents: number) => {
        let cat = byCategory.get(categoryId)
        if (!cat) {
          cat = { months: zeros(), subs: new Map() }
          byCategory.set(categoryId, cat)
        }
        let sub = cat.subs.get(subcategoryId)
        if (!sub) {
          sub = zeros()
          cat.subs.set(subcategoryId, sub)
        }
        inc(cat.months, index(month), cents)
        inc(sub, index(month), cents)
      }
      for (const e of repos.expenses.listByRange(first, last)) {
        if (e.amountCents === null) pendingCount++
        else add(e.categoryId, e.subcategoryId, e.chargeMonth, e.amountCents)
      }
      for (const m of months) {
        for (const p of recurring.projectionsFor(m)) {
          if (p.amountCents !== null) add(p.categoryId, p.subcategoryId, m, p.amountCents)
        }
      }

      const spent = zeros()
      for (const c of byCategory.values()) c.months.forEach((v, i) => inc(spent, i, v))
      const available = months.map((_, i) => at(income, i) - at(spent, i) - at(saved, i))
      const monthsWithData = months.filter(
        (_, i) => at(spent, i) !== 0 || at(income, i) !== 0,
      ).length

      const categories = [...byCategory]
        .map(([categoryId, c]) => ({
          categoryId,
          ...row(c.months, monthsWithData),
          subcategories: [...c.subs]
            .map(([subcategoryId, m]) => ({ subcategoryId, ...row(m, monthsWithData) }))
            .sort((a, b) => b.totalCents - a.totalCents),
        }))
        .sort((a, b) => b.totalCents - a.totalCents)

      const years = new Set(yearsStmt.all().map((r) => Number(r.year)))
      years.add(parseMonth(current).year)
      years.add(year)

      return {
        year,
        months,
        projectedFrom: months.find((m) => compareMonths(m, current) > 0) ?? null,
        monthsWithData,
        income: row(income, monthsWithData),
        spent: row(spent, monthsWithData),
        saved: row(saved, monthsWithData),
        available: row(available, monthsWithData),
        pendingCount,
        categories,
        availableYears: [...years].sort((a, b) => b - a),
      }
    },
  }
}
