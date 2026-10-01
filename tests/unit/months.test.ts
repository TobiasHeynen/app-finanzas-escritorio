import { describe, expect, it } from 'vitest'
import {
  addMonths,
  clampDay,
  currentMonth,
  dateInMonth,
  daysInMonth,
  formatDayHeading,
  formatMonthLong,
  formatMonthShort,
  formatMonthTitle,
  isIsoDate,
  isMonth,
  monthDiff,
  monthOf,
  monthRange,
  monthsOfYear,
  todayIso,
} from '@shared/months'

describe('months', () => {
  it('valida meses y fechas', () => {
    expect(isMonth('2026-01')).toBe(true)
    expect(isMonth('2026-13')).toBe(false)
    expect(isMonth('2026-1')).toBe(false)
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-04-31')).toBe(false)
    expect(isIsoDate('2026-4-01')).toBe(false)
  })

  it('suma meses cruzando años', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-11', 14)).toBe('2028-01')
    expect(addMonths('2026-03', -27)).toBe('2023-12')
    expect(addMonths('2026-05', 0)).toBe('2026-05')
  })

  it('calcula diferencias y rangos', () => {
    expect(monthDiff('2026-11', '2027-02')).toBe(3)
    expect(monthDiff('2027-02', '2026-11')).toBe(-3)
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthRange('2026-05', '2026-05')).toEqual(['2026-05'])
    expect(monthRange('2026-06', '2026-05')).toEqual([])
    expect(monthsOfYear(2026)).toHaveLength(12)
    expect(monthsOfYear(2026)[11]).toBe('2026-12')
  })

  it('maneja largos de mes y bisiestos', () => {
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2100-02')).toBe(28)
    expect(daysInMonth('2000-02')).toBe(29)
    expect(daysInMonth('2026-04')).toBe(30)
    expect(daysInMonth('2026-12')).toBe(31)
    expect(clampDay('2026-02', 31)).toBe(28)
    expect(clampDay('2026-02', 0)).toBe(1)
    expect(dateInMonth('2026-04', 31)).toBe('2026-04-30')
  })

  it('toma el mes de una fecha', () => {
    expect(monthOf('2026-03-15')).toBe('2026-03')
    expect(() => monthOf('2026-03-32')).toThrow()
  })

  it('usa la fecha local, no UTC', () => {
    // 31/12 a las 23:30 hora local sigue siendo 31/12 aunque en UTC ya sea 1/1
    const late = new Date(2026, 11, 31, 23, 30)
    expect(todayIso(late)).toBe('2026-12-31')
    expect(currentMonth(late)).toBe('2026-12')
  })

  it('formatea en español', () => {
    expect(formatMonthLong('2026-11')).toBe('noviembre 2026')
    expect(formatMonthTitle('2026-11')).toBe('Noviembre 2026')
    expect(formatMonthShort('2026-09')).toMatch(/^sept? 26$/)
    expect(formatDayHeading('2026-03-16')).toBe('lunes 16 de marzo')
  })
})
