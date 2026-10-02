import type { Expense } from '@shared/types'
import { openWith, takePayload } from '@/lib/nav-payload'

export interface ExpenseDefaults {
  purchaseDate?: string
  subcategoryId?: number
  paymentMethodId?: number
  description?: string
  amountCents?: number | null
}

interface Target {
  expense: Expense | null
  defaults?: ExpenseDefaults | undefined
}

export function openNewExpense(defaults?: ExpenseDefaults): void {
  openWith<Target>('/gasto', { expense: null, defaults })
}

export function openEditExpense(expense: Expense): void {
  openWith<Target>('/gasto', { expense })
}

export function takeExpenseTarget(): Target {
  return takePayload<Target>('/gasto', { expense: null })
}
