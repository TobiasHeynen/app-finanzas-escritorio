import { ArrowDownRight, ArrowUpRight, CircleDashed, PiggyBank, Wallet } from 'lucide-react'
import { formatMoney } from '@shared/money'
import type { MonthSummary } from '@shared/types'
import { Money } from '@renderer/components/money'
import { Card } from '@renderer/components/ui/card'
import { cn } from '@renderer/lib/utils'

function Tile({
  label,
  icon: Icon,
  children,
  tone,
  hint,
  testId,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  tone: 'positive' | 'negative' | 'neutral' | 'pending' | 'primary'
  hint?: React.ReactNode
  testId?: string
}) {
  const toneClass = {
    positive: 'bg-positive/15 text-positive',
    negative: 'bg-negative/15 text-negative',
    neutral: 'bg-muted text-muted-foreground',
    pending: 'bg-pending/15 text-pending',
    primary: 'bg-primary/15 text-primary',
  }[tone]
  return (
    <Card className="gap-3 px-5 py-4 transition-shadow hover:shadow-md" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn('flex size-8 items-center justify-center rounded-full', toneClass)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="text-2xl font-semibold tracking-tight">{children}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  )
}

/** Montos largos ("$ 1.028.562,33") con una fuente un poco más chica para que entren en la tarjeta. */
const fit = (cents: number) => (formatMoney(cents).length > 12 ? 'text-xl' : undefined)

export function SummaryCards({ summary }: { summary: MonthSummary }) {
  const available = summary.availableCents
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <Tile label="Ingresos" icon={ArrowUpRight} tone="positive" testId="tile-ingresos">
        <Money cents={summary.incomeCents} className={fit(summary.incomeCents)} />
      </Tile>
      <Tile
        label="Gastado"
        icon={ArrowDownRight}
        tone="negative"
        testId="tile-gastado"
        hint={
          summary.projectedCount > 0 ? `Incluye ${summary.projectedCount} proyectados` : undefined
        }
      >
        <Money cents={summary.spentCents} className={fit(summary.spentCents)} />
      </Tile>
      <Tile label="Ahorrado" icon={PiggyBank} tone="primary" testId="tile-ahorrado">
        <Money cents={summary.savedCents} className={fit(summary.savedCents)} />
      </Tile>
      <Tile
        label="Disponible"
        icon={Wallet}
        tone={available >= 0 ? 'positive' : 'negative'}
        testId="tile-disponible"
        hint="Queda para el mes"
      >
        <Money
          cents={available}

          className={cn(available >= 0 ? 'text-positive' : 'text-negative', fit(available))}
        />
      </Tile>
      <Tile
        label="Pendientes"
        icon={CircleDashed}
        tone={summary.pendingCount > 0 ? 'pending' : 'neutral'}
        testId="tile-pendientes"
        hint={summary.pendingCount > 0 ? 'Gastos sin monto' : 'Nada pendiente'}
      >
        <span className={cn('tabular-nums', summary.pendingCount > 0 && 'text-pending')}>
          {summary.pendingCount}
        </span>
      </Tile>
    </div>
  )
}
