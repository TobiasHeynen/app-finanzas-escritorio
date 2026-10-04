import { centsToDecimalString, type Cents } from '@shared/money'
import { formatMonthTitle } from '@shared/months'
import type { ExportRequest } from '@shared/types'
import { INCOME_TYPE_LABELS } from '@shared/types'
import { buildXlsx, type XlsxRow, type XlsxSheet } from '../xlsx/writer'
import type { ExportData, ExportDataService, ExportLookups, SummaryLine } from './export-data'

/** Valor numérico para la celda (pesos con decimales). Sólo para exportar, nunca para calcular. */
const toNumber = (cents: Cents): number => Number(centsToDecimalString(cents))

export interface ExportFile {
  filename: string
  mimeType: string
  content: Uint8Array | string
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Las mismas hojas que exporta la PC (Resumen, Gastos, Ingresos, Ahorros), armadas con el escritor propio.
 * El formato es más simple (sin agrupar filas plegables), pero los números y las columnas son iguales.
 */
export function buildWorkbook(
  service: ExportDataService,
  data: ExportData,
  lookups: ExportLookups = service.lookups(),
): Uint8Array {
  const summary = service.summary(data, lookups)
  const { multi } = summary
  const line = (l: SummaryLine, label = l.label) => [
    label,
    ...l.values.map(toNumber),
    ...(multi ? [toNumber(l.total), toNumber(l.average)] : []),
  ]
  const valueCols = data.months.length + (multi ? 2 : 0)

  const summaryRows: XlsxRow[] = [
    { cells: [{ v: `Chanchito · ${data.title}`, s: 'title' }] },
    { cells: [] },
    { cells: summary.header, style: 'header' },
    { cells: line(summary.income), style: 'ars' },
    { cells: line(summary.spent), style: 'ars' },
    { cells: line(summary.saved), style: 'ars' },
    { cells: line(summary.available), style: 'arsBold' },
  ]
  if (summary.pendingCount > 0) {
    summaryRows.push({
      cells: [`${String(summary.pendingCount)} gastos pendientes de cargar (no suman)`],
      style: 'warning',
    })
  }
  summaryRows.push({ cells: [] })
  summaryRows.push({ cells: ['Gastos por categoría', ...summary.header.slice(1)], style: 'header' })
  for (const cat of summary.categories) {
    summaryRows.push({ cells: line(cat.line), style: 'arsBold' })
    for (const sub of cat.subcategories) {
      summaryRows.push({ cells: line(sub, `   ${sub.label}`), style: 'arsMuted', outlineLevel: 1 })
    }
  }
  // La primera columna (etiquetas) va sin formato de moneda.
  for (const row of summaryRows) {
    const first = row.cells[0]
    if (row.style && row.style !== 'header' && row.style !== 'warning' && first !== undefined) {
      const labelStyle =
        row.style === 'arsBold' ? 'bold' : row.style === 'arsMuted' ? 'muted' : 'default'
      row.cells[0] = { v: typeof first === 'string' ? first : null, s: labelStyle }
    }
  }

  const header = (titles: string[]): XlsxRow => ({ cells: titles, style: 'header' })

  const expenses: XlsxSheet = {
    name: 'Gastos',
    widths: [12, 16, 18, 20, 30, 16, 8, 15, 11, 16, 14],
    table: true,
    rows: [
      header([
        'Fecha',
        'Mes',
        'Categoría',
        'Subcategoría',
        'Detalle',
        'Medio de pago',
        'Cuota',
        'Monto',
        'Estado',
        'Grupo',
        'Pagó',
      ]),
      ...service.expenseLines(data, lookups).map((l) => ({
        cells: [
          { v: { date: l.date } },
          formatMonthTitle(l.month),
          l.category,
          l.subcategory,
          l.description,
          l.method,
          l.installment,
          { v: l.amount === null ? null : toNumber(l.amount), s: 'ars' as const },
          l.amount === null ? 'Pendiente' : '',
          l.group,
          l.paidBy,
        ],
      })),
    ],
  }

  const incomes: XlsxSheet = {
    name: 'Ingresos',
    widths: [12, 16, 12, 30, 15],
    table: true,
    rows: [
      header(['Fecha', 'Mes', 'Tipo', 'Detalle', 'Monto']),
      ...data.incomes.map((i) => ({
        cells: [
          { v: { date: i.date } },
          formatMonthTitle(i.month),
          INCOME_TYPE_LABELS[i.type],
          i.description,
          { v: toNumber(i.amountCents), s: 'ars' as const },
        ],
      })),
    ],
  }

  const savings: XlsxSheet = {
    name: 'Ahorros',
    widths: [12, 16, 12, 9, 15, 15, 12, 20, 30],
    table: true,
    rows: [
      header([
        'Fecha',
        'Mes',
        'Movimiento',
        'Moneda',
        'Monto',
        'Pesos',
        'Cotización',
        'Meta',
        'Nota',
      ]),
      ...data.savings.map((s) => ({
        cells: [
          { v: { date: s.date } },
          formatMonthTitle(s.month),
          s.amountMinor > 0 ? 'Aporte' : 'Retiro',
          s.currency,
          {
            v: toNumber(s.amountMinor),
            s: s.currency === 'USD' ? ('usd' as const) : ('ars' as const),
          },
          { v: s.arsCostCents === null ? null : toNumber(s.arsCostCents), s: 'ars' as const },
          {
            v: s.rateCentsPerUsd === null ? null : toNumber(s.rateCentsPerUsd),
            s: 'rate' as const,
          },
          s.goalId !== null ? (lookups.goals.get(s.goalId) ?? '') : '',
          s.note,
        ],
      })),
    ],
  }

  return buildXlsx([
    { name: 'Resumen', widths: [30, ...Array<number>(valueCols).fill(15)], rows: summaryRows },
    expenses,
    incomes,
    savings,
  ])
}

/** Arma el archivo pedido (Excel o CSV de gastos) sin tocar el disco. */
export function buildExportFile(service: ExportDataService, req: ExportRequest): ExportFile {
  const data = service.load(req)
  const filename = `chanchito-${req.period}.${req.format}`
  return req.format === 'xlsx'
    ? { filename, mimeType: XLSX_MIME, content: buildWorkbook(service, data) }
    : { filename, mimeType: 'text/csv', content: service.buildCsv(data) }
}
