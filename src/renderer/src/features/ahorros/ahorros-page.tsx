import { useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ArrowUpRight,
  CircleCheck,
  DollarSign,
  Goal,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import { formatMoney } from '@shared/money'
import { formatDateShort, formatMonthLong, formatMonthTitle, monthOf } from '@shared/months'
import type { GoalProgress, SavingsGoal, SavingsMovement, SavingsOverview } from '@shared/types'
import { Money } from '@renderer/components/money'
import { EmptyState, Page, PageHeader } from '@renderer/components/page'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Progress } from '@renderer/components/ui/progress'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { call } from '@renderer/lib/api'
import { keys, movementKeys, useApiMutation, useApiQuery } from '@renderer/lib/hooks'
import { useUndoToast } from '@renderer/lib/movements'
import { cn } from '@renderer/lib/utils'
import { GoalDialog } from './goal-dialog'
import { MovementDialog, type MovementDefaults } from './movement-dialog'

export function AhorrosPage() {
  const { data, isLoading } = useApiQuery('savings:overview', {}, keys.savings)
  const [movementDialog, setMovementDialog] = useState<{
    open: boolean
    movement: SavingsMovement | null
    defaults?: MovementDefaults
  }>({ open: false, movement: null })
  const [goalDialog, setGoalDialog] = useState<{ open: boolean; goal: SavingsGoal | null }>({
    open: false,
    goal: null,
  })

  const openMovement = (movement: SavingsMovement | null, defaults?: MovementDefaults) =>
    setMovementDialog({ open: true, movement, ...(defaults && { defaults }) })

  return (
    <Page>
      <PageHeader
        title="Ahorros"
        description="Tu ahorro en pesos y en dólares, y cómo vas con tus metas."
        actions={
          <>
            <Button variant="outline" onClick={() => setGoalDialog({ open: true, goal: null })}>
              <Goal /> Nueva meta
            </Button>
            <Button onClick={() => openMovement(null)}>
              <Plus /> Movimiento
            </Button>
          </>
        }
      />

      {isLoading || !data ? (
        <Skeleton className="h-32" />
      ) : (
        <>
          <Balances data={data} onAdd={(currency) => openMovement(null, { currency })} />
          <Goals
            goals={data.goals}
            onEdit={(goal) => setGoalDialog({ open: true, goal })}
            onCreate={() => setGoalDialog({ open: true, goal: null })}
            onContribute={(g) => openMovement(null, { currency: g.currency, goalId: g.id })}
          />
          <History data={data} onEdit={(m) => openMovement(m)} onAdd={() => openMovement(null)} />
        </>
      )}

      <MovementDialog
        open={movementDialog.open}
        onOpenChange={(open) => setMovementDialog((s) => ({ ...s, open }))}
        movement={movementDialog.movement}
        defaults={movementDialog.defaults}
        goals={data?.goals ?? []}
      />
      <GoalDialog
        open={goalDialog.open}
        onOpenChange={(open) => setGoalDialog((s) => ({ ...s, open }))}
        goal={goalDialog.goal}
      />
    </Page>
  )
}

