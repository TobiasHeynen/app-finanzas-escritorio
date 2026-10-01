import { describe, expect, it } from 'vitest'
import { goalProgress, createSavingsService } from '@main/services/savings'
import { createSummaryService } from '@main/services/summary'
import { createRecurringService } from '@main/services/recurring'
import { AppError } from '@shared/errors'
import type { SavingsGoal, SavingsMovementInput } from '@shared/types'
import { createTestContext } from '../helpers/context'

const base: SavingsMovementInput = {
  date: '2026-10-10',
  month: '2026-10',
  currency: 'ARS',
  kind: 'aporte',
  amountMinor: 100000,
  arsCents: null,
  goalId: null,
  note: '',
}

function setup(today = '2026-10-15') {
  const ctx = createTestContext(today)
  return {
    ctx,
    savings: createSavingsService(ctx),
    summary: createSummaryService(ctx, createRecurringService(ctx)),
  }
}

describe('ahorros', () => {
  it('compra de USD: guarda los ARS pagados y la cotización implícita', () => {
    const { savings } = setup()
    const m = savings.createMovement({
      ...base,
      currency: 'USD',
      amountMinor: 10000, // USD 100
      arsCents: 12500000, // $125.000
    })
    expect(m.amountMinor).toBe(10000)
    expect(m.arsCostCents).toBe(12500000)
    expect(m.rateCentsPerUsd).toBe(125000) // $1.250 por dólar
    const o = savings.overview()
    expect(o.balances).toEqual({ ARS: 0, USD: 10000 })
    expect(o.lastRate?.rateCentsPerUsd).toBe(125000)
    expect(o.usdInArsCents).toBe(12500000)
  })

  it('USD sin pesos (freelance): no tiene cotización ni afecta el disponible', () => {
    const { savings, summary } = setup()
    const m = savings.createMovement({ ...base, currency: 'USD', amountMinor: 50000 })
    expect(m.rateCentsPerUsd).toBeNull()
    expect(summary.overview('2026-10').summary.savedCents).toBe(0)
  })

  it('el disponible resta aportes y compras de USD y suma ventas de USD', () => {
    const { ctx, savings, summary } = setup()
    ctx.repos.incomes.insert({
      month: '2026-10',
      type: 'sueldo',
      description: '',
      amountCents: 1000000,
      date: '2026-10-01',
    })
    savings.createMovement({ ...base, amountMinor: 100000 }) // aporte ARS
    savings.createMovement({ ...base, currency: 'USD', amountMinor: 20000, arsCents: 250000 })
    savings.createMovement({
      ...base,
      currency: 'USD',
      kind: 'retiro',
      amountMinor: 5000,
      arsCents: 70000,
    })
    const s = summary.overview('2026-10').summary
    expect(s.savedCents).toBe(100000 + 250000 - 70000)
    expect(s.availableCents).toBe(1000000 - 280000)
  })

  it('no deja retirar más de lo ahorrado ni borrar un aporte ya retirado', () => {
    const { savings } = setup()
    const deposit = savings.createMovement({ ...base, amountMinor: 100000 })
    expect(() => savings.createMovement({ ...base, kind: 'retiro', amountMinor: 100001 })).toThrow(
      AppError,
    )
    const withdrawal = savings.createMovement({ ...base, kind: 'retiro', amountMinor: 60000 })
    expect(() => savings.removeMovement(deposit.id)).toThrow(/No alcanza/)
    // La transacción se revirtió: el aporte sigue.
    expect(savings.overview().balances.ARS).toBe(40000)

    savings.removeMovement(withdrawal.id)
    savings.removeMovement(deposit.id)
    expect(savings.overview().balances.ARS).toBe(0)
    // Restaurar el retiro sin el aporte dejaría el saldo negativo.
    expect(() => savings.restoreMovement(withdrawal.id)).toThrow(/No alcanza/)
    savings.restoreMovement(deposit.id)
    savings.restoreMovement(withdrawal.id)
    expect(savings.overview().balances.ARS).toBe(40000)
  })

  it('editar un retiro tiene en cuenta su monto anterior', () => {
    const { savings } = setup()
    savings.createMovement({ ...base, amountMinor: 100000 })
    const w = savings.createMovement({ ...base, kind: 'retiro', amountMinor: 90000 })
    expect(
      savings.updateMovement(w.id, { ...base, kind: 'retiro', amountMinor: 100000 }).amountMinor,
    ).toBe(-100000)
  })

  it('la meta tiene que ser de la misma moneda', () => {
    const { ctx, savings } = setup()
    const goal = ctx.repos.savings.insertGoal({
      name: 'Viaje',
      currency: 'USD',
      targetMinor: 200000,
      targetDate: null,
    })
    expect(() => savings.createMovement({ ...base, goalId: goal.id })).toThrow(/es en USD/)
    savings.createMovement({ ...base, currency: 'USD', amountMinor: 30000, goalId: goal.id })
    expect(savings.overview().goals[0]?.savedMinor).toBe(30000)
  })
})

describe('progreso de metas', () => {
  const goal = (over: Partial<SavingsGoal>): SavingsGoal => ({
    id: 1,
    name: 'Meta',
    currency: 'ARS',
    targetMinor: 100000,
    targetDate: '2026-12-31',
    archived: false,
    savedMinor: 0,
    ...over,
  })

  it('reparte lo que falta en los meses que quedan, contando el actual y redondeando para arriba', () => {
    const p = goalProgress(goal({ savedMinor: 0 }), '2026-10')
    expect(p.monthsLeft).toBe(3)
    expect(p.perMonthMinor).toBe(33334)
    expect(p.overdue).toBe(false)
  })

  it('cruza el año', () => {
    const p = goalProgress(goal({ targetDate: '2027-03-01', savedMinor: 40000 }), '2026-11')
    expect(p.monthsLeft).toBe(5)
    expect(p.remainingMinor).toBe(60000)
    expect(p.perMonthMinor).toBe(12000)
  })

  it('meta cumplida, vencida y sin fecha', () => {
    expect(goalProgress(goal({ savedMinor: 120000 }), '2026-10')).toMatchObject({
      remainingMinor: 0,
      perMonthMinor: null,
      overdue: false,
    })
    expect(goalProgress(goal({ targetDate: '2026-09-30' }), '2026-10')).toMatchObject({
      monthsLeft: 0,
      perMonthMinor: null,
      overdue: true,
    })
    expect(goalProgress(goal({ targetDate: null }), '2026-10')).toMatchObject({
      monthsLeft: null,
      perMonthMinor: null,
    })
  })
})
