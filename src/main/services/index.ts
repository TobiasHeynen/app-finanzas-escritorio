import type { ServiceContext } from './context'
import { createExpensesService } from './expenses'
import { createRecurringService } from './recurring'
import { createSummaryService } from './summary'

export function createServices(ctx: ServiceContext) {
  const recurring = createRecurringService(ctx)
  return {
    ctx,
    expenses: createExpensesService(ctx),
    recurring,
    summary: createSummaryService(ctx, recurring),
  }
}

export type Services = ReturnType<typeof createServices>
