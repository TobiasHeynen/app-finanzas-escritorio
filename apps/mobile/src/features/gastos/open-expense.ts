import { router } from 'expo-router'
import type { Expense } from '@shared/types'

export interface ExpenseDefaults {
  purchaseDate?: string
  subcategoryId?: number
  paymentMethodId?: number
  description?: string
  amountCents?: number | null
}

/**
 * El formulario de gasto es una pantalla aparte (/gasto). El gasto a editar o los valores por defecto
 * se pasan por acá y no por la URL (son objetos).
 */
let pending: { expense: Expense | null; defaults?: ExpenseDefaults | undefined } = {
  expense: null,
}

export function openNewExpense(defaults?: ExpenseDefaults): void {
  pending = { expense: null, defaults }
  router.push('/gasto')
}

export function openEditExpense(expense: Expense): void {
  pending = { expense }
  router.push('/gasto')
}

export function takeExpenseTarget() {
  return pending
}
