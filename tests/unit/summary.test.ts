import { describe, expect, it } from 'vitest'
import { computeMonthSummary, savingsArsOutflow } from '@main/services/summary-calc'
import { createRecurringService } from '@main/services/recurring'
import { createSummaryService } from '@main/services/summary'
import { createTestContext, idsByName } from '../helpers/context'

describe('computeMonthSummary (disponible del mes)', () => {
  it('ingresos − gastos − aportes ARS (incluye compras de USD) + retiros', () => {
    const r = computeMonthSummary({
      incomes: [{ amountCents: 200000000 }, { amountCents: 5000000 }],
      expenses: [
        { amountCents: 70000000, categoryId: 1 },
        { amountCents: 10000000, categoryId: 2 },
        { amountCents: 5000000, categoryId: 1 },
        { amountCents: null, categoryId: 3 },
      ],
      savings: [
        { currency: 'ARS', amountMinor: 20000000, arsCostCents: null }, // aporte ARS
        { currency: 'ARS', amountMinor: -5000000, arsCostCents: null }, // retiro ARS
        { currency: 'USD', amountMinor: 10000, arsCostCents: 12000000 }, // compra 100 USD
        { currency: 'USD', amountMinor: -5000, arsCostCents: 6500000 }, // venta 50 USD
        { currency: 'USD', amountMinor: 3000, arsCostCents: null }, // freelance en USD: no toca pesos
      ],
    })
    expect(r.incomeCents).toBe(205000000)
    expect(r.spentCents).toBe(85000000)
    expect(r.savedCents).toBe(20000000 - 5000000 + 12000000 - 6500000)
    expect(r.availableCents).toBe(205000000 - 85000000 - 20500000)
    expect(r.pendingCount).toBe(1)
    expect(r.byCategory).toEqual([
      { categoryId: 1, amountCents: 75000000 },
      { categoryId: 2, amountCents: 10000000 },
    ])
  })

  it('puede dar negativo', () => {
    const r = computeMonthSummary({
      incomes: [{ amountCents: 100 }],
      expenses: [{ amountCents: 300, categoryId: 1 }],
      savings: [],
    })
    expect(r.availableCents).toBe(-200)
  })

  it('un pendiente no resta pero un $0 tampoco cuenta como pendiente', () => {
    const r = computeMonthSummary({
      incomes: [],
      expenses: [
        { amountCents: 0, categoryId: 1 },
        { amountCents: null, categoryId: 1 },
      ],
      savings: [],
    })
    expect(r.spentCents).toBe(0)
    expect(r.pendingCount).toBe(1)
  })

  it('savingsArsOutflow', () => {
    expect(savingsArsOutflow({ currency: 'ARS', amountMinor: 100, arsCostCents: null })).toBe(100)
    expect(savingsArsOutflow({ currency: 'ARS', amountMinor: -100, arsCostCents: null })).toBe(-100)
    expect(savingsArsOutflow({ currency: 'USD', amountMinor: 1, arsCostCents: 150000 })).toBe(
      150000,
    )
    expect(savingsArsOutflow({ currency: 'USD', amountMinor: -1, arsCostCents: 150000 })).toBe(
      -150000,
    )
  })
})

describe('overview del mes con la base', () => {
  it('integra gastos, ingresos, ahorros y proyecciones', () => {
    const ctx = createTestContext('2026-10-15')
    const ids = idsByName(ctx)
    const recurring = createRecurringService(ctx)
    const summary = createSummaryService(ctx, recurring)
    recurring.create({
      description: 'Alquiler',
      subcategoryId: ids.sub('Alquiler'),
      paymentMethodId: ids.method('Transferencia'),
      defaultAmountCents: 70000000,
      dayOfMonth: 1,
      startMonth: '2026-10',
      endMonth: null,
      active: true,
    })
    ctx.repos.incomes.insert({
      month: '2026-10',
      type: 'sueldo',
      description: '',
      amountCents: 150000000,
      date: '2026-10-01',
    })
    ctx.repos.savings.insertMovement({
      date: '2026-10-05',
      month: '2026-10',
      currency: 'USD',
      amountMinor: 10000,
      arsCostCents: 13000000,
      rateCentsPerUsd: 130000,
      goalId: null,
      note: '',
    })
    const oct = summary.overview('2026-10')
    expect(oct.summary.availableCents).toBe(150000000 - 70000000 - 13000000)
    expect(oct.projected).toEqual([])

    const dec = summary.overview('2026-12')
    expect(dec.expenses).toEqual([])
    expect(dec.projected).toHaveLength(1)
    expect(dec.summary.spentCents).toBe(70000000)
    expect(dec.summary.projectedCount).toBe(1)
  })
})
