import { beforeEach, describe, expect, it } from 'vitest'
import { createExpensesService } from '@core/services/expenses'
import { AppError } from '@shared/errors'
import { createTestContext, idsByName, type TestContext } from '../helpers/context'

let ctx: TestContext
let svc: ReturnType<typeof createExpensesService>
let ids: ReturnType<typeof idsByName>

beforeEach(() => {
  ctx = createTestContext('2026-10-15')
  svc = createExpensesService(ctx)
  ids = idsByName(ctx)
})

const base = () => ({
  subcategoryId: ids.sub('Chino'),
  paymentMethodId: ids.method('Efectivo'),
  description: 'Compra',
  purchaseDate: '2026-10-10',
  amountCents: 123456,
  chargeMonthOverride: null,
  notes: null,
})

describe('gastos simples', () => {
  it('crea con efectivo en el mes de compra', () => {
    const e = svc.create(base())
    expect(e.chargeMonth).toBe('2026-10')
    expect(e.chargeMonthLocked).toBe(false)
    expect(e.amountCents).toBe(123456)
    expect(e.categoryId).toBe(ids.category('Supermercado'))
  })

  it('con tarjeta calcula el mes de vencimiento del resumen', () => {
    // VISA cierra el 25
    const e = svc.create({
      ...base(),
      paymentMethodId: ids.method('VISA'),
      purchaseDate: '2026-10-26',
    })
    expect(e.chargeMonth).toBe('2026-12')
  })

  it('respeta el mes corregido a mano y lo mantiene fijado', () => {
    const e = svc.create({
      ...base(),
      paymentMethodId: ids.method('VISA'),
      chargeMonthOverride: '2026-11',
    })
    expect(e.chargeMonth).toBe('2026-11')
    expect(e.chargeMonthLocked).toBe(true)
  })

  it('al editar sin override se recalcula el mes', () => {
    const e = svc.create(base())
    const updated = svc.update(e.id, {
      ...base(),
      paymentMethodId: ids.method('VISA'),
      purchaseDate: '2026-10-01',
    })
    expect(updated.chargeMonth).toBe('2026-11')
  })

  it('permite pendientes (NULL) distinto de 0 y completarlos', () => {
    const pending = svc.create({ ...base(), amountCents: null })
    expect(pending.amountCents).toBeNull()
    const zero = svc.create({ ...base(), amountCents: 0 })
    expect(zero.amountCents).toBe(0)
    expect(svc.setAmount(pending.id, 5000).amountCents).toBe(5000)
  })

  it('borra con soft delete y deshace', () => {
    const e = svc.create(base())
    const deleted = svc.remove(e.id)
    expect(deleted).toEqual([e.id])
    expect(svc.listByMonth('2026-10')).toHaveLength(0)
    expect(svc.restore(deleted)).toBe(1)
    expect(svc.listByMonth('2026-10')).toHaveLength(1)
  })

  it('duplica con fecha de hoy', () => {
    const e = svc.create({ ...base(), purchaseDate: '2026-09-01' })
    const copy = svc.duplicate(e.id)
    expect(copy.id).not.toBe(e.id)
    expect(copy.purchaseDate).toBe('2026-10-15')
    expect(copy.amountCents).toBe(e.amountCents)
  })

  it('no deja cargar en una subcategoría archivada', () => {
    ctx.repos.catalog.setSubcategoryArchived(ids.sub('Chino'), true)
    expect(() => svc.create(base())).toThrow(AppError)
  })

  it('al editar, mantener una subcategoría archivada está permitido', () => {
    const e = svc.create(base())
    ctx.repos.catalog.setSubcategoryArchived(ids.sub('Chino'), true)
    expect(() => svc.update(e.id, { ...base(), description: 'otra' })).not.toThrow()
  })
})

