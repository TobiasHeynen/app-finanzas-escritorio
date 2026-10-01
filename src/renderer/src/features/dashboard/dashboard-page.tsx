import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Plus, Receipt, Search, X } from 'lucide-react'
import { currentMonth, isMonth, monthOf, todayIso } from '@shared/months'
import { MonthStepper } from '@renderer/components/month-stepper'
import { EmptyState, Page } from '@renderer/components/page'
import { PaymentMethodIcon } from '@renderer/components/payment-method-icon'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useCatalog } from '@renderer/lib/catalog'
import { useMonthOverview } from '@renderer/lib/movements'
import { ExpenseList } from '@renderer/features/gastos/expense-list'
import { useExpenseDialog } from '@renderer/features/gastos/expense-dialog-provider'
import { IncomesCard } from '@renderer/features/ingresos/incomes-card'
import { CategoryDonut } from './category-donut'
import { SummaryCards } from './summary-cards'

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function DashboardPage() {
  const [params, setParams] = useSearchParams()
  const paramMonth = params.get('mes')
  const month = paramMonth && isMonth(paramMonth) ? paramMonth : currentMonth()
  const setMonth = (m: string) => setParams({ mes: m }, { replace: true })

  const { data, isLoading } = useMonthOverview(month)
  const { subcategoryById, paymentMethods } = useCatalog()
  const { openNew } = useExpenseDialog()
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [methodId, setMethodId] = useState<number | null>(null)
  const [text, setText] = useState('')

  const filtered = useMemo(() => {
    if (!data) return { expenses: [], projected: [] }
    const q = normalize(text.trim())
    const match = (e: {
      subcategoryId: number
      categoryId: number
      paymentMethodId: number
      description: string
    }) => {
      if (categoryId !== null && e.categoryId !== categoryId) return false
      if (methodId !== null && e.paymentMethodId !== methodId) return false
      if (!q) return true
      const sub = subcategoryById.get(e.subcategoryId)
      return normalize(`${e.description} ${sub?.name ?? ''} ${sub?.category.name ?? ''}`).includes(
        q,
      )
    }
    return { expenses: data.expenses.filter(match), projected: data.projected.filter(match) }
  }, [data, text, categoryId, methodId, subcategoryById])

  const filtersActive = categoryId !== null || methodId !== null || text.trim() !== ''
  const isCurrent = month === currentMonth()
  const newDefaults = isCurrent ? undefined : { purchaseDate: `${month}-01` }

  return (
    <Page>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <MonthStepper value={month} onChange={setMonth} size="lg" />
        {!isCurrent && (
          <Button variant="ghost" size="sm" onClick={() => setMonth(monthOf(todayIso()))}>
            Ir al mes actual
          </Button>
        )}
      </header>

      {isLoading || !data ? <Skeleton className="h-28" /> : <SummaryCards summary={data.summary} />}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="gap-4">
          <CardHeader className="flex flex-wrap items-center gap-3">
            <CardTitle className="mr-auto">Movimientos</CardTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Buscar"
                className="h-8 w-44 pl-8"
                aria-label="Buscar movimientos"
              />
            </div>
            <Select
              value={methodId?.toString() ?? 'all'}
              onValueChange={(v) => setMethodId(v === 'all' ? null : Number(v))}
            >
              <SelectTrigger size="sm" className="w-44" aria-label="Filtrar por medio de pago">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los medios</SelectItem>
                {paymentMethods.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    <PaymentMethodIcon method={m} className="size-5 rounded [&_svg]:size-3" />
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCategoryId(null)
                  setMethodId(null)
                  setText('')
                }}
              >
                <X /> Limpiar
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-3">
            {data && data.expenses.length === 0 && data.projected.length === 0 ? (
              <EmptyState
                icon={<Receipt className="size-5" />}
                title="Todavía no cargaste gastos este mes."
                action={
                  <Button onClick={() => openNew(newDefaults)}>
                    <Plus /> Agregar gasto
                  </Button>
                }
              />
            ) : filtered.expenses.length === 0 && filtered.projected.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay movimientos con esos filtros.
              </p>
            ) : (
              <ExpenseList
                expenses={filtered.expenses}
                projected={filtered.projected}
                month={month}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="gap-2">
            <CardHeader>
              <CardTitle>Por categoría</CardTitle>
            </CardHeader>
            <CardContent>
              {data ? (
                <CategoryDonut
                  summary={data.summary}
                  selected={categoryId}
                  onSelect={setCategoryId}
                />
              ) : (
                <Skeleton className="h-52" />
              )}
            </CardContent>
          </Card>
          <IncomesCard month={month} />
        </div>
      </div>
    </Page>
  )
}
