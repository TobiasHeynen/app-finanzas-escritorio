/**
 * Dinero en enteros. Todos los montos son INTEGER en la unidad mínima de su moneda
 * (centavos de ARS o centavos de USD). Este módulo es el ÚNICO lugar donde se parsean
 * montos escritos por el usuario y donde se convierten a texto.
 */

export type Currency = 'ARS' | 'USD'

/** Monto en unidad mínima (centavos). Siempre entero. */
export type Cents = number

export const MAX_CENTS = 999_999_999_999_99 // 999 mil millones con centavos: sobra y es < 2^53

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= MAX_CENTS
}

export function assertCents(value: number, label = 'monto'): Cents {
  if (!isCents(value))
    throw new RangeError(`${label} inválido: ${String(value)} (tiene que ser un entero)`)
  return value
}

export interface ParseMoneyOptions {
  /** Permite un signo menos adelante. Por defecto false. */
  allowNegative?: boolean
}

/**
 * Parsea un monto escrito en formato argentino y devuelve centavos, o null si no es válido.
 *
 * Acepta: "1234", "1234,5", "1.234,56", "$ 1.234,56", " 12 ", "0,99", ",5".
 * El punto es separador de miles (grupos de 3 dígitos) y la coma es el separador decimal.
 * También acepta punto decimal cuando no puede ser de miles ("1234.5", "12.50"), por el teclado numérico.
 * Rechaza más de 2 decimales, grupos de miles mal formados ("1.2345"), letras y vacío.
 */
export function parseMoney(input: string, options: ParseMoneyOptions = {}): Cents | null {
  let text = input.trim().replace(/\s+/g, '')
  let negative = false
  if (text.startsWith('-')) {
    if (!options.allowNegative) return null
    negative = true
    text = text.slice(1)
  }
  text = text.replace(/^\$/, '')
  if (text.startsWith('-')) {
    if (!options.allowNegative || negative) return null
    negative = true
    text = text.slice(1)
  }
  if (text === '') return null

  // Punto decimal sólo si no puede ser de miles: "1234.5" o "12.50" (1 o 2 dígitos al final, sin coma).
  const dotDecimal = /^(\d+)\.(\d{1,2})$/.exec(text)
  const match = dotDecimal ?? /^(\d{1,3}(?:\.\d{3})+|\d*)(?:,(\d{0,2}))?$/.exec(text)
  if (!match) return null
  const intPart = (match[1] ?? '').replace(/\./g, '')
  const fracPart = match[2] ?? ''
  if (intPart === '' && fracPart === '') return null

  const cents = Number(intPart || '0') * 100 + Number(fracPart.padEnd(2, '0'))
  if (!isCents(cents)) return null
  return negative && cents !== 0 ? -cents : cents
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: Currency, decimals: boolean, signDisplay: 'auto' | 'exceptZero') {
  const key = `${currency}|${decimals}|${signDisplay}`
  let f = formatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'USD' ? 'code' : 'symbol',
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
      signDisplay,
    })
    formatters.set(key, f)
  }
  return f
}

/** Representación decimal exacta como string ("-1234.05"), sin pasar por float. */
export function centsToDecimalString(cents: Cents): string {
  assertCents(cents)
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const int = Math.trunc(abs / 100)
  const frac = abs % 100
  return `${sign}${int}.${String(frac).padStart(2, '0')}`
}

export interface FormatMoneyOptions {
  /** 'auto': siempre 2 decimales salvo que sean ,00. 'always' | 'never'. Por defecto 'auto'. */
  decimals?: 'auto' | 'always' | 'never'
  /** Muestra "+" en positivos. */
  showPlus?: boolean
}

/**
 * Formatea centavos para mostrar: "$ 1.234,56", "USD 10,00".
 * Usa Intl.NumberFormat('es-AR') con el valor como string decimal, así no hay error de float.
 * Con decimals 'never' se redondea al entero más cercano (sólo para mostrar).
 */