describe('planes de cuotas', () => {
  const planInput = () => ({
    subcategoryId: ids.sub('Electrodomésticos'),
    paymentMethodId: ids.method('VISA'),
    description: 'Heladera',
    purchaseDate: '2026-10-20',
    totalCents: 650040,
    installmentsCount: 12,
    startAtInstallment: 1,
    firstChargeMonthOverride: null,
    notes: null,
  })

  it('crea N cuotas desde el mes de imputación de la compra', () => {
    const plan = svc.createPlan(planInput())
    expect(plan.firstChargeMonth).toBe('2026-11')
    expect(plan.installments).toHaveLength(12)
    expect(plan.installments.map((i) => i.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(plan.installments[0]?.month).toBe('2026-11')
    expect(plan.installments[11]?.month).toBe('2027-10')
    expect(plan.installments.reduce((a, i) => a + i.amountCents, 0)).toBe(650040)
    const nov = svc.listByMonth('2026-11')
    expect(nov[0]?.installment).toEqual({ planId: plan.id, number: 1, count: 12 })
  })

  it('"voy por la cuota 7": genera 7..12 desde el mes actual', () => {
    const plan = svc.createPlan({
      ...planInput(),
      purchaseDate: '2026-04-10',
      startAtInstallment: 7,
    })
    expect(plan.installments.map((i) => i.number)).toEqual([7, 8, 9, 10, 11, 12])
    expect(plan.installments[0]?.month).toBe('2026-10')
    expect(plan.firstChargeMonth).toBe('2026-04')
  })

  it('no se puede editar ni borrar una cuota suelta', () => {
    const plan = svc.createPlan(planInput())
    const id = plan.installments[0]!.expenseId
    expect(() => svc.remove(id)).toThrow(AppError)
    expect(() => svc.update(id, { ...base() })).toThrow(AppError)
  })

  it('editar todas las cuotas recalcula los montos', () => {
    const plan = svc.createPlan({ ...planInput(), totalCents: 120000, installmentsCount: 3 })
    const updated = svc.updatePlan(
      plan.id,
      {
        subcategoryId: plan.subcategoryId,
        paymentMethodId: plan.paymentMethodId,
        description: 'Heladera nueva',
        totalCents: 100000,
        installmentsCount: 4,
        notes: null,
      },
      'all',
    )
    expect(updated.installments.map((i) => i.amountCents)).toEqual([25000, 25000, 25000, 25000])
    expect(updated.installments.map((i) => i.month)).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
    expect(updated.description).toBe('Heladera nueva')
  })

  it('editar sólo las futuras mantiene las ya pasadas y reparte el resto', () => {
    const plan = svc.createPlan({ ...planInput(), totalCents: 120000, installmentsCount: 6 })
    // Pasa el tiempo: estamos en enero 2027, ya pasaron nov, dic y ene
    ctx.clock.set('2027-01-20')
    const updated = svc.updatePlan(
      plan.id,
      {
        subcategoryId: plan.subcategoryId,
        paymentMethodId: plan.paymentMethodId,
        description: 'Heladera',
        totalCents: 150000,
        installmentsCount: 6,
        notes: null,
      },
      'future',
    )
    const amounts = updated.installments.map((i) => i.amountCents)
    expect(amounts.slice(0, 3)).toEqual([20000, 20000, 20000])
    expect(amounts.slice(3)).toEqual([30000, 30000, 30000])
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(150000)
  })

  it('borrar sólo las futuras deja las pasadas (cancelación anticipada)', () => {
    const plan = svc.createPlan(planInput())
    ctx.clock.set('2027-01-05')
    const deleted = svc.removePlan(plan.id, 'future')
    expect(deleted).toHaveLength(9)
    const left = svc.getPlan(plan.id).installments
    expect(left.map((i) => i.month)).toEqual(['2026-11', '2026-12', '2027-01'])
    svc.restore(deleted)
    expect(svc.getPlan(plan.id).installments).toHaveLength(12)
  })

  it('borrar todas las cuotas', () => {
    const plan = svc.createPlan(planInput())
    expect(svc.removePlan(plan.id, 'all')).toHaveLength(12)
    expect(svc.getPlan(plan.id).installments).toHaveLength(0)
  })

  it('duplicar una cuota duplica el plan', () => {
    const plan = svc.createPlan(planInput())
    const copy = svc.duplicate(plan.installments[0]!.expenseId)
    expect(copy.installment?.number).toBe(1)
    expect(copy.installment?.planId).not.toBe(plan.id)
  })
})
