import { Fragment, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight, ChevronDown, BarChart3 } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney } from '@shared/money'
import { currentMonth, formatMonthAbbr, parseMonth } from '@shared/months'
import type { ReportRow, YearReport } from '@shared/types'
import { CategoryIcon } from '@renderer/components/category-icon'
import { ExportMenu } from '@renderer/components/export-menu'
import { Money } from '@renderer/components/money'
import { EmptyState, Page, PageHeader } from '@renderer/components/page'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@renderer/components/ui/card'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useCatalog } from '@renderer/lib/catalog'
import { keys, useApiQuery } from '@renderer/lib/hooks'
import { cn } from '@renderer/lib/utils'

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
}

export function ReportePage() {
  const [params, setParams] = useSearchParams()
  const paramYear = Number(params.get('anio'))
  const year =
    Number.isInteger(paramYear) && paramYear >= 2000 && paramYear <= 2100
      ? paramYear
      : parseMonth(currentMonth()).year
  const setYear = (y: number) => setParams({ anio: String(y) }, { replace: true })
  const { data, isLoading } = useApiQuery('report:year', { year }, [...keys.report, year])

  return (
    <Page>
      <PageHeader
        title="Reporte anual"
        description="En qué se fue la plata, mes a mes."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setYear(year - 1)}
                aria-label="Año anterior"
              >
                <ChevronLeft />
              </Button>
              <span
                className="min-w-16 text-center text-xl font-semibold tabular-nums"
                aria-live="polite"
              >
                {year}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setYear(year + 1)}
                aria-label="Año siguiente"
              >
                <ChevronRight />
              </Button>
            </div>
            <ExportMenu scope="year" period={String(year)} />
          </>
        }
      />
      {isLoading || !data ? (
        <>
          <Skeleton className="h-24" />
          <Skeleton className="h-80" />
        </>
      ) : data.spent.totalCents === 0 && data.income.totalCents === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title={`No hay movimientos en ${String(year)}.`}
          description={
            data.availableYears.length > 0
              ? `Tenés datos en ${data.availableYears.join(', ')}.`
              : undefined
          }
        />
      ) : (
        <>
          <Totals report={data} />
          <ChartCard report={data} />
          <CategoryTable report={data} />
        </>
      )}
    </Page>
  )
}

