import { Check } from 'lucide-react'
import { formatMoney, splitInstallments, sumCents } from '@shared/money'
import type { ExpenseSplit, Group } from '@shared/types'
import { MoneyInput } from '@renderer/components/money-input'
import { FieldError } from '@renderer/components/page'
import { Label } from '@renderer/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { cn } from '@renderer/lib/utils'

/** Personas que se pueden elegir: las activas y las archivadas que ya estaban en el reparto. */
function candidates(group: Group, split: ExpenseSplit) {
  const inSplit = new Set(
    split.kind === 'equal' ? split.memberIds : split.shares.map((s) => s.memberId),
  )
  return group.members.filter((m) => !m.archived || inSplit.has(m.id))
}

/**
 * Cómo se reparte un gasto de grupo: partes iguales entre las personas marcadas, o un monto a mano para
 * cada una (tiene que sumar el total).
 */
export function SplitEditor({
  group,
  amount,
  value,
  onChange,
  error,
}: {
  group: Group
  amount: number | null
  value: ExpenseSplit
  onChange: (split: ExpenseSplit) => void
  error?: string | undefined
}) {
  const people = candidates(group, value)

  const toEqual = () =>
    onChange({
      kind: 'equal',
      memberIds:
        value.kind === 'equal'
          ? value.memberIds
          : value.shares.filter((s) => s.cents > 0).map((s) => s.memberId),
    })
  const toCustom = () => {
    const ids = value.kind === 'equal' ? value.memberIds : people.map((m) => m.id)
    const parts = amount !== null && ids.length > 0 ? splitInstallments(amount, ids.length) : []
    onChange({
      kind: 'custom',
      shares: people.map((m) => {
        const i = ids.indexOf(m.id)
        return { memberId: m.id, cents: i === -1 ? 0 : (parts[i] ?? 0) }
      }),
    })
  }

  let equalAmounts = new Map<number, number>()
  if (value.kind === 'equal' && amount !== null && value.memberIds.length > 0) {
    const ordered = people.filter((m) => value.memberIds.includes(m.id)).map((m) => m.id)
    const parts = splitInstallments(amount, ordered.length)
    equalAmounts = new Map(ordered.map((id, i) => [id, parts[i] ?? 0]))
  }
  const assigned = value.kind === 'custom' ? sumCents(value.shares.map((s) => s.cents)) : 0
  const diff = amount === null ? null : amount - assigned

  const toggle = (id: number) => {
    if (value.kind !== 'equal') return
    const has = value.memberIds.includes(id)
    onChange({
      kind: 'equal',
      memberIds: has ? value.memberIds.filter((x) => x !== id) : [...value.memberIds, id],
    })
  }
  const setShare = (id: number, cents: number | null) => {
    if (value.kind !== 'custom') return
    onChange({
      kind: 'custom',
      shares: people.map((m) => ({
        memberId: m.id,
        cents:
          m.id === id ? (cents ?? 0) : (value.shares.find((s) => s.memberId === m.id)?.cents ?? 0),
      })),
    })
  }

  return (
    <div className="col-span-2 flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="font-normal">Reparto</Label>
        <ToggleGroup
          type="single"
          value={value.kind}
          onValueChange={(v) => {
            if (v === 'equal' && value.kind !== 'equal') toEqual()
            if (v === 'custom' && value.kind !== 'custom') toCustom()
          }}
        >
          <ToggleGroupItem value="equal">Partes iguales</ToggleGroupItem>
          <ToggleGroupItem value="custom" disabled={amount === null}>
            A mano
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="grid gap-1.5">
        {people.map((m) =>
          value.kind === 'equal' ? (
            <button
              key={m.id}
              type="button"
              role="checkbox"
              aria-checked={value.memberIds.includes(m.id)}
              onClick={() => toggle(m.id)}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent/60"
            >
              <span
                className={cn(
                  'flex size-4 items-center justify-center rounded border',
                  value.memberIds.includes(m.id) &&
                    'border-primary bg-primary text-primary-foreground',
                )}
              >
                {value.memberIds.includes(m.id) && <Check className="size-3" />}
              </span>
              <span className="flex-1">{m.name}</span>
              <span className="text-muted-foreground money">
                {equalAmounts.has(m.id) ? formatMoney(equalAmounts.get(m.id) ?? 0) : '—'}
              </span>
            </button>
          ) : (
            <div key={m.id} className="flex items-center gap-2 px-2">
              <span className="flex-1 text-sm">{m.name}</span>
              <MoneyInput
                aria-label={`Parte de ${m.name}`}
                className="h-8 w-36 text-right"
                value={value.shares.find((s) => s.memberId === m.id)?.cents ?? 0}
                onValueChange={(cents) => setShare(m.id, cents)}
              />
            </div>
          ),
        )}
      </div>
      {value.kind === 'custom' && diff !== null && diff !== 0 && (
        <p className="text-xs text-pending">
          {diff > 0
            ? `Faltan asignar ${formatMoney(diff)}`
            : `Te pasaste por ${formatMoney(-diff)}`}
        </p>
      )}
      {value.kind === 'equal' && amount === null && (
        <p className="text-xs text-muted-foreground">
          Se reparte en partes iguales cuando cargues el monto.
        </p>
      )}
      <FieldError message={error} />
    </div>
  )
}
