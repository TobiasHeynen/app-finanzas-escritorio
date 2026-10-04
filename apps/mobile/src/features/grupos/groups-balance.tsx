import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { ArrowRight, HandCoins, Pencil, Plus, Trash2, Users } from 'lucide-react-native'
import { formatMoney } from '@shared/money'
import { formatDateShort } from '@shared/months'
import type { Group, GroupBalance } from '@shared/types'
import { EmptyState } from '@/components/empty-state'
import { Money } from '@/components/money'
import { Screen } from '@/components/screen'
import { Button, Card, Muted, Separator } from '@/components/ui'
import { openGroup } from '@/features/configuracion/groups-list'
import { call } from '@/lib/api'
import { useGroups } from '@/lib/groups'
import { keys, movementKeys, useApiMutation, useApiQuery } from '@/lib/hooks'
import { useUndoToast } from '@/lib/movements'
import { radius, space, useColors } from '@/lib/theme'
import { openSettle } from './open'

/** Quién puso cuánto en cada grupo y cómo quedar a mano (la pantalla "Grupos" de la PC). */
export function GroupsBalance() {
  const c = useColors()
  const { data: groups } = useGroups()
  const active = (groups ?? []).filter((g) => !g.archived)

  return (
    <Screen
      back
      title="Grupos"
      right={
        active.length > 0 ? (
          <Button
            label="Editar"
            size="sm"
            variant="outline"
            icon={<Pencil color={c.foreground} size={16} />}
            onPress={() => {
              router.push('/config/grupos')
            }}
          />
        ) : null
      }
    >
      <Muted>
        Quién puso cuánto en los gastos compartidos y cómo quedar a mano. Saldar no cambia tus
        gastos ni tu disponible.
      </Muted>
      {groups === undefined ? null : active.length === 0 ? (
        <>
          <EmptyState
            icon={<Users color={c.mutedForeground} size={32} />}
            title="Todavía no armaste ningún grupo"
            description="Creá uno y al cargar un gasto elegí el grupo y quién pagó. Las personas son sólo nombres: no necesitan cuenta ni mail."
          />
          <Button
            label="Crear un grupo"
            icon={<Plus color={c.primaryForeground} size={18} />}
            onPress={() => {
              openGroup(null)
            }}
          />
          {groups.length > 0 ? (
            <Button
              label="Ver grupos archivados"
              variant="ghost"
              onPress={() => {
                router.push('/config/grupos')
              }}
            />
          ) : null}
        </>
      ) : (
        active.map((g) => <GroupCard key={g.id} group={g} />)
      )}
    </Screen>
  )
}

function GroupCard({ group }: { group: Group }) {
  const c = useColors()
  const { data } = useApiQuery('groups:balance', { groupId: group.id }, keys.groupBalance(group.id))
  const name = (id: number) => group.members.find((m) => m.id === id)?.name ?? '?'

  return (
    <Card>
      <View testID="group-card" style={{ gap: space(3) }}>
        <View style={{ gap: space(1) }}>
          <Text style={[styles.title, { color: c.foreground }]}>{group.name}</Text>
          {data ? (
            <Muted style={{ fontSize: 13 }}>
              {`${String(data.expenseCount)} gasto${data.expenseCount === 1 ? '' : 's'} · ${formatMoney(data.totalCents)}`}
              {data.pendingCount > 0
                ? ` · ${String(data.pendingCount)} pendiente${data.pendingCount === 1 ? '' : 's'}`
                : ''}
            </Muted>
          ) : null}
        </View>
        {data ? (
          <>
            <Members data={data} name={name} />
            <Separator />
            <Text style={[styles.subtitle, { color: c.mutedForeground }]}>Para quedar a mano</Text>
            {data.transfers.length === 0 ? (
              <Muted>
                {data.totalCents === 0 ? 'Todavía no hay gastos en el grupo.' : 'Están a mano.'}
              </Muted>
            ) : (
              data.transfers.map((t) => (
                <View
                  key={`${String(t.fromMemberId)}-${String(t.toMemberId)}`}
                  testID="group-transfer"
                  style={[styles.transfer, { borderColor: c.border }]}
                >
                  <View style={styles.transferText}>
                    <Text style={[styles.strong, { color: c.foreground }]}>
                      {name(t.fromMemberId)}
                    </Text>
                    <ArrowRight color={c.mutedForeground} size={16} />
                    <Text style={[styles.strong, { color: c.foreground, flexShrink: 1 }]}>
                      {name(t.toMemberId)}
                    </Text>
                  </View>
                  <Money cents={t.amountCents} style={styles.strong} />
                  <Button
                    label="Saldar"
                    size="sm"
                    variant="outline"
                    icon={<HandCoins color={c.foreground} size={16} />}
                    onPress={() => {
                      openSettle({
                        group,
                        fromMemberId: t.fromMemberId,
                        toMemberId: t.toMemberId,
                        amountCents: t.amountCents,
                      })
                    }}
                  />
                </View>
              ))
            )}
            {data.settlements.length > 0 ? <Settlements data={data} name={name} /> : null}
          </>
        ) : null}
      </View>
    </Card>
  )
}

