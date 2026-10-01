/**
 * Helpers de meses ('YYYY-MM') y fechas ('YYYY-MM-DD') como strings.
 * Nunca usamos new Date('YYYY-MM-DD') para lógica de negocio (se interpreta en UTC y corre un día).
 */
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

/** Mes 'YYYY-MM'. */
export type Month = string
/** Fecha 'YYYY-MM-DD'. */
export type IsoDate = string

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/
const DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export function isMonth(value: unknown): value is Month {
  return typeof value === 'string' && MONTH_RE.test(value)
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  const m = DATE_RE.exec(value)
  if (!m) return false
  const day = Number(m[3])
  return day <= daysInMonth(`${m[1]}-${m[2]}`)
}

export function parseMonth(month: Month): { year: number; month: number } {
  const m = MONTH_RE.exec(month)
  if (!m) throw new RangeError(`Mes inválido: ${month}`)
  return { year: Number(m[1]), month: Number(m[2]) }
}

export function parseDate(date: IsoDate): { year: number; month: number; day: number } {
  if (!isIsoDate(date)) throw new RangeError(`Fecha inválida: ${String(date)}`)
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  }
}

export function toMonth(year: number, month: number): Month {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

export function toDate(year: number, month: number, day: number): IsoDate {
  return `${toMonth(year, month)}-${String(day).padStart(2, '0')}`
}

/** Mes de una fecha: '2026-03-15' → '2026-03'. */
export function monthOf(date: IsoDate): Month {
  parseDate(date)
  return date.slice(0, 7)
}

/** Suma (o resta) meses: addMonths('2026-12', 1) → '2027-01'. */
export function addMonths(month: Month, delta: number): Month {
  const { year, month: m } = parseMonth(month)
  const index = year * 12 + (m - 1) + delta
  return toMonth(Math.floor(index / 12), (index % 12) + 1)
}

/** Diferencia en meses b - a: monthDiff('2026-11', '2027-02') → 3. */
export function monthDiff(a: Month, b: Month): number {
  const pa = parseMonth(a)
  const pb = parseMonth(b)
  return (pb.year - pa.year) * 12 + (pb.month - pa.month)
}

export function compareMonths(a: Month, b: Month): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Meses desde `from` hasta `to` inclusive. Vacío si from > to. */
export function monthRange(from: Month, to: Month): Month[] {
  const n = monthDiff(from, to)
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addMonths(from, i))
}

/** Los 12 meses de un año. */
export function monthsOfYear(year: number): Month[] {
  return Array.from({ length: 12 }, (_, i) => toMonth(year, i + 1))
}

export function daysInMonth(month: Month): number {
  const { year, month: m } = parseMonth(month)
  if (m === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(m) ? 30 : 31
}

/** Día ajustado al largo del mes: clampDay('2026-02', 31) → 28. */
export function clampDay(month: Month, day: number): number {
  return Math.min(Math.max(1, Math.trunc(day)), daysInMonth(month))
}

/** Fecha con el día ajustado al mes: dateInMonth('2026-02', 30) → '2026-02-28'. */
export function dateInMonth(month: Month, day: number): IsoDate {
  const { year, month: m } = parseMonth(month)
  return toDate(year, m, clampDay(month, day))
}

/** Fecha local de hoy (no UTC). */
export function todayIso(now: Date = new Date()): IsoDate {
  return toDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function currentMonth(now: Date = new Date()): Month {
  return toMonth(now.getFullYear(), now.getMonth() + 1)
}

function monthToLocalDate(month: Month): Date {
  const { year, month: m } = parseMonth(month)
  return new Date(year, m - 1, 1)
}

function dateToLocalDate(date: IsoDate): Date {
  const { year, month, day } = parseDate(date)
  return new Date(year, month - 1, day)
}

/** 'noviembre 2026' */
export function formatMonthLong(month: Month): string {
  return format(monthToLocalDate(month), 'MMMM yyyy', { locale: es })
}

/** 'Noviembre 2026' */
export function formatMonthTitle(month: Month): string {
  const text = formatMonthLong(month)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** 'nov 26' */
export function formatMonthShort(month: Month): string {
  return format(monthToLocalDate(month), 'MMM yy', { locale: es }).replace('.', '')
}

/** 'ene', 'feb', ... */
export function formatMonthAbbr(month: Month): string {
  return format(monthToLocalDate(month), 'MMM', { locale: es }).replace('.', '')
}

/** '15/03/2026' */
export function formatDateShort(date: IsoDate): string {
  return format(dateToLocalDate(date), 'dd/MM/yyyy')
}

/** 'lunes 15 de marzo' */
export function formatDayHeading(date: IsoDate): string {
  return format(dateToLocalDate(date), "EEEE d 'de' MMMM", { locale: es })
}
