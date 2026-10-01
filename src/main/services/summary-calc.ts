import { sumCents, type Cents, type Currency } from '@shared/money'

export interface SummaryInputs {
  incomes: { amountCents: Cents }[]
  /** Gastos del mes; amountCents null = pendiente. */
  expenses: { amountCents: Cents | null; categoryId: number; projected?: boolean }[]
  savings: { currency: Currency; amountMinor: Cents; arsCostCents: Cents | null }[]
}

export interface SummaryResult {
  incomeCents: Cents
  spentCents: Cents
  savedCents: Cents
  availableCents: Cents
  pendingCount: number
  projectedCount: number
  byCategory: { categoryId: number; amountCents: Cents }[]
}

/**
 * Efecto en pesos de un movimiento de ahorro sobre el disponible (positivo = sale plata del mes).
 * - ARS: aporte resta su monto, retiro lo suma.
 * - USD: compra resta los ARS pagados; venta suma los ARS recibidos. Sin ARS informados, no afecta.
 */
export function savingsArsOutflow(m: SummaryInputs['savings'][number]): Cents {
  if (m.currency === 'ARS') return m.amountMinor
  if (m.arsCostCents === null) return 0
  return m.amountMinor > 0 ? m.arsCostCents : -m.arsCostCents
}

/**
 * Disponible del mes ("queda para el mes") =
 *   ingresos − gastos con monto − aportes de ahorro en ARS (incluye ARS de compras de USD)
 *   + retiros de ahorro en ARS (incluye ARS de ventas de USD).
 * Los gastos pendientes no restan; se informan aparte en pendingCount.
 * Los gastos proyectados (recurrentes futuros) sí restan si tienen monto.
 */
export function computeMonthSummary(input: SummaryInputs): SummaryResult {
  const incomeCents = sumCents(input.incomes.map((i) => i.amountCents))
  const spentCents = sumCents(input.expenses.map((e) => e.amountCents))
  const savedCents = sumCents(input.savings.map(savingsArsOutflow))
  const byCategoryMap = new Map<number, Cents>()
  let pendingCount = 0
  let projectedCount = 0
  for (const e of input.expenses) {
    if (e.projected) projectedCount++
    if (e.amountCents === null) {
      pendingCount++
      continue
    }
    byCategoryMap.set(e.categoryId, (byCategoryMap.get(e.categoryId) ?? 0) + e.amountCents)
  }
  const byCategory = [...byCategoryMap]
    .map(([categoryId, amountCents]) => ({ categoryId, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents)
  return {
    incomeCents,
    spentCents,
    savedCents,
    availableCents: incomeCents - spentCents - savedCents,
    pendingCount,
    projectedCount,
    byCategory,
  }
}
