import { describe, expect, it } from 'vitest'
import {
  ceilDiv,
  centsToDecimalString,
  formatMoney,
  formatMoneyInput,
  impliedRate,
  isCents,
  mulDivRound,
  parseMoney,
  roundToUnits,
  splitInstallments,
  sumCents,
  usdToArs,
} from '@shared/money'

// Intl usa espacio duro entre símbolo y número
const nbsp = (s: string) => s.replace(/ /g, ' ')

describe('parseMoney', () => {
  it.each([
    ['0', 0],
    ['1', 100],
    ['1234', 123400],
    ['1.234', 123400],
    ['1.234,56', 123456],
    ['1.234,5', 123450],
    ['1234,56', 123456],
    ['12.345.678,90', 1234567890],
    ['0,99', 99],
    [',5', 50],
    ['5,', 500],
    ['$ 1.234,56', 123456],
    ['$1.234,56', 123456],
    ['  700.000  ', 70000000],
    ['1 234,56', 123456],
    ['1234.5', 123450],
    ['12.50', 1250],
    ['0.01', 1],
    ['100000000', 10000000000],
  ])('"%s" → %i', (input, expected) => {
    expect(parseMoney(input)).toBe(expected)
  })

  it.each([
    '',
    '   ',
    'abc',
    '12a',
    '1,234',
    '1.2345',
    '1.23.456',
    '1,2,3',
    ',',
    '.',
    '$',
    '1.234,567',
    '1e5',
    'NaN',
    'Infinity',
    '--5',
    '+5',
    '12..3',
  ])('rechaza "%s"', (input) => {
    expect(parseMoney(input)).toBeNull()
  })

  it('rechaza negativos salvo que se permitan', () => {
    expect(parseMoney('-100')).toBeNull()
    expect(parseMoney('-100', { allowNegative: true })).toBe(-10000)
    expect(parseMoney('-$ 1.000,50', { allowNegative: true })).toBe(-100050)
    expect(parseMoney('$ -1.000,50', { allowNegative: true })).toBe(-100050)
    expect(parseMoney('-0', { allowNegative: true })).toBe(0)
    expect(Object.is(parseMoney('-0', { allowNegative: true }), -0)).toBe(false)
  })

  it('rechaza montos fuera de rango', () => {
    expect(parseMoney('99999999999999999')).toBeNull()
  })

  it('no pierde centavos en valores que en float darían error', () => {
    // 0.1 + 0.2 y similares: el parseo es por string, nunca por float
    expect(parseMoney('0,29')).toBe(29)
    expect(parseMoney('1,15')).toBe(115)
    expect(parseMoney('4,35')).toBe(435)
    expect(parseMoney('1.005,57')).toBe(100557)
    for (let i = 0; i < 1000; i++) {
      const pesos = Math.floor(i * 7919) % 100000
      const cents = (i * 37) % 100
      const text = `${pesos},${String(cents).padStart(2, '0')}`
      expect(parseMoney(text)).toBe(pesos * 100 + cents)
    }
  })
})

describe('formatMoney', () => {
  it('formatea ARS en es-AR', () => {
    expect(formatMoney(123456)).toBe(nbsp('$ 1.234,56'))
    expect(formatMoney(70000000)).toBe(nbsp('$ 700.000'))
    expect(formatMoney(5)).toBe(nbsp('$ 0,05'))
    expect(formatMoney(0)).toBe(nbsp('$ 0'))
    expect(formatMoney(-123456)).toBe(nbsp('-$ 1.234,56'))
  })

  it('respeta la opción de decimales', () => {
    expect(formatMoney(100, 'ARS', { decimals: 'always' })).toBe(nbsp('$ 1,00'))
    expect(formatMoney(123456, 'ARS', { decimals: 'never' })).toBe(nbsp('$ 1.235'))
    expect(formatMoney(123449, 'ARS', { decimals: 'never' })).toBe(nbsp('$ 1.234'))
  })

  it('formatea USD con código', () => {
    expect(formatMoney(1050, 'USD')).toBe(nbsp('USD 10,50'))
  })

  it('muestra el + si se pide', () => {
    expect(formatMoney(100, 'ARS', { showPlus: true })).toBe(nbsp('+$ 1'))
    expect(formatMoney(0, 'ARS', { showPlus: true })).toBe(nbsp('$ 0'))
  })

  it('formatea montos grandes sin perder precisión', () => {
    expect(formatMoney(99999999999999)).toBe(nbsp('$ 999.999.999.999,99'))
  })

  it('rechaza montos no enteros', () => {
    expect(() => formatMoney(1.5)).toThrow(RangeError)
  })

  it('da lo mismo que Intl es-AR (en el celu no se usa Intl)', () => {
    const values = [0, 1, 49, 50, 99, 100, 150, -30, -50, -150, 123456, -123456, 100000000]
    for (let i = 0; i < 300; i++)
      values.push(Math.round((Math.random() - 0.3) * 10 ** (2 + (i % 11))))
    for (const currency of ['ARS', 'USD'] as const) {
      for (const decimals of ['auto', 'always', 'never'] as const) {
        for (const showPlus of [false, true]) {
          for (const cents of values) {
            const withDecimals = decimals === 'always' || (decimals === 'auto' && cents % 100 !== 0)
            const expected = new Intl.NumberFormat('es-AR', {
              style: 'currency',
              currency,
              currencyDisplay: currency === 'USD' ? 'code' : 'symbol',
              minimumFractionDigits: withDecimals ? 2 : 0,
              maximumFractionDigits: withDecimals ? 2 : 0,
              roundingMode: 'halfExpand',
              signDisplay: showPlus ? 'exceptZero' : 'auto',
            }).format(
              (withDecimals
                ? centsToDecimalString(cents)
                : String(cents / 100)) as unknown as number,
            )
            expect(formatMoney(cents, currency, { decimals, showPlus }), `${cents}`).toBe(
              // Intl muestra "-$ 0" cuando un negativo redondea a 0; acá queda "$ 0" (como antes).
              expected.replace(/^-(\$|USD)\u00a00$/, '$1\u00a00'),
            )
          }
        }
      }
    }
  })
})

