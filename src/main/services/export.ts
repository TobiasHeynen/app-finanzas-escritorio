import ExcelJS from 'exceljs'
import { centsToDecimalString, mulDivRound, type Cents } from '@shared/money'
import {
  formatDateShort,
  formatMonthTitle,
  monthsOfYear,
  parseDate,
  type Month,
} from '@shared/months'
import type { ExportRequest, Expense, Income, SavingsMovement } from '@shared/types'
import { INCOME_TYPE_LABELS } from '@shared/types'
import type { ServiceContext } from './context'
import { savingsArsOutflow } from './summary-calc'

const ARS_FORMAT = '"$" #,##0.00;-"$" #,##0.00'
const USD_FORMAT = '"US$" #,##0.00;-"US$" #,##0.00'
const RATE_FORMAT = '#,##0.00'

/** Valor numérico para la celda (pesos con decimales). Sólo para exportar, nunca para calcular. */
const toNumber = (cents: Cents): number => Number(centsToDecimalString(cents))

export interface ExportData {
  title: string
  months: Month[]
  expenses: Expense[]
  incomes: Income[]
  savings: SavingsMovement[]
}

interface ExpenseLine {
  date: string
  month: string
  category: string
  subcategory: string
  description: string
  method: string
  installment: string
  amount: Cents | null
}

export type ExportService = ReturnType<typeof createExportService>

