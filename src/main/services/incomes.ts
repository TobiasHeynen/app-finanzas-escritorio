import { dateInMonth, parseDate, type Month } from '@shared/months'
import type { Income } from '@shared/types'
import type { ServiceContext } from './context'

export type IncomesService = ReturnType<typeof createIncomesService>

export function createIncomesService({ repos }: ServiceContext) {
  return {
    /**
     * Copia el último sueldo cargado antes de `month` a ese mes (mismo monto y descripción, mismo día).
     * Devuelve null si no hay ningún sueldo anterior.
     */
    copyPreviousSalary(month: Month): Income | null {
      const previous = repos.incomes.lastOfTypeBefore('sueldo', month)
      if (!previous) return null
      return repos.incomes.insert({
        month,
        type: 'sueldo',
        description: previous.description,
        amountCents: previous.amountCents,
        date: dateInMonth(month, parseDate(previous.date).day),
      })
    },
  }
}