describe('formatMoneyInput y centsToDecimalString', () => {
  it('genera texto editable que vuelve a parsear igual', () => {
    for (const cents of [0, 1, 99, 100, 123456, 70000000, 1234567890]) {
      expect(parseMoney(formatMoneyInput(cents))).toBe(cents)
    }
    expect(formatMoneyInput(123456)).toBe('1.234,56')
    expect(formatMoneyInput(70000000)).toBe('700.000')
    expect(formatMoneyInput(null)).toBe('')
    expect(formatMoneyInput(-150)).toBe('-1,50')
  })

  it('convierte a decimal exacto', () => {
    expect(centsToDecimalString(123456)).toBe('1234.56')
    expect(centsToDecimalString(5)).toBe('0.05')
    expect(centsToDecimalString(-5)).toBe('-0.05')
  })
})

describe('splitInstallments', () => {
  it('reparte exacto cuando divide', () => {
    expect(splitInstallments(120000, 12)).toEqual(Array(12).fill(10000))
  })

  it('pone el resto en la primera cuota', () => {
    expect(splitInstallments(100000, 3)).toEqual([33334, 33333, 33333])
    expect(splitInstallments(100, 7)).toEqual([16, 14, 14, 14, 14, 14, 14])
    expect(splitInstallments(1, 3)).toEqual([1, 0, 0])
  })

  it('una cuota es el total', () => {
    expect(splitInstallments(54170, 1)).toEqual([54170])
  })

  it('la suma siempre da el total', () => {
    for (let total = 0; total < 5000; total += 37) {
      for (const n of [1, 2, 3, 6, 7, 9, 12, 18, 24]) {
        const parts = splitInstallments(total, n)
        expect(parts).toHaveLength(n)
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total)
        expect(parts.every(Number.isInteger)).toBe(true)
        expect(parts[0]! - parts[n - 1]!).toBeLessThan(n)
      }
    }
  })

  it('rechaza cantidades inválidas', () => {
    expect(() => splitInstallments(100, 0)).toThrow(RangeError)
    expect(() => splitInstallments(100, 1.5)).toThrow(RangeError)
    expect(() => splitInstallments(10.5, 2)).toThrow(RangeError)
    expect(() => splitInstallments(-100, 2)).toThrow(RangeError)
  })
})

describe('aritmética', () => {
  it('sumCents ignora pendientes', () => {
    expect(sumCents([100, null, 250, undefined])).toBe(350)
    expect(sumCents([])).toBe(0)
  })

  it('mulDivRound redondea mitad hacia afuera', () => {
    expect(mulDivRound(1, 1, 2)).toBe(1)
    expect(mulDivRound(1, 1, 3)).toBe(0)
    expect(mulDivRound(-1, 1, 2)).toBe(-1)
    expect(mulDivRound(2, 5, 4)).toBe(3)
  })

  it('convierte USD a ARS con cotización entera', () => {
    // 100 USD a $ 1.250,50 = $ 125.050
    expect(usdToArs(10000, 125050)).toBe(12505000)
    // 0,01 USD a $ 1.250,50 = $ 12,5050 → $ 12,51
    expect(usdToArs(1, 125050)).toBe(1251)
  })

  it('calcula la cotización implícita', () => {
    // pagué $ 125.050 por 100 USD → $ 1.250,50
    expect(impliedRate(12505000, 10000)).toBe(125050)
    expect(() => impliedRate(100, 0)).toThrow(RangeError)
  })

  it('ceilDiv redondea hacia arriba', () => {
    expect(ceilDiv(1000, 3)).toBe(334)
    expect(ceilDiv(900, 3)).toBe(300)
    expect(ceilDiv(0, 3)).toBe(0)
  })

  it('roundToUnits e isCents', () => {
    expect(roundToUnits(150)).toBe(2)
    expect(roundToUnits(149)).toBe(1)
    expect(roundToUnits(-150)).toBe(-2)
    expect(isCents(1)).toBe(true)
    expect(isCents(1.1)).toBe(false)
    expect(isCents(Number.NaN)).toBe(false)
    expect(isCents('1')).toBe(false)
  })
})
