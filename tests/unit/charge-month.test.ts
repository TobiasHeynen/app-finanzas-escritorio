import { describe, expect, it } from 'vitest'
import { computeChargeMonth } from '@shared/domain/charge-month'

const card = (closingDay: number) => ({ type: 'tarjeta_credito' as const, closingDay })

describe('computeChargeMonth', () => {
  it('efectivo, débito y transferencia impactan en el mes de compra', () => {
    for (const type of ['efectivo', 'debito', 'transferencia'] as const) {
      expect(computeChargeMonth('2026-03-31', { type, closingDay: null })).toBe('2026-03')
    }
  })

  it('tarjeta: compra antes o el día del cierre va al resumen de ese mes (vence el mes siguiente)', () => {
    expect(computeChargeMonth('2026-03-10', card(25))).toBe('2026-04')
    expect(computeChargeMonth('2026-03-25', card(25))).toBe('2026-04')
  })

  it('tarjeta: compra después del cierre va al resumen siguiente', () => {
    expect(computeChargeMonth('2026-03-26', card(25))).toBe('2026-05')
    expect(computeChargeMonth('2026-03-31', card(25))).toBe('2026-05')
  })

  it('cambio de año', () => {
    expect(computeChargeMonth('2026-12-10', card(25))).toBe('2027-01')
    expect(computeChargeMonth('2026-12-26', card(25))).toBe('2027-02')
    expect(computeChargeMonth('2026-11-28', card(25))).toBe('2027-01')
  })

  it('cierre a fin de mes: el día se ajusta al largo del mes', () => {
    // cierre 31: en febrero cierra el 28 (o 29 en bisiesto)
    expect(computeChargeMonth('2026-02-28', card(31))).toBe('2026-03')
    expect(computeChargeMonth('2028-02-29', card(31))).toBe('2028-03')
    // cierre 30 en un mes de 31: el 31 ya cae en el resumen siguiente
    expect(computeChargeMonth('2026-01-30', card(30))).toBe('2026-02')
    expect(computeChargeMonth('2026-01-31', card(30))).toBe('2026-03')
    // cierre 31 en diciembre: todo diciembre va a enero
    expect(computeChargeMonth('2026-12-31', card(31))).toBe('2027-01')
    // cierre 29 en febrero no bisiesto: el 28 cierra
    expect(computeChargeMonth('2026-02-28', card(29))).toBe('2026-03')
  })

  it('cierre el día 1', () => {
    expect(computeChargeMonth('2026-05-01', card(1))).toBe('2026-06')
    expect(computeChargeMonth('2026-05-02', card(1))).toBe('2026-07')
  })

  it('falla si la tarjeta no tiene cierre', () => {
    expect(() =>
      computeChargeMonth('2026-05-01', { type: 'tarjeta_credito', closingDay: null }),
    ).toThrow()
  })
})
