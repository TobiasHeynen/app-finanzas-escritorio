import type { ServiceContext } from './context'
import { createCardsService } from './cards'
import { createExpensesService } from './expenses'
import { createExportService } from './export'
import { createIncomesService } from './incomes'
import { createRecurringService } from './recurring'
import { createReportService } from './report'
import { createSavingsService } from './savings'
import { createSummaryService } from './summary'

export function createServices(ctx: ServiceContext) {
  const recurring = createRecurringService(ctx)
  return {
    ctx,
    expenses: createExpensesService(ctx),
    incomes: createIncomesService(ctx),
    cards: createCardsService(ctx),
    recurring,
    savings: createSavingsService(ctx),
    report: createReportService(ctx, recurring),
    exporter: createExportService(ctx),
    summary: createSummaryService(ctx, recurring),
  }
}

export type Services = ReturnType<typeof createServices>
