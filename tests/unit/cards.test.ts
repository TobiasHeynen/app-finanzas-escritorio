import { describe, expect, it } from 'vitest'
import { createCardsService } from '@core/services/cards'
import { createExpensesService } from '@core/services/expenses'
import { createTestContext, idsByName } from '../helpers/context'

describe('pantalla de tarjetas', () => {
  const setup = (today: string) => {
    const ctx = createTestContext(today)
    const ids = idsByName(ctx)
    return { ctx, ids, expenses: createExpensesService(ctx), cards: createCardsService(ctx) }
  }

  it('separa lo que vence este mes, el resumen abierto y lo comprometido', () => {
    const { ids, expenses, cards } = setup('2026-10-10')
    const visa = ids.method('VISA') // cierra el 25
    const base = {
      subcategoryId: ids.sub('Salidas'),
      paymentMethodId: visa,
      description: '',
      chargeMonthOverride: null,
      notes: null,
    }
    expenses.create({ ...base, purchaseDate: '2026-09-20', amountCents: 10000 }) // vence oct
    expenses.create({ ...base, purchaseDate: '2026-10-05', amountCents: 20000 }) // resumen abierto → nov
    expenses.create({ ...base, purchaseDate: '2026-10-26', amountCents: 40000 }) // → dic
    expenses.createPlan({
      ...base,
      purchaseDate: '2026-10-01',
      totalCents: 30000,
      installmentsCount: 3,
      startAtInstallment: 1,
      firstChargeMonthOverride: null,
    }) // nov, dic, ene

    const overview = cards.overview()
    const card = overview.cards.find((c) => c.paymentMethodId === visa)!
    expect(card.dueThisMonth.totalCents).toBe(10000)
    expect(card.openStatement.chargeMonth).toBe('2026-11')
    expect(card.openStatement.closingDate).toBe('2026-10-25')
    expect(card.openStatement.totalCents).toBe(20000 + 10000)
    expect(card.committedCents).toBe(20000 + 40000 + 30000)
    expect(card.plans).toHaveLength(1)
    expect(card.plans[0]).toMatchObject({
      paidCount: 0,
      installmentsCount: 3,
      remainingCents: 30000,
    })

    const nov = overview.committedByMonth.find((m) => m.month === '2026-11')!
    expect(nov.totalCents).toBe(30000)
    expect(overview.committedTotalCents).toBe(90000)
  })

  it('después del cierre, el resumen abierto es el de dos meses adelante', () => {
    const { ids, cards } = setup('2026-10-28')
    const card = cards.overview().cards.find((c) => c.paymentMethodId === ids.method('VISA'))!
    expect(card.openStatement.chargeMonth).toBe('2026-12')
    expect(card.openStatement.closingDate).toBe('2026-11-25')
  })

  it('progreso de planes ya empezados', () => {
    const { ids, expenses, cards } = setup('2026-10-10')
    expenses.createPlan({
      subcategoryId: ids.sub('Electrodomésticos'),
      paymentMethodId: ids.method('MASTERCARD'),
      description: 'Tele',
      purchaseDate: '2026-04-01',
      totalCents: 120000,
      installmentsCount: 12,
      startAtInstallment: 7,
      firstChargeMonthOverride: null,
      notes: null,
    })
    const card = cards.overview().cards.find((c) => c.paymentMethodId === ids.method('MASTERCARD'))!
    expect(card.plans[0]).toMatchObject({
      paidCount: 7,
      nextAmountCents: 10000,
      remainingCents: 50000,
    })
  })
})
