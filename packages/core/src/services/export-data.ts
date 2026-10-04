import { centsToDecimalString, mulDivRound, type Cents } from '@shared/money'
import { formatDateShort, formatMonthTitle, monthsOfYear, type Month } from '@shared/months'
import type { ExportRequest, Expense, Income, SavingsMovement } from '@shared/types'
import type { ServiceContext } from './context'
import { savingsArsOutflow } from './summary-calc'

/**
 * Datos y cálculos de la exportación, comunes a la PC (exceljs) y al celu (xlsx propio). Acá no se arma
 * ningún archivo binario: sólo el CSV, que es texto.
 */
export interface ExportData {
  title: string
  months: Month[]
  expenses: Expense[]
  incomes: Income[]
  savings: SavingsMovement[]
}

export interface ExpenseLine {
  date: string
  month: string
  category: string
  subcategory: string
  description: string
  method: string
  installment: string
  amount: Cents | null
  /** Nombre del grupo y de quién pagó; vacíos si el gasto es personal. */
  group: string
  paidBy: string
}

/** Una fila del resumen: valores por mes y, si hay más de un mes, total y promedio. */
export interface SummaryLine {
  label: string
  values: Cents[]
  total: Cents
  average: Cents
}

export interface ExportSummary {
  /** Más de un mes: lleva columnas Total y Promedio. */
  multi: boolean
  header: string[]
  income: SummaryLine
  spent: SummaryLine
  saved: SummaryLine
  available: SummaryLine
  pendingCount: number
  categories: { line: SummaryLine; subcategories: SummaryLine[] }[]
}

export interface ExportLookups {
  subs: Map<number, { sub: string; cat: string }>
  methods: Map<number, string>
  goals: Map<number, string>
  groups: Map<number, string>
  members: Map<number, string>
}

export type ExportDataService = ReturnType<typeof createExportDataService>

export function createExportDataService({ repos }: Pick<ServiceContext, 'repos'>) {
  function lookups(): ExportLookups {
    const categories = repos.catalog.listCategories()
    const subs = new Map(
      categories.flatMap((c) => c.subcategories.map((s) => [s.id, { sub: s.name, cat: c.name }])),
    )
    const methods = new Map(repos.paymentMethods.list().map((m) => [m.id, m.name]))
    const goals = new Map(repos.savings.listGoals().map((g) => [g.id, g.name]))
    const groupList = repos.groups.list()
    const groups = new Map(groupList.map((g) => [g.id, g.name]))
    const members = new Map(groupList.flatMap((g) => g.members.map((m) => [m.id, m.name])))
    return { subs, methods, goals, groups, members }
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

  function expenseLines(
    data: ExportData,
    { subs, methods, groups, members } = lookups(),
  ): ExpenseLine[] {
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
      group: e.group ? (groups.get(e.group.groupId) ?? '') : '',
      paidBy: e.group ? (members.get(e.group.paidByMemberId) ?? '') : '',
    }))
  }

  function summary(data: ExportData, { subs } = lookups()): ExportSummary {
    const index = new Map(data.months.map((m, i) => [m, i]))
    const multi = data.months.length > 1
    const perMonth = (items: { month: string; cents: number }[]) => {
      const values = data.months.map(() => 0)
      for (const it of items) {
        const i = index.get(it.month)
        if (i !== undefined) values[i] = (values[i] ?? 0) + it.cents
      }
      return values
    }
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
    // El promedio es sobre los meses con ingresos o gastos.
    const divisor = Math.max(
      1,
      data.months.filter((_, i) => (income[i] ?? 0) !== 0 || (spent[i] ?? 0) !== 0).length,
    )
    const line = (label: string, values: number[]): SummaryLine => {
      const total = values.reduce((a, b) => a + b, 0)
      return { label, values, total, average: mulDivRound(total, 1, divisor) }
    }

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
    const sum = (v: number[]) => v.reduce((x, y) => x + y, 0)
    const categories = [...byCat]
      .sort((a, b) => sum(b[1].values) - sum(a[1].values))
      .map(([name, cat]) => ({
        line: line(name, cat.values),
        subcategories: [...cat.subs]
          .sort((a, b) => sum(b[1]) - sum(a[1]))
          .map(([subName, values]) => line(subName, values)),
      }))

    return {
      multi,
      header: [
        '',
        ...data.months.map((m) => formatMonthTitle(m)),
        ...(multi ? ['Total', 'Promedio'] : []),
      ],
      income: line('Ingresos', income),
      spent: line('Gastado', spent),
      saved: line('Ahorrado (neto)', saved),
      available: line('Disponible', available),
      pendingCount: data.expenses.filter((e) => e.amountCents === null).length,
      categories,
    }
  }

  /** CSV de los gastos para Excel en español: separador ";", coma decimal, UTF-8 con BOM. */
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
      'Grupo',
      'Pagó',
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
        l.group,
        l.paidBy,
      ]
        .map(cell)
        .join(';'),
    )
    return '﻿' + [header.join(';'), ...lines].join('\r\n') + '\r\n'
  }

  return { lookups, load, expenseLines, summary, buildCsv }
}