function Balances({
  data,
  onAdd,
}: {
  data: SavingsOverview
  onAdd: (currency: 'ARS' | 'USD') => void
}) {
  const total = data.usdInArsCents !== null ? data.balances.ARS + data.usdInArsCents : null
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <BalanceTile
        label="En pesos"
        icon={Wallet}
        tone="bg-primary/15 text-primary"
        onAdd={() => onAdd('ARS')}
      >
        <Money cents={data.balances.ARS} />
      </BalanceTile>
      <BalanceTile
        label="En dólares"
        icon={DollarSign}
        tone="bg-positive/15 text-positive"
        onAdd={() => onAdd('USD')}
        hint={
          data.lastRate
            ? `Última cotización ${formatMoney(data.lastRate.rateCentsPerUsd)} (${formatDateShort(data.lastRate.date)})`
            : 'Cargá una compra con pesos para tener cotización.'
        }
      >
        <Money cents={data.balances.USD} currency="USD" />
      </BalanceTile>
      <BalanceTile
        label="Total aproximado en pesos"
        icon={PiggyBank}
        tone="bg-muted text-muted-foreground"
        hint={
          data.usdInArsCents !== null ? (
            <>
              Los dólares equivalen a <Money cents={data.usdInArsCents} decimals="never" />
            </>
          ) : (
            'Sin cotización no se puede convertir.'
          )
        }
      >
        {total !== null ? (
          <Money cents={total} decimals="never" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </BalanceTile>
    </div>
  )
}

function BalanceTile({
  label,
  icon: Icon,
  tone,
  hint,
  onAdd,
  children,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  tone: string
  hint?: React.ReactNode
  onAdd?: () => void
  children: React.ReactNode
}) {
  return (
    <Card className="group gap-3 px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn('flex size-8 items-center justify-center rounded-full', tone)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="text-2xl font-semibold tracking-tight">{children}</div>
      <div className="flex min-h-5 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{hint}</span>
        {onAdd && (
          <Button
            variant="ghost"
            size="sm"
            className="-my-1 h-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={onAdd}
          >
            <Plus /> Cargar
          </Button>
        )}
      </div>
    </Card>
  )
}

function Goals({
  goals,
  onEdit,
  onCreate,
  onContribute,
}: {
  goals: GoalProgress[]
  onEdit: (g: SavingsGoal) => void
  onCreate: () => void
  onContribute: (g: SavingsGoal) => void
}) {
  const active = goals.filter((g) => !g.archived)
  const archived = goals.filter((g) => g.archived)
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Metas</h2>
      {active.length === 0 ? (
        <EmptyState
          icon={<Goal className="size-5" />}
          title="Todavía no tenés metas."
          description="Creá una con un objetivo y, si querés, una fecha: te decimos cuánto ahorrar por mes."
          action={
            <Button variant="outline" onClick={onCreate}>
              <Plus /> Nueva meta
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={onEdit} onContribute={onContribute} />
          ))}
        </div>
      )}
      {archived.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Archive /> Archivadas ({archived.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {archived.map((g) => (
              <GoalCard key={g.id} goal={g} onEdit={onEdit} onContribute={onContribute} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}

function GoalCard({
  goal,
  onEdit,
  onContribute,
}: {
  goal: GoalProgress
  onEdit: (g: SavingsGoal) => void
  onContribute: (g: SavingsGoal) => void
}) {
  const archive = useApiMutation('savings:archiveGoal', {
    invalidate: [keys.savings],
    success: (_d, input) => (input.archived ? 'Meta archivada' : 'Meta restaurada'),
  })
  const pct = Math.min(100, Math.max(0, (goal.savedMinor / goal.targetMinor) * 100))
  const done = goal.remainingMinor === 0
  return (
    <Card className={cn('gap-4 px-5 py-4', goal.archived && 'opacity-70')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{goal.name}</span>
          <span className="text-xs text-muted-foreground">
            {goal.targetDate
              ? `Para ${formatMonthLong(monthOf(goal.targetDate))}`
              : 'Sin fecha objetivo'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {done && (
            <Badge className="bg-positive/15 text-positive">
              <CircleCheck /> Cumplida
            </Badge>
          )}
          {goal.overdue && <Badge variant="pending">Vencida</Badge>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Acciones">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!goal.archived && (
                <DropdownMenuItem onSelect={() => onContribute(goal)}>
                  <Plus /> Aportar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => onEdit(goal)}>
                <Pencil /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => archive.mutate({ id: goal.id, archived: !goal.archived })}
              >
                {goal.archived ? (
                  <>
                    <ArchiveRestore /> Restaurar
                  </>
                ) : (
                  <>
                    <Archive /> Archivar
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Money
            cents={goal.savedMinor}
            currency={goal.currency}
            className="text-xl font-semibold"
          />
          <span className="text-sm text-muted-foreground">
            de <Money cents={goal.targetMinor} currency={goal.currency} decimals="never" />
          </span>
        </div>
        <Progress
          value={pct}
          aria-label={`${String(Math.floor(pct))}% de la meta`}
          indicatorClassName={done ? 'bg-positive' : undefined}
        />
        <p className="text-xs text-muted-foreground">
          {done ? (
            '¡Llegaste al objetivo!'
          ) : goal.perMonthMinor !== null ? (
            <>
              Faltan <Money cents={goal.remainingMinor} currency={goal.currency} />: ahorrá{' '}
              <Money
                cents={goal.perMonthMinor}
                currency={goal.currency}
                className="font-medium text-foreground"
              />{' '}
              {goal.monthsLeft === 1
                ? 'este mes.'
                : `por mes durante ${String(goal.monthsLeft)} meses.`}
            </>
          ) : (
            <>
              Faltan <Money cents={goal.remainingMinor} currency={goal.currency} />
              {goal.overdue && '. La fecha ya pasó: editala si querés un nuevo plan.'}
            </>
          )}
        </p>
      </div>
    </Card>
  )
}

function History({
  data,
  onEdit,
  onAdd,
}: {
  data: SavingsOverview
  onEdit: (m: SavingsMovement) => void
  onAdd: () => void
}) {
  const goalNames = new Map(data.goals.map((g) => [g.id, g.name]))
  const byMonth = new Map<string, SavingsMovement[]>()
  for (const m of data.movements) {
    const list = byMonth.get(m.month) ?? []
    list.push(m)
    byMonth.set(m.month, list)
  }
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Historial</CardTitle>
      </CardHeader>
      <CardContent className="px-3">
        {data.movements.length === 0 ? (
          <EmptyState
            icon={<PiggyBank className="size-5" />}
            title="Todavía no cargaste movimientos de ahorro."
            action={
              <Button onClick={onAdd}>
                <Plus /> Cargar aporte
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            {[...byMonth].map(([month, items]) => (
              <section key={month} className="flex flex-col gap-1">
                <h3 className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {formatMonthTitle(month)}
                </h3>
                {items.map((m) => (
                  <MovementRow
                    key={m.id}
                    movement={m}
                    goalName={m.goalId !== null ? goalNames.get(m.goalId) : undefined}
                    onEdit={onEdit}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MovementRow({
  movement: m,
  goalName,
  onEdit,
}: {
  movement: SavingsMovement
  goalName: string | undefined
  onEdit: (m: SavingsMovement) => void
}) {
  const undoToast = useUndoToast()
  const remove = useApiMutation('savings:removeMovement', {
    invalidate: movementKeys,
    onSuccess: (_d, { id }) =>
      undoToast('Movimiento borrado', () => call('savings:restoreMovement', { id })),
  })
  const deposit = m.amountMinor > 0
  const usd = m.currency === 'USD'
  const boughtOrSold = usd && m.arsCostCents !== null && m.arsCostCents > 0
  const title = boughtOrSold
    ? deposit
      ? 'Compra de dólares'
      : 'Venta de dólares'
    : `${deposit ? 'Aporte' : 'Retiro'}${usd ? ' en dólares' : ''}`
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60">
      <button
        type="button"
        onClick={() => onEdit(m)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            deposit ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative',
          )}
        >
          {deposit ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-2 truncate text-sm font-medium">
            {m.note || title}
            {goalName && (
              <Badge variant="secondary" className="font-normal">
                <Goal /> {goalName}
              </Badge>
            )}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {formatDateShort(m.date)}
            {m.note && ` · ${title}`}
            {usd && m.arsCostCents !== null && m.rateCentsPerUsd !== null && (
              <>
                {' · '}
                {deposit ? 'pagaste' : 'recibiste'} {formatMoney(m.arsCostCents)} a{' '}
                {formatMoney(m.rateCentsPerUsd)}
              </>
            )}
          </span>
        </span>
      </button>
      <Money
        cents={m.amountMinor}
        currency={m.currency}
        showPlus
        signColor
        className="font-semibold"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            aria-label="Acciones"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(m)}>
            <Pencil /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => remove.mutate({ id: m.id })}>
            <Trash2 /> Borrar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
