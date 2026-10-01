import { AppError } from '@shared/errors'
import { compareMonths, dateInMonth, type Month } from '@shared/months'
import type { ProjectedExpense, RecurringTemplate, RecurringTemplateInput } from '@shared/types'
import { currentMonthOf, type ServiceContext } from './context'
import { monthsToGenerate, templateAppliesTo } from './recurring-schedule'

export type RecurringService = ReturnType<typeof createRecurringService>

/**
 * Gastos recurrentes. Cada plantilla genera un gasto por mes, con charge_month = ese mes (fijado) y
 * fecha = día de la plantilla ajustado al largo del mes. Si no tiene monto por defecto, queda pendiente.
 */
export function createRecurringService({ db, repos, clock }: ServiceContext) {
  const { recurring, expenses, catalog, paymentMethods } = repos

  function checkRefs(input: RecurringTemplateInput, previous?: RecurringTemplate) {
    const sub = catalog.getSubcategory(input.subcategoryId)
    if ((sub.archived || sub.categoryArchived) && previous?.subcategoryId !== input.subcategoryId) {
      throw new AppError('VALIDATION', 'La subcategoría está archivada')
    }
    const method = paymentMethods.get(input.paymentMethodId)
    if (method.archived && previous?.paymentMethodId !== input.paymentMethodId) {
      throw new AppError('VALIDATION', 'El medio de pago está archivado')
    }
  }

  /**
   * Genera los gastos que falten de todas las plantillas activas, hasta el mes actual inclusive.
   * Idempotente: recurring_generations tiene PK (template_id, month). Devuelve cuántos generó.
   */
  function generateDue(): number {
    const current = currentMonthOf(clock)
    let created = 0
    db.transaction(() => {
      for (const t of recurring.list()) {
        for (const month of monthsToGenerate(t, recurring.generatedMonths(t.id), current)) {
          const expenseId = expenses.insert({
            subcategoryId: t.subcategoryId,
            paymentMethodId: t.paymentMethodId,
            description: t.description,
            purchaseDate: dateInMonth(month, t.dayOfMonth),
            chargeMonth: month,
            chargeMonthLocked: true,
            amountCents: t.defaultAmountCents,
            installmentPlanId: null,
            installmentNumber: null,
            recurringTemplateId: t.id,
            notes: null,
          })
          recurring.markGenerated(t.id, month, expenseId)
          created++
        }
      }
    })()
    return created
  }

  /** Recurrentes proyectados para un mes futuro (no se guardan). Vacío para el mes actual o pasados. */
  function projectionsFor(month: Month): ProjectedExpense[] {
    if (compareMonths(month, currentMonthOf(clock)) <= 0) return []
    return recurring
      .list()
      .filter((t) => templateAppliesTo(t, month))
      .map((t) => ({
        templateId: t.id,
        description: t.description,
        subcategoryId: t.subcategoryId,
        categoryId: t.categoryId,
        paymentMethodId: t.paymentMethodId,
        amountCents: t.defaultAmountCents,
        date: dateInMonth(month, t.dayOfMonth),
        month,
      }))
  }

  return {
    generateDue,
    projectionsFor,
    list: (): RecurringTemplate[] => recurring.list(),
    create(input: RecurringTemplateInput): RecurringTemplate {
      checkRefs(input)
      const id = recurring.insert(input)
      generateDue()
      return recurring.get(id)
    },
    update(id: number, input: RecurringTemplateInput): RecurringTemplate {
      const previous = recurring.get(id)
      checkRefs(input, previous)
      recurring.update(id, input)
      generateDue()
      return recurring.get(id)
    },
    /** Borra la plantilla. Los gastos ya generados quedan. */
    remove(id: number): void {
      recurring.delete(id)
    },
  }
}
