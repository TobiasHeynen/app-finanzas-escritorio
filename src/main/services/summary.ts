import type { Month } from '@shared/months'
import type { Expense, MonthSummary, ProjectedExpense } from '@shared/types'
import type { ServiceContext } from './context'
import type { RecurringService } from './recurring'
import { computeMonthSummary } from './summary-calc'

export interface MonthOverview {
  expenses: Expense[]
  projected: ProjectedExpense[]
  summary: MonthSummary
}

export type SummaryService = ReturnType<typeof createSummaryService>

export function createSummaryService({ repos }: ServiceContext, recurring: RecurringService) {
  return {
    overview(month: Month): MonthOverview {
      recurring.generateDue()
      const expenses = repos.expenses.listByMonth(month)
      const projected = recurring.projectionsFor(month)
      const result = computeMonthSummary({
        incomes: repos.incomes.listByMonth(month),
        expenses: [
          ...expenses,
          ...projected.map((p) => ({
            amountCents: p.amountCents,
            categoryId: p.categoryId,
            projected: true,
          })),
        ],
        savings: repos.savings.listByMonth(month),
      })
      return { expenses, projected, summary: { month, ...result } }
    },
  }
}
