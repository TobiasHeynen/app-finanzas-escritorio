import { addMonths, clampDay, monthOf, parseDate, type IsoDate, type Month } from '@shared/months'
import type { PaymentMethodType } from '@shared/types'

export interface ChargeMethod {
  type: PaymentMethodType
  closingDay: number | null
}

/**
 * Mes de imputación (charge_month) de una compra.
 * - Efectivo, débito y transferencia: el mes de la compra.
 * - Tarjeta de crédito: si el día de compra <= día de cierre, entra en el resumen que cierra ese mes;
 *   si es posterior, en el que cierra el mes siguiente. El gasto impacta en el mes de VENCIMIENTO de ese
 *   resumen, que es el mes de cierre + 1.
 *   El día de cierre se ajusta al largo del mes (cierre 31 en febrero = 28/29).
 */
export function computeChargeMonth(purchaseDate: IsoDate, method: ChargeMethod): Month {
  const purchaseMonth = monthOf(purchaseDate)
  if (method.type !== 'tarjeta_credito') return purchaseMonth
  if (method.closingDay === null) throw new Error('La tarjeta no tiene día de cierre')

  const { day } = parseDate(purchaseDate)
  const closingDay = clampDay(purchaseMonth, method.closingDay)
  const closingMonth = day <= closingDay ? purchaseMonth : addMonths(purchaseMonth, 1)
  return addMonths(closingMonth, 1)
}

/** Mes de cierre del resumen que se paga en `chargeMonth` (para mostrar "cierra el 25/10"). */
export function closingMonthFor(chargeMonth: Month): Month {
  return addMonths(chargeMonth, -1)
}
