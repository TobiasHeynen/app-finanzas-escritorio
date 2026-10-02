import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { createExpensesService } from '@core/services/expenses'
import { createExportService } from '@main/services/export'
import { createRecurringService } from '@core/services/recurring'
import { createReportService } from '@core/services/report'
import { createSavingsService } from '@core/services/savings'
import { createTestContext, idsByName } from '../helpers/context'

function setup(today = '2026-10-15') {
  const ctx = createTestContext(today)
  const ids = idsByName(ctx)
  const recurring = createRecurringService(ctx)
  const expenses = createExpensesService(ctx)
  const savings = createSavingsService(ctx)
  const base = {
    subcategoryId: ids.sub('Chino'),
    paymentMethodId: ids.method('Débito'),
    description: 'Súper',
    chargeMonthOverride: null,
    notes: null,
  }
  expenses.create({ ...base, purchaseDate: '2026-02-10', amountCents: 100000 })
  expenses.create({ ...base, purchaseDate: '2026-03-10', amountCents: 50050 })
  expenses.create({
    ...base,
    subcategoryId: ids.sub('Uber'),
    description: 'Viaje; "nocturno"',
    purchaseDate: '2026-03-12',
    amountCents: 20000,
  })
  expenses.create({ ...base, purchaseDate: '2026-03-15', amountCents: null })
  ctx.repos.incomes.insert({
    month: '2026-03',
    type: 'sueldo',
    description: '',
    amountCents: 500000,
    date: '2026-03-01',
  })
  savings.createMovement({
    date: '2026-03-05',
    month: '2026-03',
    currency: 'USD',
    kind: 'aporte',
    amountMinor: 10000,
    arsCents: 125000,
    goalId: null,
    note: '',
  })
  recurring.create({
    description: 'Alquiler',
    subcategoryId: ids.sub('Alquiler'),
    paymentMethodId: ids.method('Transferencia'),
    defaultAmountCents: 300000,
    dayOfMonth: 1,
    startMonth: '2026-10',
    endMonth: null,
    active: true,
  })
  return {
    ctx,
    ids,
    report: createReportService(ctx, recurring),
    exporter: createExportService(ctx),
  }
}

describe('reporte anual', () => {
  it('agrupa por categoría y subcategoría mes a mes, con ingresos, ahorro y disponible', () => {
    const { report, ids } = setup()
    const r = report.year(2026)
    expect(r.months).toHaveLength(12)
    expect(r.projectedFrom).toBe('2026-11')

    const market = r.categories.find((c) => c.categoryId === ids.category('Supermercado'))!
    expect(market.byMonth[1]).toBe(100000)
    expect(market.byMonth[2]).toBe(50050)
    expect(market.totalCents).toBe(150050)

    // Alquiler: octubre generado + nov y dic proyectados.
    const fixed = r.categories.find((c) => c.categoryId === ids.category('Gastos fijos'))!
    expect(fixed.byMonth.slice(9)).toEqual([300000, 300000, 300000])

    expect(r.income.byMonth[2]).toBe(500000)
    expect(r.saved.byMonth[2]).toBe(125000)
    expect(r.available.byMonth[2]).toBe(500000 - 70050 - 125000)
    expect(r.pendingCount).toBe(1)
    // Meses con gastos o ingresos: feb, mar, oct, nov, dic.
    expect(r.monthsWithData).toBe(5)
    expect(market.averageCents).toBe(30010)
    expect(r.spent.totalCents).toBe(150050 + 20000 + 900000)
    // La categoría con más gasto va primero.
    expect(r.categories[0]?.categoryId).toBe(ids.category('Gastos fijos'))
    expect(r.availableYears).toEqual([2026])
  })
})

describe('exportación', () => {
  it('xlsx: hojas de resumen y detalle con montos numéricos y formato de moneda', async () => {
    const { exporter } = setup()
    const buffer = await exporter.buildXlsx(
      exporter.load({ scope: 'year', period: '2026', format: 'xlsx' }),
    )
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resumen', 'Gastos', 'Ingresos', 'Ahorros'])

    const detail = wb.getWorksheet('Gastos')!
    expect(detail.getRow(1).getCell(8).value).toBe('Monto')
    const amounts = detail.getColumn(8).values.slice(2)
    expect(amounts).toContain(500.5)
    const cell = detail.getRow(2).getCell(8)
    expect(typeof cell.value).toBe('number')
    expect(cell.numFmt).toContain('$')
    // El pendiente queda vacío y marcado.
    const pendingRow = detail
      .getSheetValues()
      .find((r) => Array.isArray(r) && r[9] === 'Pendiente') as unknown[]
    expect(pendingRow[8]).toBeUndefined()

    const summary = wb.getWorksheet('Resumen')!
    const rows = summary.getSheetValues().filter(Array.isArray) as unknown[][]
    const income = rows.find((r) => r[1] === 'Ingresos')!
    expect(income[4]).toBe(5000) // marzo
    expect(rows.find((r) => r[1] === 'Supermercado')?.[14]).toBe(1500.5) // total
  })

  it('csv: separador ";", coma decimal, BOM y comillas escapadas', () => {
    const { exporter } = setup()
    const csv = exporter.buildCsv(
      exporter.load({ scope: 'month', period: '2026-03', format: 'csv' }),
    )
    expect(csv.startsWith('﻿Fecha;Mes;Categoría')).toBe(true)
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines).toContain('10/03/2026;2026-03;Supermercado;Chino;Súper;Débito;;500,50;')
    expect(csv).toContain('"Viaje; ""nocturno"""')
    expect(csv).toContain(';;Pendiente')
  })
})
