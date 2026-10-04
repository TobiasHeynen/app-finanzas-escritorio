import ExcelJS from 'exceljs'
import { centsToDecimalString, type Cents } from '@shared/money'
import { formatMonthTitle, parseDate } from '@shared/months'
import type { ExportRequest } from '@shared/types'
import { INCOME_TYPE_LABELS } from '@shared/types'
import type { ServiceContext } from '@core/services/context'
import {
  createExportDataService,
  type ExportData,
  type SummaryLine,
} from '@core/services/export-data'

export type { ExportData }

const ARS_FORMAT = '"$" #,##0.00;-"$" #,##0.00'
const USD_FORMAT = '"US$" #,##0.00;-"US$" #,##0.00'
const RATE_FORMAT = '#,##0.00'

/** Valor numérico para la celda (pesos con decimales). Sólo para exportar, nunca para calcular. */
const toNumber = (cents: Cents): number => Number(centsToDecimalString(cents))

export type ExportService = ReturnType<typeof createExportService>

export function createExportService({ repos }: ServiceContext) {
  const exportData = createExportDataService({ repos })
  const { load, buildCsv } = exportData

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
    const lookups = exportData.lookups()
    const summaryData = exportData.summary(data, lookups)
    const { multi } = summaryData

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

    const line = (l: SummaryLine, label = l.label) => [
      label,
      ...l.values.map(toNumber),
      ...(multi ? [toNumber(l.total), toNumber(l.average)] : []),
    ]

    styleHeader(summary.addRow(summaryData.header))
    summary.addRow(line(summaryData.income))
    summary.addRow(line(summaryData.spent))
    summary.addRow(line(summaryData.saved))
    const availableRow = summary.addRow(line(summaryData.available))
    availableRow.font = { bold: true }
    const pending = summaryData.pendingCount
    if (pending > 0) {
      summary.addRow([`${String(pending)} gastos pendientes de cargar (no suman)`]).font = {
        italic: true,
        color: { argb: 'FFB45309' },
      }
    }
    summary.addRow([])

    const catHeader = summary.addRow(['Gastos por categoría', ...summaryData.header.slice(1)])
    styleHeader(catHeader)
    for (const cat of summaryData.categories) {
      summary.addRow(line(cat.line)).font = { bold: true }
      for (const sub of cat.subcategories) {
        const r = summary.addRow(line(sub, `   ${sub.label}`))
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
        { header: 'Grupo', key: 'group', width: 16 },
        { header: 'Pagó', key: 'paidBy', width: 14 },
      ],
      exportData.expenseLines(data, lookups).map((l) => ({
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
        goal: s.goalId !== null ? (lookups.goals.get(s.goalId) ?? '') : '',
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
