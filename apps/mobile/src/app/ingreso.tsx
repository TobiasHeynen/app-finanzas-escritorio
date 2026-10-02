import { useState } from 'react'
import { currentMonth } from '@shared/months'
import { IncomeForm } from '@/features/ingresos/income-form'
import type { IncomeTarget } from '@/features/ingresos/incomes-card'
import { takePayload } from '@/lib/nav-payload'

export default function IngresoScreen() {
  const [target] = useState(() =>
    takePayload<IncomeTarget>('/ingreso', { income: null, month: currentMonth() }),
  )
  return <IncomeForm income={target.income} month={target.month} />
}
