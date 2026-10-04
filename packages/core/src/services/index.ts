import type { SqlDb } from '../db/sql'
import type { ServiceContext } from './context'
import { createCardsService } from './cards'
import { createExpensesService } from './expenses'
import { createExportDataService } from './export-data'
import { createGroupsService } from './groups'
import { createIncomesService } from './incomes'
import { createRecurringService } from './recurring'
import { createReportService } from './report'
import { createSavingsService } from './savings'
import { createSummaryService } from './summary'

/** Services de la lógica compartida (PC y celu). Cada app suma los suyos (por ejemplo, exportar). */
export function createServices<D extends SqlDb>(ctx: ServiceContext<D>) {
  const recurring = createRecurringService(ctx)
  return {
    ctx,
    expenses: createExpensesService(ctx),
    groups: createGroupsService(ctx),
    incomes: createIncomesService(ctx),
    cards: createCardsService(ctx),
    recurring,
    savings: createSavingsService(ctx),
    exportData: createExportDataService(ctx),
    report: createReportService(ctx, recurring),
    summary: createSummaryService(ctx, recurring),
  }
}

export type Services<D extends SqlDb = SqlDb> = ReturnType<typeof createServices<D>>
