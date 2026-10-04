import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, HandCoins, Trash2, Users } from 'lucide-react'
import { formatDateShort } from '@shared/months'
import type { Group, GroupBalance } from '@shared/types'
import { Money } from '@renderer/components/money'
import { EmptyState, Page, PageHeader } from '@renderer/components/page'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { call } from '@renderer/lib/api'
import { useGroups } from '@renderer/lib/groups'
import { keys, movementKeys, useApiMutation, useApiQuery } from '@renderer/lib/hooks'
import { useUndoToast } from '@renderer/lib/movements'
import { cn } from '@renderer/lib/utils'
import { SettleDialog, type SettleDraft } from './settle-dialog'

export function GruposPage() {
  const { data: groups, isLoading } = useGroups()
  const active = (groups ?? []).filter((g) => !g.archived)
  return (
    <Page>
      <PageHeader
        title="Grupos"
        description="Quién puso cuánto en los gastos compartidos y cómo quedar a mano. Saldar no cambia tus gastos ni tu disponible."
        actions={
          <Button variant="outline" asChild>
            <Link to="/configuracion?tab=grupos">Editar grupos</Link>
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : active.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="Todavía no armaste ningún grupo"
          description="Creá uno en Configuración → Grupos y al cargar un gasto elegí el grupo y quién pagó."
          action={
            <Button asChild>
              <Link to="/configuracion?tab=grupos">Crear un grupo</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          {active.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
        </div>
      )}
    </Page>
  )
}

function GroupCard({ group }: { group: Group }) {
  const { data } = useApiQuery('groups:balance', { groupId: group.id }, keys.groupBalance(group.id))
  const [draft, setDraft] = useState<SettleDraft | null>(null)
  const name = (id: number) => group.members.find((m) => m.id === id)?.name ?? '?'

  return (
    <Card className="gap-5 p-5" data-testid="group-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{group.name}</h2>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.expenseCount} gasto{data.expenseCount === 1 ? '' : 's'} ·{' '}
            <Money cents={data.totalCents} />
            {data.pendingCount > 0 &&
              ` · ${String(data.pendingCount)} pendiente${data.pendingCount === 1 ? '' : 's'}`}
          </span>
        )}
      </div>
      {!data ? (
        <Skeleton className="h-32" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <MembersTable data={data} name={name} />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">Para quedar a mano</h3>
            {data.transfers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {data.totalCents === 0 ? 'Todavía no hay gastos en el grupo.' : 'Están a mano.'}
              </p>
            ) : (
              data.transfers.map((t) => (
                <div
                  key={`${String(t.fromMemberId)}-${String(t.toMemberId)}`}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  data-testid="group-transfer"
                >
                  <span className="font-medium">{name(t.fromMemberId)}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span className="flex-1 font-medium">{name(t.toMemberId)}</span>
                  <Money cents={t.amountCents} className="font-semibold" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({
                        fromMemberId: t.fromMemberId,
                        toMemberId: t.toMemberId,
                        amountCents: t.amountCents,
                      })
                    }
                  >
                    <HandCoins /> Saldar
                  </Button>
                </div>
              ))
            )}
            {data.settlements.length > 0 && <Settlements data={data} name={name} />}
          </div>
        </div>
      )}
      <SettleDialog group={group} draft={draft} onClose={() => setDraft(null)} />
    </Card>
  )
}

function MembersTable({ data, name }: { data: GroupBalance; name: (id: number) => string }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-muted-foreground">
        <tr className="text-left">
          <th className="pb-2 font-medium">Persona</th>
          <th className="pb-2 text-right font-medium">Puso</th>
          <th className="pb-2 text-right font-medium">Le toca</th>
          <th className="pb-2 text-right font-medium">Saldo</th>
        </tr>
      </thead>
      <tbody>
        {data.members.map((m) => (
          <tr key={m.memberId} className="border-t" data-testid="group-member">
            <td className="py-2 font-medium">{name(m.memberId)}</td>
            <td className="py-2 text-right">
              <Money cents={m.paidCents} />
            </td>
            <td className="py-2 text-right">
              <Money cents={m.shareCents} />
            </td>
            <td
              className={cn(
                'py-2 text-right font-semibold',
                m.balanceCents > 0 && 'text-positive',
                m.balanceCents < 0 && 'text-negative',
              )}
              title={m.balanceCents > 0 ? 'Le deben' : m.balanceCents < 0 ? 'Debe' : 'Está a mano'}
            >
              <Money cents={m.balanceCents} showPlus />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Settlements({ data, name }: { data: GroupBalance; name: (id: number) => string }) {
  const undoToast = useUndoToast()
  const remove = useApiMutation('groups:removeSettlement', {
    invalidate: movementKeys,
    onSuccess: (_d, { id }) =>
      undoToast('Pago borrado', () => call('groups:restoreSettlement', { id })),
  })
  return (
    <div className="flex flex-col gap-1">
      <h3 className="mt-2 text-sm font-medium text-muted-foreground">Pagos registrados</h3>
      {data.settlements.map((s) => (
        <div key={s.id} className="group flex items-center gap-2 text-sm" data-testid="settlement">
          <span className="w-14 text-muted-foreground">{formatDateShort(s.date)}</span>
          <span className="flex-1 truncate">
            {name(s.fromMemberId)} le pasó a {name(s.toMemberId)}
            {s.note ? ` · ${s.note}` : ''}
          </span>
          <Money cents={s.amountCents} />
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            aria-label="Borrar pago"
            onClick={() => remove.mutate({ id: s.id })}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
    </div>
  )
}
