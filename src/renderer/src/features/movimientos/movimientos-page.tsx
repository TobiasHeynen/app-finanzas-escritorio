import { useMemo, useState } from 'react'
import { Search, SearchX } from 'lucide-react'
import { sumCents } from '@shared/money'
import { addMonths, currentMonth, formatMonthTitle, type Month } from '@shared/months'
import type { Expense } from '@shared/types'
import { Money } from '@renderer/components/money'
import { MonthStepper } from '@renderer/components/month-stepper'
import { EmptyState, Page, PageHeader } from '@renderer/components/page'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useCatalog } from '@renderer/lib/catalog'
import { keys, useApiQuery } from '@renderer/lib/hooks'
import { useDebouncedValue } from '@renderer/lib/use-debounced-value'
import { ExpenseList } from '@renderer/features/gastos/expense-list'

export function MovimientosPage() {
  const { categories, paymentMethods } = useCatalog()
  const [fromMonth, setFromMonth] = useState<Month>(addMonths(currentMonth(), -2))
  const [toMonth, setToMonth] = useState<Month>(currentMonth())
  const [text, setText] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const debounced = useDebouncedValue(text, 250)

  const input = {
    fromMonth: fromMonth <= toMonth ? fromMonth : toMonth,
    toMonth: fromMonth <= toMonth ? toMonth : fromMonth,
    text: debounced.trim() || null,
    categoryId,
    paymentMethodId,
  }
  const { data = [], isLoading } = useApiQuery('expenses:search', input, [
    ...keys.expenses,
    'search',
    input,
  ])

  const byMonth = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of data) {
      const list = map.get(e.chargeMonth) ?? []
      list.push(e)
      map.set(e.chargeMonth, list)
    }
    return [...map].sort(([a], [b]) => (a < b ? 1 : -1))
  }, [data])

  return (
    <Page>
      <PageHeader
        title="Movimientos"
        description="Todos los gastos por mes de imputación, con búsqueda y filtros."
      />
      <Card className="flex-row flex-wrap items-end gap-4 px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <Label>Desde</Label>
          <MonthStepper size="sm" value={fromMonth} onChange={setFromMonth} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Hasta</Label>
          <MonthStepper size="sm" value={toMonth} onChange={setToMonth} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="mov-search">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="mov-search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Detalle, nota o subcategoría"
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Categoría</Label>
          <Select
            value={categoryId?.toString() ?? 'all'}
            onValueChange={(v) => setCategoryId(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Medio de pago</Label>
          <Select
            value={paymentMethodId?.toString() ?? 'all'}
            onValueChange={(v) => setPaymentMethodId(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {paymentMethods.map((m) => (
                <SelectItem key={m.id} value={m.id.toString()}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : byMonth.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-5" />}
          title="No hay movimientos"
          description="Probá con otro rango o sacá algún filtro."
        />
      ) : (
        byMonth.map(([month, list]) => (
          <Card key={month} className="gap-3">
            <div className="flex items-center justify-between px-6">
              <h2 className="text-lg font-semibold">{formatMonthTitle(month)}</h2>
              <Money cents={sumCents(list.map((e) => e.amountCents))} className="font-semibold" />
            </div>
            <CardContent className="px-3">
              <ExpenseList expenses={list} month={month} showChargeMonth />
            </CardContent>
          </Card>
        ))
      )}
    </Page>
  )
}
