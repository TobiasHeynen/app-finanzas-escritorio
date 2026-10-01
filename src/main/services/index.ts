import type { ServiceContext } from './context'
import { createCardsService } from './cards'
import { createExpensesService } from './expenses'
import { createIncomesService } from './incomes'
import { createRecurringService } from './recurring'
import { createSummaryService } from './summary'

export function createServices(ctx: ServiceContext) {
  const recurring = createRecurringService(ctx)
  return {
    ctx,
    expenses: createExpensesService(ctx),
    incomes: createIncomesService(ctx),
    cards: createCardsService(ctx),
    recurring,
    summary: createSummaryService(ctx, recurring),
  }
}

export type Services = ReturnType<typeof createServices>