function Totals({ report }: { report: YearReport }) {
  const tiles: { label: string; cents: number; hint?: string; tone?: string }[] = [
    { label: 'Ingresos', cents: report.income.totalCents, tone: 'text-positive' },
    { label: 'Gastado', cents: report.spent.totalCents, tone: 'text-negative' },
    { label: 'Ahorrado (neto)', cents: report.saved.totalCents },
    {
      label: 'Disponible acumulado',
      cents: report.available.totalCents,
      tone: report.available.totalCents < 0 ? 'text-negative' : 'text-positive',
    },
    {
      label: 'Gasto promedio por mes',
      cents: report.spent.averageCents,
      hint: `Sobre ${String(report.monthsWithData)} ${report.monthsWithData === 1 ? 'mes' : 'meses'} con movimientos`,
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {tiles.map((t) => (
        <Card key={t.label} className="gap-2 px-5 py-4">
          <span className="text-sm text-muted-foreground">{t.label}</span>
          <Money cents={t.cents} decimals="never" className={cn('text-xl font-semibold', t.tone)} />
          {t.hint && <span className="text-xs text-muted-foreground">{t.hint}</span>}
        </Card>
      ))}
    </div>
  )
}

function ChartCard({ report }: { report: YearReport }) {
  const { categoryById } = useCatalog()
  // Los ceros van como undefined: así el tooltip no lista categorías vacías y la línea de
  // ingresos se corta en los meses futuros sin ingresos en vez de caer a cero.
  const data = report.months.map((m, i) => {
    const row: Record<string, number | string | undefined> = { label: formatMonthAbbr(m) }
    const income = report.income.byMonth[i] ?? 0
    row['income'] = income === 0 ? undefined : income
    for (const c of report.categories) {
      const v = c.byMonth[i] ?? 0
      row[`c${String(c.categoryId)}`] = v === 0 ? undefined : v
    }
    return row
  })
  const projectedLabel = report.projectedFrom ? formatMonthAbbr(report.projectedFrom) : null
  const lastLabel = formatMonthAbbr(report.months[11] ?? '')

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Gastos por categoría e ingresos</CardTitle>
        <CardDescription>
          {report.projectedFrom
            ? 'La zona sombreada son meses futuros: cuotas cargadas y recurrentes proyectados.'
            : 'Barras: gastos por categoría. Línea: ingresos.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={90}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                tickFormatter={(v) => formatMoney(Number(v), 'ARS', { decimals: 'never' })}
              />
              {projectedLabel && (
                <ReferenceArea
                  x1={projectedLabel}
                  x2={lastLabel}
                  fill="var(--muted-foreground)"
                  fillOpacity={0.08}
                  ifOverflow="extendDomain"
                />
              )}
              <Tooltip
                cursor={{ fill: 'var(--accent)' }}
                contentStyle={tooltipStyle}
                separator=": "
                formatter={(v, name) => [
                  formatMoney(Number(v), 'ARS', { decimals: 'never' }),
                  name,
                ]}
                itemSorter={(item) => -Number(item.value)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
              {report.categories.map((c) => {
                const cat = categoryById.get(c.categoryId)
                return (
                  <Bar
                    key={c.categoryId}
                    dataKey={`c${String(c.categoryId)}`}
                    name={cat?.name ?? '—'}
                    stackId="spent"
                    fill={cat?.color ?? '#64748b'}
                    maxBarSize={40}
                  />
                )
              })}
              <Line
                type="monotone"
                dataKey="income"
                name="Ingresos"
                stroke="var(--positive)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--positive)' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

function Cells({ row, strong }: { row: ReportRow; strong?: boolean }) {
  return (
    <>
      {row.byMonth.map((v, i) => (
        <td key={i} className={cn('px-2 py-2 text-right', v === 0 && 'text-muted-foreground/50')}>
          {v === 0 ? '—' : formatMoney(v, 'ARS', { decimals: 'never' })}
        </td>
      ))}
      <td className={cn('bg-muted/40 px-3 py-2 text-right', strong !== false && 'font-semibold')}>
        {formatMoney(row.totalCents, 'ARS', { decimals: 'never' })}
      </td>
      <td className="px-3 py-2 text-right text-muted-foreground">
        {formatMoney(row.averageCents, 'ARS', { decimals: 'never' })}
      </td>
    </>
  )
}

function CategoryTable({ report }: { report: YearReport }) {
  const { categoryById, subcategoryById } = useCatalog()
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allOpen = open.size === report.categories.length

  return (
    <Card className="gap-4">
      <CardHeader className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Detalle por categoría</CardTitle>
          <CardDescription>Tocá una categoría para ver sus subcategorías.</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setOpen(allOpen ? new Set() : new Set(report.categories.map((c) => c.categoryId)))
          }
        >
          {allOpen ? 'Colapsar todo' : 'Expandir todo'}
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-xs money">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-medium">
                  Categoría
                </th>
                {report.months.map((m) => (
                  <th
                    key={m}
                    className={cn(
                      'px-2 py-2 text-right font-medium capitalize',
                      report.projectedFrom !== null && m >= report.projectedFrom && 'italic',
                    )}
                  >
                    {formatMonthAbbr(m)}
                  </th>
                ))}
                <th className="bg-muted/40 px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {report.categories.map((c) => {
                const cat = categoryById.get(c.categoryId)
                const expanded = open.has(c.categoryId)
                return (
                  <Fragment key={c.categoryId}>
                    <tr
                      className="cursor-pointer border-b transition-colors hover:bg-accent/50"
                      onClick={() => toggle(c.categoryId)}
                    >
                      <td className="sticky left-0 z-10 bg-card px-4 py-2">
                        <button
                          type="button"
                          className="flex items-center gap-2 text-sm font-medium outline-none focus-visible:underline"
                          aria-expanded={expanded}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggle(c.categoryId)
                          }}
                        >
                          <ChevronDown
                            className={cn(
                              'size-3.5 text-muted-foreground transition-transform',
                              !expanded && '-rotate-90',
                            )}
                          />
                          <CategoryIcon
                            icon={cat?.icon ?? 'tag'}
                            color={cat?.color ?? '#64748b'}
                            size="sm"
                            className="size-6"
                          />
                          <span className="whitespace-nowrap">{cat?.name ?? '—'}</span>
                        </button>
                      </td>
                      <Cells row={c} />
                    </tr>
                    {expanded &&
                      c.subcategories.map((s) => (
                        <tr key={s.subcategoryId} className="border-b bg-muted/20">
                          <td className="sticky left-0 z-10 bg-card py-1.5 pr-4 pl-16 whitespace-nowrap text-muted-foreground">
                            {subcategoryById.get(s.subcategoryId)?.name ?? '—'}
                          </td>
                          <Cells row={s} strong={false} />
                        </tr>
                      ))}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="sticky left-0 z-10 bg-card px-4 py-2 text-sm">Total gastos</td>
                <Cells row={report.spent} />
              </tr>
              <tr className="text-positive">
                <td className="sticky left-0 z-10 bg-card px-4 py-2 text-sm">Ingresos</td>
                <Cells row={report.income} />
              </tr>
            </tfoot>
          </table>
        </div>
        {report.pendingCount > 0 && (
          <p className="px-6 pt-3 text-xs text-pending">
            {report.pendingCount}{' '}
            {report.pendingCount === 1
              ? 'gasto pendiente de cargar no suma'
              : 'gastos pendientes de cargar no suman'}{' '}
            en el reporte.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
