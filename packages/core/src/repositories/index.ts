import type { SqlDb as Db } from '../db/sql'
import { createCatalogRepo } from './catalog'
import { createExpensesRepo } from './expenses'
import { createIncomesRepo } from './incomes'
import { createInstallmentPlansRepo } from './installment-plans'
import { createPaymentMethodsRepo } from './payment-methods'
import { createRecurringRepo } from './recurring'
import { createSavingsRepo } from './savings'
import { createSettingsRepo } from './settings'

export function createRepos(db: Db) {
  return {
    catalog: createCatalogRepo(db),
    paymentMethods: createPaymentMethodsRepo(db),
    settings: createSettingsRepo(db),
    expenses: createExpensesRepo(db),
    plans: createInstallmentPlansRepo(db),
    recurring: createRecurringRepo(db),
    incomes: createIncomesRepo(db),
    savings: createSavingsRepo(db),
  }
}

export type Repos = ReturnType<typeof createRepos>
