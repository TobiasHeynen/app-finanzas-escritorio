import { useState } from 'react'
import { ExpenseForm } from '@/features/gastos/expense-form'
import { takeExpenseTarget } from '@/features/gastos/open-expense'
import { useCatalog } from '@/lib/catalog'

export default function GastoScreen() {
  const [target] = useState(takeExpenseTarget)
  const { ready } = useCatalog()
  // El estado inicial del form sale del catálogo (último medio de pago): esperar a que esté.
  if (!ready) return null
  return <ExpenseForm expense={target.expense} defaults={target.defaults} />
}