export function formatMoney(
  cents: Cents,
  currency: Currency = 'ARS',
  options: FormatMoneyOptions = {},
): string {
  const mode = options.decimals ?? 'auto'
  const withDecimals = mode === 'always' || (mode === 'auto' && cents % 100 !== 0)
  const signDisplay = options.showPlus ? 'exceptZero' : 'auto'
  const value = withDecimals ? centsToDecimalString(cents) : String(roundToUnits(cents))
  // Intl acepta strings decimales y los formatea sin convertirlos a float.
  return formatter(currency, withDecimals, signDisplay).format(value as unknown as number)
}

/** Formato para precargar un input editable: "1.234,56" (sin símbolo). Pendiente → "". */
export function formatMoneyInput(cents: Cents | null): string {
  if (cents === null) return ''
  const negative = cents < 0
  const abs = Math.abs(cents)
  const int = Math.trunc(abs / 100)
  const frac = abs % 100
  const intText = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const text = frac === 0 ? intText : `${intText},${String(frac).padStart(2, '0')}`
  return negative ? `-${text}` : text
}

/** Redondea centavos a unidades enteras (mitad hacia afuera del cero). */
export function roundToUnits(cents: Cents): number {
  const sign = cents < 0 ? -1 : 1
  const abs = Math.abs(cents)
  return sign * (Math.trunc(abs / 100) + (abs % 100 >= 50 ? 1 : 0))
}

/** Suma de montos; los null (pendientes) se ignoran. */
export function sumCents(values: Iterable<Cents | null | undefined>): Cents {
  let total = 0
  for (const v of values) if (v !== null && v !== undefined) total += v
  return assertCents(total, 'suma')
}

/**
 * Reparte un total en N cuotas enteras. Si no divide exacto, el resto de centavos va en la
 * PRIMERA cuota. La suma de las cuotas es siempre igual al total.
 *   splitInstallments(100000, 3) → [33334, 33333, 33333]
 */
export function splitInstallments(totalCents: Cents, count: number): Cents[] {
  assertCents(totalCents, 'total')
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`Cantidad de cuotas inválida: ${count}`)
  }
  if (totalCents < 0) throw new RangeError('El total de las cuotas no puede ser negativo')
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + remainder : base))
}

/** a * b / c redondeado (mitad hacia afuera del cero), con aritmética entera exacta. */
export function mulDivRound(a: number, b: number, c: number): number {
  if (![a, b, c].every(Number.isSafeInteger)) throw new RangeError('mulDivRound espera enteros')
  if (c === 0) throw new RangeError('División por cero')
  const num = BigInt(a) * BigInt(b)
  const den = BigInt(c)
  const negative = num < 0n !== den < 0n
  const absNum = num < 0n ? -num : num
  const absDen = den < 0n ? -den : den
  let q = absNum / absDen
  if ((absNum % absDen) * 2n >= absDen) q += 1n
  return Number(negative ? -q : q)
}

/** Convierte USD (centavos de dólar) a ARS (centavos) con una cotización en centavos de ARS por 1 USD. */
export function usdToArs(usdCents: Cents, rateCentsPerUsd: Cents): Cents {
  return assertCents(mulDivRound(usdCents, rateCentsPerUsd, 100), 'conversión')
}

/** Cotización implícita (centavos de ARS por 1 USD) a partir de lo pagado. */
export function impliedRate(arsCents: Cents, usdCents: Cents): Cents {
  if (usdCents === 0) throw new RangeError('No se puede calcular la cotización de 0 USD')
  return assertCents(mulDivRound(arsCents, 100, usdCents), 'cotización')
}

/** Divide un monto en N partes "parejas" redondeando hacia arriba (p. ej. cuánto ahorrar por mes). */
export function ceilDiv(cents: Cents, parts: number): Cents {
  if (!Number.isInteger(parts) || parts < 1) throw new RangeError(`Partes inválidas: ${parts}`)
  assertCents(cents)
  return cents >= 0 ? Math.floor((cents + parts - 1) / parts) : -Math.floor(-cents / parts)
}
