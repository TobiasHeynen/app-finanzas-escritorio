import { splitInstallments, type Cents } from '@shared/money'
import { addMonths, type Month } from '@shared/months'

export interface InstallmentRow {
  number: number
  month: Month
  amountCents: Cents
}

export interface ScheduleInput {
  totalCents: Cents
  installmentsCount: number
  /** Mes en que se cobra la cuota 1. */
  firstChargeMonth: Month
  /** Primera cuota a generar (para planes ya empezados). Por defecto 1. */
  fromInstallment?: number
}

/**
 * Cronograma de cuotas: el total se reparte con splitInstallments (resto en la cuota 1) y cada cuota cae
 * en meses consecutivos desde firstChargeMonth. Con fromInstallment se devuelven sólo las cuotas N..total.
 */
export function buildInstallmentSchedule(input: ScheduleInput): InstallmentRow[] {
  const from = input.fromInstallment ?? 1
  if (!Number.isInteger(from) || from < 1 || from > input.installmentsCount) {
    throw new RangeError(`Cuota inicial inválida: ${from}`)
  }
  return splitInstallments(input.totalCents, input.installmentsCount)
    .map((amountCents, i) => ({
      number: i + 1,
      month: addMonths(input.firstChargeMonth, i),
      amountCents,
    }))
    .filter((row) => row.number >= from)
}

/**
 * Mes de la cuota 1 a partir del mes en que cae la cuota N.
 * Ej.: voy por la 7/12 y se cobra en 2026-10 → la 1 fue en 2026-04.
 */
export function firstChargeMonthFrom(monthOfInstallment: Month, installmentNumber: number): Month {
  return addMonths(monthOfInstallment, -(installmentNumber - 1))
}

/** Texto "3/12". */
export function installmentLabel(number: number, count: number): string {
  return `${number}/${count}`
}
