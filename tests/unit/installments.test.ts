import { describe, expect, it } from 'vitest'
import { buildInstallmentSchedule, firstChargeMonthFrom } from '@main/services/installments'

describe('buildInstallmentSchedule', () => {
  it('genera N cuotas en meses consecutivos con el resto en la primera', () => {
    const rows = buildInstallmentSchedule({
      totalCents: 100000,
      installmentsCount: 3,
      firstChargeMonth: '2026-11',
    })
    expect(rows).toEqual([
      { number: 1, month: '2026-11', amountCents: 33334 },
      { number: 2, month: '2026-12', amountCents: 33333 },
      { number: 3, month: '2027-01', amountCents: 33333 },
    ])
  })

  it('12 cuotas cruzan el año y suman el total', () => {
    const rows = buildInstallmentSchedule({
      totalCents: 650040,
      installmentsCount: 12,
      firstChargeMonth: '2026-11',
    })
    expect(rows).toHaveLength(12)
    expect(rows.at(-1)?.month).toBe('2027-10')
    expect(rows.reduce((a, r) => a + r.amountCents, 0)).toBe(650040)
  })

  it('plan ya empezado: devuelve sólo las cuotas N..total', () => {
    const rows = buildInstallmentSchedule({
      totalCents: 120000,
      installmentsCount: 12,
      firstChargeMonth: firstChargeMonthFrom('2026-10', 7),
      fromInstallment: 7,
    })
    expect(rows.map((r) => r.number)).toEqual([7, 8, 9, 10, 11, 12])
    expect(rows[0]).toEqual({ number: 7, month: '2026-10', amountCents: 10000 })
    expect(rows.at(-1)?.month).toBe('2027-03')
  })

  it('firstChargeMonthFrom calcula hacia atrás', () => {
    expect(firstChargeMonthFrom('2026-10', 7)).toBe('2026-04')
    expect(firstChargeMonthFrom('2026-02', 3)).toBe('2025-12')
    expect(firstChargeMonthFrom('2026-02', 1)).toBe('2026-02')
  })

  it('rechaza cuota inicial fuera de rango', () => {
    const base = { totalCents: 1000, installmentsCount: 3, firstChargeMonth: '2026-01' }
    expect(() => buildInstallmentSchedule({ ...base, fromInstallment: 0 })).toThrow()
    expect(() => buildInstallmentSchedule({ ...base, fromInstallment: 4 })).toThrow()
  })
})