export function createExportService({ repos }: ServiceContext) {
  function lookups() {
    const categories = repos.catalog.listCategories()
    const subs = new Map(
      categories.flatMap((c) => c.subcategories.map((s) => [s.id, { sub: s.name, cat: c.name }])),
    )
    const methods = new Map(repos.paymentMethods.list().map((m) => [m.id, m.name]))
    const goals = new Map(repos.savings.listGoals().map((g) => [g.id, g.name]))
    return { subs, methods, goals }
  }

  function load(req: ExportRequest): ExportData {
    const months = req.scope === 'month' ? [req.period] : monthsOfYear(Number(req.period))
    const first = months[0] ?? req.period
    const last = months[months.length - 1] ?? req.period
    return {
      title: req.scope === 'month' ? formatMonthTitle(req.period) : `Año ${req.period}`,
      months,
      expenses: repos.expenses.listByRange(first, last),
      incomes: repos.incomes.listByRange(first, last),
      savings: repos.savings.listByRange(first, last),
    }
  }

  function expenseLines(data: ExportData): ExpenseLine[] {
    const { subs, methods } = lookups()
    return data.expenses.map((e) => ({
      date: e.purchaseDate,
      month: e.chargeMonth,
      category: subs.get(e.subcategoryId)?.cat ?? '',
      subcategory: subs.get(e.subcategoryId)?.sub ?? '',
      description: e.description,
      method: methods.get(e.paymentMethodId) ?? '',
      installment: e.installment
        ? `${String(e.installment.number)}/${String(e.installment.count)}`
        : '',
      amount: e.amountCents,
    }))
  }

  /** Fecha como Date de Excel (mediodía UTC para que ningún huso horario la corra de día). */
  const excelDate = (iso: string) => {
    const { year, month, day } = parseDate(iso)
    return new Date(Date.UTC(year, month - 1, day, 12))
  }

  function styleHeader(row: ExcelJS.Row) {
    row.font = { bold: true }
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5EE' } }
    row.border = { bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } } }
  }

  function addTable(
    sheet: ExcelJS.Worksheet,
    columns: { header: string; key: string; width: number; numFmt?: string }[],
    rows: Record<string, unknown>[],
  ) {
    sheet.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
      style: c.numFmt ? { numFmt: c.numFmt } : {},
    }))
    styleHeader(sheet.getRow(1))
    sheet.addRows(rows)
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    if (rows.length > 0) {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
    }
  }

  async function buildXlsx(data: ExportData): Promise<Buffer> {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Chanchito'
    wb.created = new Date()
    const { subs, goals } = lookups()
    const index = new Map(data.months.map((m, i) => [m, i]))
    const multi = data.months.length > 1

    // ----- Resumen -----
    const summary = wb.addWorksheet('Resumen')
    const valueCols = data.months.length + (multi ? 2 : 0)
    summary.getColumn(1).width = 30
    for (let c = 2; c <= valueCols + 1; c++) {
      summary.getColumn(c).width = 15
      summary.getColumn(c).numFmt = ARS_FORMAT
    }
    const titleRow = summary.addRow([`Chanchito · ${data.title}`])
    titleRow.font = { bold: true, size: 14 }
    summary.addRow([])

    const header = [
      '',
      ...data.months.map((m) => formatMonthTitle(m)),
      ...(multi ? ['Total', 'Promedio'] : []),
    ]
    const perMonth = (items: { month: string; cents: number }[]) => {
      const values = data.months.map(() => 0)
      for (const it of items) {
        const i = index.get(it.month)
        if (i !== undefined) values[i] = (values[i] ?? 0) + it.cents
      }
      return values
    }
    const activeMonths = (values: number[][]) =>
      Math.max(1, data.months.filter((_, i) => values.some((v) => (v[i] ?? 0) !== 0)).length)
    const income = perMonth(data.incomes.map((i) => ({ month: i.month, cents: i.amountCents })))
    const spent = perMonth(
      data.expenses.map((e) => ({ month: e.chargeMonth, cents: e.amountCents ?? 0 })),
    )
    const saved = perMonth(
      data.savings.map((s) => ({ month: s.month, cents: savingsArsOutflow(s) })),
    )
    const available = data.months.map(
      (_, i) => (income[i] ?? 0) - (spent[i] ?? 0) - (saved[i] ?? 0),
    )
    const divisor = activeMonths([income, spent])
    const line = (label: string, values: number[]) => {
      const total = values.reduce((a, b) => a + b, 0)
      return [
        label,
        ...values.map(toNumber),
        ...(multi ? [toNumber(total), toNumber(mulDivRound(total, 1, divisor))] : []),
      ]
    }

    styleHeader(summary.addRow(header))
    summary.addRow(line('Ingresos', income))
    summary.addRow(line('Gastado', spent))
    summary.addRow(line('Ahorrado (neto)', saved))
    const availableRow = summary.addRow(line('Disponible', available))
    availableRow.font = { bold: true }
    const pending = data.expenses.filter((e) => e.amountCents === null).length
    if (pending > 0) {
      summary.addRow([`${String(pending)} gastos pendientes de cargar (no suman)`]).font = {
        italic: true,
        color: { argb: 'FFB45309' },
      }
    }
    summary.addRow([])

    const catHeader = summary.addRow(['Gastos por categoría', ...header.slice(1)])
    styleHeader(catHeader)
    const byCat = new Map<string, { values: number[]; subs: Map<string, number[]> }>()
    for (const e of data.expenses) {
      if (e.amountCents === null) continue
      const names = subs.get(e.subcategoryId) ?? { cat: '—', sub: '—' }
      let cat = byCat.get(names.cat)
      if (!cat) {
        cat = { values: data.months.map(() => 0), subs: new Map() }
        byCat.set(names.cat, cat)
      }
      let sub = cat.subs.get(names.sub)
      if (!sub) {
        sub = data.months.map(() => 0)
        cat.subs.set(names.sub, sub)
      }
      const i = index.get(e.chargeMonth) ?? 0
      cat.values[i] = (cat.values[i] ?? 0) + e.amountCents
      sub[i] = (sub[i] ?? 0) + e.amountCents
    }
    const sortByTotal = <T>(entries: [string, T][], values: (t: T) => number[]) =>
      entries.sort(
        (a, b) => values(b[1]).reduce((x, y) => x + y, 0) - values(a[1]).reduce((x, y) => x + y, 0),
      )
    for (const [name, cat] of sortByTotal([...byCat], (c) => c.values)) {
      summary.addRow(line(name, cat.values)).font = { bold: true }
      for (const [subName, values] of sortByTotal([...cat.subs], (v) => v)) {
        const r = summary.addRow(line(`   ${subName}`, values))
        r.outlineLevel = 1
        r.font = { color: { argb: 'FF4B5563' } }
      }
    }
    summary.properties.outlineProperties = { summaryBelow: false, summaryRight: false }

    // ----- Gastos -----
    addTable(
      wb.addWorksheet('Gastos'),
      [
        { header: 'Fecha', key: 'date', width: 12, numFmt: 'dd/mm/yyyy' },
        { header: 'Mes', key: 'month', width: 16 },
        { header: 'Categoría', key: 'category', width: 18 },
        { header: 'Subcategoría', key: 'subcategory', width: 20 },
        { header: 'Detalle', key: 'description', width: 30 },
        { header: 'Medio de pago', key: 'method', width: 16 },
        { header: 'Cuota', key: 'installment', width: 8 },
        { header: 'Monto', key: 'amount', width: 15, numFmt: ARS_FORMAT },
        { header: 'Estado', key: 'status', width: 11 },
      ],
      expenseLines(data).map((l) => ({
        ...l,
        date: excelDate(l.date),
        month: formatMonthTitle(l.month),
        amount: l.amount === null ? null : toNumber(l.amount),
        status: l.amount === null ? 'Pendiente' : '',
      })),
    )

    // ----- Ingresos -----
    addTable(
      wb.addWorksheet('Ingresos'),
      [
        { header: 'Fecha', key: 'date', width: 12, numFmt: 'dd/mm/yyyy' },
        { header: 'Mes', key: 'month', width: 16 },
        { header: 'Tipo', key: 'type', width: 12 },
        { header: 'Detalle', key: 'description', width: 30 },
        { header: 'Monto', key: 'amount', width: 15, numFmt: ARS_FORMAT },
      ],
      data.incomes.map((i) => ({
        date: excelDate(i.date),
        month: formatMonthTitle(i.month),
        type: INCOME_TYPE_LABELS[i.type],
        description: i.description,
        amount: toNumber(i.amountCents),
      })),
    )

    // ----- Ahorros -----
    const savingsSheet = wb.addWorksheet('Ahorros')
    addTable(
      savingsSheet,
      [
        { header: 'Fecha', key: 'date', width: 12, numFmt: 'dd/mm/yyyy' },
        { header: 'Mes', key: 'month', width: 16 },
        { header: 'Movimiento', key: 'kind', width: 12 },
        { header: 'Moneda', key: 'currency', width: 9 },
        { header: 'Monto', key: 'amount', width: 15 },
        { header: 'Pesos', key: 'ars', width: 15, numFmt: ARS_FORMAT },
        { header: 'Cotización', key: 'rate', width: 12, numFmt: RATE_FORMAT },
        { header: 'Meta', key: 'goal', width: 20 },
        { header: 'Nota', key: 'note', width: 30 },
      ],
      data.savings.map((s) => ({
        date: excelDate(s.date),
        month: formatMonthTitle(s.month),
        kind: s.amountMinor > 0 ? 'Aporte' : 'Retiro',
        currency: s.currency,
        amount: toNumber(s.amountMinor),
        ars: s.arsCostCents === null ? null : toNumber(s.arsCostCents),
        rate: s.rateCentsPerUsd === null ? null : toNumber(s.rateCentsPerUsd),
        goal: s.goalId !== null ? (goals.get(s.goalId) ?? '') : '',
        note: s.note,
      })),
    )
    // El formato del monto depende de la moneda de cada fila.
    savingsSheet.getColumn('amount').eachCell((cell, rowNumber) => {
      if (rowNumber === 1) return
      cell.numFmt = data.savings[rowNumber - 2]?.currency === 'USD' ? USD_FORMAT : ARS_FORMAT
    })

    return Buffer.from(await wb.xlsx.writeBuffer())
  }

  /**
   * CSV de los gastos para Excel en español: separador ";", coma decimal, UTF-8 con BOM.
   */
  function buildCsv(data: ExportData): string {
    const header = [
      'Fecha',
      'Mes',
      'Categoría',
      'Subcategoría',
      'Detalle',
      'Medio de pago',
      'Cuota',
      'Monto',
      'Estado',
    ]
    const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const amount = (c: Cents | null) =>
      c === null ? '' : centsToDecimalString(c).replace('.', ',')
    const lines = expenseLines(data).map((l) =>
      [
        formatDateShort(l.date),
        l.month,
        l.category,
        l.subcategory,
        l.description,
        l.method,
        l.installment,
        amount(l.amount),
        l.amount === null ? 'Pendiente' : '',
      ]
        .map(cell)
        .join(';'),
    )
    return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n'
  }

  return {
    load,
    buildXlsx,
    buildCsv,
    /** Arma el archivo pedido: nombre sugerido y contenido. */
    async build(req: ExportRequest): Promise<{ filename: string; content: Buffer | string }> {
      const data = load(req)
      const filename = `chanchito-${req.period}.${req.format}`
      return {
        filename,
        content: req.format === 'xlsx' ? await buildXlsx(data) : buildCsv(data),
      }
    },
  }
}
