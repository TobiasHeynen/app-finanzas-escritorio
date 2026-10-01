import { CalendarClock, CreditCard, Info, Settings } from 'lucide-react'
import { Link } from 'react-router'
import { formatDateShort, formatMonthLong, formatMonthShort } from '@shared/months'
import type { CardOverview, PaymentMethod, PlanProgress } from '@shared/types'
import { CategoryIcon } from '@renderer/components/category-icon'
import { Money } from '@renderer/components/money'
import { EmptyState, Page, PageHeader } from '@renderer/components/page'
import { PaymentMethodIcon } from '@renderer/components/payment-method-icon'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@renderer/components/ui/card'
import { Progress } from '@renderer/components/ui/progress'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useCatalog } from '@renderer/lib/catalog'
import { keys, useApiQuery } from '@renderer/lib/hooks'
import { useExpenseDialog } from '@renderer/features/gastos/expense-dialog-provider'
import { CommittedChart } from './committed-chart'

export function TarjetasPage() {
  const { data, isLoading } = useApiQuery('cards:overview', {}, keys.cards)
  const { paymentMethodById } = useCatalog()

  const cards = (data?.cards ?? []).flatMap((c) => {
    const method = paymentMethodById.get(c.paymentMethodId)
    return method ? [{ overview: c, method }] : []
  })

  return (
    <Page>
      <PageHeader
        title="Tarjetas"
        description="Lo que vence este mes, el resumen que está abierto y las cuotas que quedan."
      />

      <div className="flex items-start gap-3 rounded-lg border border-pending/30 bg-pending/10 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-pending" />
        <p>
          Los resúmenes suelen vencer los primeros días del mes:{' '}
          <strong className="font-medium">pagalos antes del 5</strong> para no pagar intereses.
        </p>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="size-5" />}
          title="No tenés tarjetas de crédito cargadas."
          description="Agregalas en Configuración → Medios de pago con su día de cierre."
          action={
            <Button asChild variant="outline">
              <Link to="/configuracion?tab=medios">
                <Settings /> Ir a Configuración
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {cards.map(({ overview, method }) => (
              <CardPanel key={method.id} overview={overview} method={method} />
            ))}
          </div>

          <Card className="gap-4">
            <CardHeader className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <CardTitle>Comprometido a futuro</CardTitle>
                <CardDescription>
                  Cuotas y gastos ya cargados de los próximos 12 meses (sin contar este).
                </CardDescription>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Total</span>
                <Money cents={data.committedTotalCents} className="block text-xl font-semibold" />
              </div>
            </CardHeader>
            <CardContent>
              {data.committedTotalCents === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay nada comprometido para los próximos meses.
                </p>
              ) : (
                <CommittedChart overview={data} methods={cards.map((c) => c.method)} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Page>
  )
}

function CardPanel({ overview, method }: { overview: CardOverview; method: PaymentMethod }) {
  const { dueThisMonth: due, openStatement: open } = overview
  return (
    <Card className="gap-5" data-testid={`card-${String(method.id)}`}>
      <CardHeader className="flex items-center gap-3">
        <PaymentMethodIcon method={method} />
        <div className="flex flex-col">
          <CardTitle>{method.name}</CardTitle>
          <CardDescription>
            Cierra el {method.closingDay ?? '—'}
            {method.dueDay !== null && ` · vence el ${String(method.dueDay)}`}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg bg-muted/60 px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Vence en {formatMonthLong(due.month)}
            </span>
            <Money cents={due.totalCents} className="text-xl font-semibold" />
            <span className="text-xs text-muted-foreground">
              {due.dueDate ? `Antes del ${formatDateShort(due.dueDate)}` : 'Pagá antes del 5'}
              {due.pendingCount > 0 && (
                <Badge variant="pending" className="ml-1.5">
                  {due.pendingCount} {due.pendingCount === 1 ? 'pendiente' : 'pendientes'}
                </Badge>
              )}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border px-4 py-3">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="size-3.5" /> Resumen abierto
            </span>
            <Money cents={open.totalCents} className="text-xl font-semibold" />
            <span className="text-xs text-muted-foreground">
              Cierra el {formatDateShort(open.closingDate)} · se paga en{' '}
              {formatMonthShort(open.chargeMonth)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium">Cuotas activas</h3>
            {overview.committedCents > 0 && (
              <span className="text-xs text-muted-foreground">
                Comprometido: <Money cents={overview.committedCents} />
              </span>
            )}
          </div>
          {overview.plans.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Sin cuotas activas.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {overview.plans.map((p) => (
                <PlanRow key={p.planId} plan={p} />
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function PlanRow({ plan }: { plan: PlanProgress }) {
  const { openPlan } = useExpenseDialog()
  const { subcategoryById } = useCatalog()
  const sub = subcategoryById.get(plan.subcategoryId)
  const pct = (plan.paidCount / plan.installmentsCount) * 100
  const color = sub?.category.color ?? '#64748b'
  return (
    <li>
      <button
        type="button"
        onClick={() => openPlan(plan.planId)}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CategoryIcon icon={sub?.category.icon ?? 'tag'} color={color} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm">{plan.description}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {plan.paidCount} de {plan.installmentsCount}
            </span>
          </div>
          <Progress
            value={pct}
            className="h-1.5"
            indicatorStyle={{ backgroundColor: color }}
            aria-label={`${String(plan.paidCount)} de ${String(plan.installmentsCount)} cuotas`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Cuota <Money cents={plan.nextAmountCents} />
            </span>
            <span>
              Faltan <Money cents={plan.remainingCents} /> · hasta{' '}
              {formatMonthShort(plan.lastMonth)}
            </span>
          </div>
        </div>
      </button>
    </li>
  )
}
