import { AppError } from '@shared/errors'
import { addMonths, compareMonths, monthOf, type Month } from '@shared/months'
import { splitInstallments, sumCents } from '@shared/money'
import type {
  Expense,
  ExpenseInput,
  InstallmentPlan,
  InstallmentPlanInput,
  InstallmentPlanUpdate,
  PlanScope,
} from '@shared/types'
import { computeChargeMonth } from '@shared/domain/charge-month'
import { currentMonthOf, type ServiceContext } from './context'
import { buildInstallmentSchedule, firstChargeMonthFrom } from '@shared/domain/installments'
import { toExpenseGroup } from '../repositories/util'
import { checkExpenseGroup, equalShares, resolveExpenseGroup } from './groups'

export type ExpensesService = ReturnType<typeof createExpensesService>

export function createExpensesService({ db, repos, clock }: ServiceContext) {
  const { expenses, plans, catalog, paymentMethods } = repos

  /** Verifica que la subcategoría y el medio de pago existan y (si son nuevos) no estén archivados. */
  function checkRefs(
    subcategoryId: number,
    paymentMethodId: number,
    previous?: { subcategoryId: number; paymentMethodId: number },
  ) {
    const sub = catalog.getSubcategory(subcategoryId)
    if ((sub.archived || sub.categoryArchived) && previous?.subcategoryId !== subcategoryId) {
      throw new AppError('VALIDATION', 'La subcategoría está archivada', {
        subcategoryId: 'Archivada',
      })
    }
    const method = paymentMethods.get(paymentMethodId)
    if (method.archived && previous?.paymentMethodId !== paymentMethodId) {
      throw new AppError('VALIDATION', 'El medio de pago está archivado', {
        paymentMethodId: 'Archivado',
      })
    }
    return method
  }

  function previewChargeMonth(purchaseDate: string, paymentMethodId: number): Month {
    return computeChargeMonth(purchaseDate, paymentMethods.get(paymentMethodId))
  }

  function getPlan(planId: number): InstallmentPlan {
    const plan = plans.get(planId)
    const rows = expenses.listByPlan(planId)
    const sub = catalog.getSubcategory(plan.subcategory_id)
    return {
      id: plan.id,
      description: plan.description,
      subcategoryId: plan.subcategory_id,
      categoryId: sub.categoryId,
      paymentMethodId: plan.payment_method_id,
      purchaseDate: plan.purchase_date,
      totalCents: plan.total_cents,
      installmentsCount: plan.installments_count,
      firstChargeMonth: plan.first_charge_month,
      group: toExpenseGroup(plan),
      installments: rows.map((e) => ({
        expenseId: e.id,
        number: e.installment?.number ?? 0,
        month: e.chargeMonth,
        amountCents: e.amountCents ?? 0,
      })),
    }
  }

  return {
    previewChargeMonth,
    getPlan,

    listByMonth: (month: Month): Expense[] => expenses.listByMonth(month),

    create(input: ExpenseInput): Expense {
      const method = checkRefs(input.subcategoryId, input.paymentMethodId)
      const chargeMonth =
        input.chargeMonthOverride ?? computeChargeMonth(input.purchaseDate, method)
      const { group, shares } = resolveExpenseGroup(repos, input.group, input.amountCents)
      const id = db.transaction(() => {
        const newId = expenses.insert({
          subcategoryId: input.subcategoryId,
          paymentMethodId: input.paymentMethodId,
          description: input.description,
          purchaseDate: input.purchaseDate,
          chargeMonth,
          chargeMonthLocked: input.chargeMonthOverride !== null,
          amountCents: input.amountCents,
          installmentPlanId: null,
          installmentNumber: null,
          recurringTemplateId: null,
          notes: input.notes || null,
          group,
        })
        expenses.setShares(newId, shares)
        return newId
      })()
      return expenses.get(id)
    },

    update(id: number, input: ExpenseInput): Expense {
      const current = expenses.get(id)
      if (current.installment) {
        throw new AppError('VALIDATION', 'Es una cuota: editá el plan de cuotas')
      }
      const method = checkRefs(input.subcategoryId, input.paymentMethodId, current)
      // Si el mes estaba fijado a mano y no viene override, se mantiene; si viene, se fija.
      let chargeMonth: Month
      let locked: boolean
      if (input.chargeMonthOverride !== null) {
        chargeMonth = input.chargeMonthOverride
        locked = true
      } else {
        chargeMonth = computeChargeMonth(input.purchaseDate, method)
        locked = false
      }
      const { group, shares } = resolveExpenseGroup(
        repos,
        input.group,
        input.amountCents,
        current.group,
      )
      db.transaction(() => {
        expenses.update(id, {
          subcategoryId: input.subcategoryId,
          paymentMethodId: input.paymentMethodId,
          description: input.description,
          purchaseDate: input.purchaseDate,
          chargeMonth,
          chargeMonthLocked: locked,
          amountCents: input.amountCents,
          notes: input.notes || null,
          group,
        })
        expenses.setShares(id, shares)
      })()
      return expenses.get(id)
    },

    /** Completa (o vuelve a dejar pendiente) el monto de un gasto. */
    setAmount(id: number, amountCents: number | null): Expense {
      const current = expenses.get(id)
      if (current.installment && amountCents === null) {
        throw new AppError('VALIDATION', 'Una cuota no puede quedar pendiente')
      }
      db.transaction(() => {
        expenses.setAmount(id, amountCents)
        // Un reparto a mano deja de sumar el monto nuevo: pasa a partes iguales entre las mismas personas.
        if (current.group?.split.kind === 'custom' && amountCents !== current.amountCents) {
          expenses.sharesToEqual(id)
        }
      })()
      return expenses.get(id)
    },

    /** Duplica un gasto con fecha de hoy (o el plan entero si es una cuota). */
    duplicate(id: number): Expense {
      const e = expenses.get(id)
      const today = clock.today()
      if (e.installment) {
        const plan = plans.get(e.installment.planId)
        const created = this.createPlan({
          subcategoryId: plan.subcategory_id,
          paymentMethodId: plan.payment_method_id,
          description: plan.description,
          purchaseDate: today,
          totalCents: plan.total_cents,
          installmentsCount: plan.installments_count,
          startAtInstallment: 1,
          firstChargeMonthOverride: null,
          notes: e.notes,
          group: toExpenseGroup(plan),
        })
        const first = created.installments[0]
        if (!first) throw new Error('El plan duplicado no tiene cuotas')
        return expenses.get(first.expenseId)
      }
      return this.create({
        subcategoryId: e.subcategoryId,
        paymentMethodId: e.paymentMethodId,
        description: e.description,
        purchaseDate: today,
        amountCents: e.amountCents,
        chargeMonthOverride: null,
        notes: e.notes,
        group: e.group,
      })
    },

    /** Borra (soft) un gasto. Devuelve los ids borrados para poder deshacer. */
    remove(id: number): number[] {
      const e = expenses.get(id)
      if (e.installment) throw new AppError('VALIDATION', 'Es una cuota: borrá el plan de cuotas')
      return expenses.softDelete([id])
    },

    restore(ids: number[]): number {
      return expenses.restore(ids)
    },

    /**
     * Crea un plan de cuotas y sus gastos. Con startAtInstallment = N (plan ya empezado) se generan sólo
     * las cuotas N..total; la cuota N cae en el mes de imputación de la compra (o el override).
     */
    createPlan(input: InstallmentPlanInput): InstallmentPlan {
      const method = checkRefs(input.subcategoryId, input.paymentMethodId)
      const group = checkExpenseGroup(repos, input.group)
      const shares = group ? equalShares(repos, group.groupId) : []
      const startAt = input.startAtInstallment
      const monthOfStart =
        input.firstChargeMonthOverride ??
        (startAt === 1
          ? computeChargeMonth(input.purchaseDate, method)
          : // plan ya empezado: la cuota actual es la de este mes
            currentMonthOf(clock))
      const firstChargeMonth = firstChargeMonthFrom(monthOfStart, startAt)
      const schedule = buildInstallmentSchedule({
        totalCents: input.totalCents,
        installmentsCount: input.installmentsCount,
        firstChargeMonth,
        fromInstallment: startAt,
      })

      const planId = db.transaction(() => {
        const id = plans.insert({
          description: input.description,
          subcategoryId: input.subcategoryId,
          paymentMethodId: input.paymentMethodId,
          purchaseDate: input.purchaseDate,
          totalCents: input.totalCents,
          installmentsCount: input.installmentsCount,
          firstChargeMonth,
          group,
        })
        for (const row of schedule) {
          const cuotaId = expenses.insert({
            subcategoryId: input.subcategoryId,
            paymentMethodId: input.paymentMethodId,
            description: input.description,
            purchaseDate: input.purchaseDate,
            chargeMonth: row.month,
            chargeMonthLocked: false,
            amountCents: row.amountCents,
            installmentPlanId: id,
            installmentNumber: row.number,
            recurringTemplateId: null,
            notes: input.notes || null,
            group,
          })
          expenses.setShares(cuotaId, shares)
        }
        return id
      })()
      return getPlan(planId)
    },

    /**
     * Edita un plan.
     * - 'all': recalcula todas las cuotas existentes con el nuevo total y cantidad.
     * - 'future': las cuotas ya pagadas (mes <= actual) quedan como están; el resto del total se reparte
     *   entre las cuotas futuras.
     */
    updatePlan(planId: number, input: InstallmentPlanUpdate, scope: PlanScope): InstallmentPlan {
      const plan = plans.get(planId)
      checkRefs(input.subcategoryId, input.paymentMethodId, {
        subcategoryId: plan.subcategory_id,
        paymentMethodId: plan.payment_method_id,
      })
      const group = checkExpenseGroup(repos, input.group, toExpenseGroup(plan))
      const shares = group ? equalShares(repos, group.groupId) : []
      const existing = expenses.listByPlan(planId)
      if (existing.length === 0) throw new AppError('NOT_FOUND', 'El plan no tiene cuotas')
      const current = currentMonthOf(clock)
      const fromNumber = Math.min(...existing.map((e) => e.installment?.number ?? 1))

      db.transaction(() => {
        plans.update(planId, {
          description: input.description,
          subcategoryId: input.subcategoryId,
          paymentMethodId: input.paymentMethodId,
          purchaseDate: plan.purchase_date,
          totalCents: input.totalCents,
          installmentsCount: input.installmentsCount,
          firstChargeMonth: plan.first_charge_month,
          group,
        })

        const keep =
          scope === 'future'
            ? existing.filter((e) => compareMonths(e.chargeMonth, current) <= 0)
            : []
        const lastKept = Math.max(fromNumber - 1, ...keep.map((e) => e.installment?.number ?? 0))
        if (input.installmentsCount <= lastKept && scope === 'future') {
          throw new AppError(
            'VALIDATION',
            `Ya pasaron ${lastKept} cuotas: la cantidad tiene que ser mayor`,
            { installmentsCount: 'Muy pocas cuotas' },
          )
        }
        if (input.installmentsCount < fromNumber) {
          throw new AppError('VALIDATION', 'La cantidad de cuotas es menor a la cuota inicial', {
            installmentsCount: 'Muy pocas cuotas',
          })
        }

        // Montos de las cuotas a regenerar
        let amounts: Map<number, number>
        if (scope === 'all') {
          const split = splitInstallments(input.totalCents, input.installmentsCount)
          amounts = new Map(split.map((a, i) => [i + 1, a]))
        } else {
          const paidBefore =
            fromNumber > 1
              ? sumCents(
                  splitInstallments(plan.total_cents, plan.installments_count).slice(
                    0,
                    fromNumber - 1,
                  ),
                )
              : 0
          const keptTotal = sumCents(keep.map((e) => e.amountCents))
          const remaining = input.totalCents - paidBefore - keptTotal
          if (remaining < 0) {
            throw new AppError('VALIDATION', 'El total es menor a lo que ya se pagó', {
              totalCents: 'Menor a lo pagado',
            })
          }
          const split = splitInstallments(remaining, input.installmentsCount - lastKept)
          amounts = new Map(split.map((a, i) => [lastKept + 1 + i, a]))
          // Las cuotas ya pagadas sólo actualizan datos descriptivos
          for (const e of keep) {
            expenses.updateInstallment(e.id, {
              subcategoryId: e.subcategoryId,
              paymentMethodId: e.paymentMethodId,
              description: e.description,
              amountCents: e.amountCents ?? 0,
              notes: e.notes,
              group: e.group,
            })
          }
        }

        const replace = existing.filter((e) => !keep.includes(e))
        expenses.deleteHard(replace.map((e) => e.id))
        const startNumber = scope === 'all' ? fromNumber : lastKept + 1
        for (let n = startNumber; n <= input.installmentsCount; n++) {
          const cuotaId = expenses.insert({
            subcategoryId: input.subcategoryId,
            paymentMethodId: input.paymentMethodId,
            description: input.description,
            purchaseDate: plan.purchase_date,
            chargeMonth: addMonths(plan.first_charge_month, n - 1),
            chargeMonthLocked: false,
            amountCents: amounts.get(n) ?? 0,
            installmentPlanId: planId,
            installmentNumber: n,
            recurringTemplateId: null,
            notes: input.notes || null,
            group,
          })
          expenses.setShares(cuotaId, shares)
        }
      })()
      return getPlan(planId)
    },

    /** Borra (soft) las cuotas del plan: todas, o sólo las futuras (mes > actual). */
    removePlan(planId: number, scope: PlanScope): number[] {
      plans.get(planId)
      const current = currentMonthOf(clock)
      const targets = expenses
        .listByPlan(planId)
        .filter((e) => scope === 'all' || compareMonths(e.chargeMonth, current) > 0)
      return expenses.softDelete(targets.map((e) => e.id))
    },

    /** Para mostrar en el diálogo: en qué mes impacta una compra. */
    chargeMonthFor: (purchaseDate: string, paymentMethodId: number): Month =>
      previewChargeMonth(purchaseDate, paymentMethodId),

    monthOfToday: (): Month => monthOf(clock.today()),
  }
}