function Members({ data, name }: { data: GroupBalance; name: (id: number) => string }) {
  const c = useColors()
  return (
    <View style={{ gap: space(2) }}>
      <View style={styles.row}>
        <Text style={[styles.cellName, styles.head, { color: c.mutedForeground }]}>Persona</Text>
        <Text style={[styles.cell, styles.head, { color: c.mutedForeground }]}>Puso</Text>
        <Text style={[styles.cell, styles.head, { color: c.mutedForeground }]}>Le toca</Text>
        <Text style={[styles.cell, styles.head, { color: c.mutedForeground }]}>Saldo</Text>
      </View>
      {data.members.map((m) => (
        <View key={m.memberId} testID="group-member" style={styles.row}>
          <Text style={[styles.cellName, { color: c.foreground }]} numberOfLines={1}>
            {name(m.memberId)}
          </Text>
          <Money cents={m.paidCents} decimals="never" style={styles.cell} />
          <Money cents={m.shareCents} decimals="never" style={styles.cell} />
          <Money
            cents={m.balanceCents}
            decimals="never"
            showPlus
            tone={m.balanceCents > 0 ? 'positive' : m.balanceCents < 0 ? 'negative' : 'muted'}
            style={[styles.cell, styles.strong]}
          />
        </View>
      ))}
    </View>
  )
}

function Settlements({ data, name }: { data: GroupBalance; name: (id: number) => string }) {
  const c = useColors()
  const undoToast = useUndoToast()
  const remove = useApiMutation('groups:removeSettlement', {
    invalidate: movementKeys,
    onSuccess: (_d, { id }) => {
      undoToast('Pago borrado', () => call('groups:restoreSettlement', { id }))
    },
  })
  return (
    <View style={{ gap: space(1) }}>
      <Text style={[styles.subtitle, { color: c.mutedForeground, marginTop: space(2) }]}>
        Pagos registrados
      </Text>
      {data.settlements.map((s) => (
        <View key={s.id} testID="settlement" style={styles.settlement}>
          <Text style={{ color: c.mutedForeground, fontSize: 13, fontVariant: ['tabular-nums'] }}>
            {formatDateShort(s.date)}
          </Text>
          <Text style={{ color: c.foreground, flex: 1, fontSize: 14 }} numberOfLines={2}>
            {`${name(s.fromMemberId)} le pasó a ${name(s.toMemberId)}`}
            {s.note ? ` · ${s.note}` : ''}
          </Text>
          <Money cents={s.amountCents} style={{ fontSize: 14 }} />
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 color={c.mutedForeground} size={16} />}
            accessibilityLabel="Borrar pago"
            onPress={() => {
              remove.mutate({ id: s.id })
            }}
          />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, fontWeight: '600' },
  strong: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  head: { fontSize: 12, fontWeight: '600' },
  cellName: { flex: 1.2, fontSize: 15 },
  cell: { flex: 1, textAlign: 'right', fontSize: 14 },
  transfer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderRadius: radius.md,
    paddingLeft: space(3),
    paddingRight: space(1),
    paddingVertical: space(1),
  },
  transferText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  settlement: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
})
