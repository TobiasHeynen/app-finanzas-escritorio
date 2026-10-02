import { useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Archive, DollarSign, Goal, PiggyBank, Plus, Wallet } from 'lucide-react-native'
import { formatMoney } from '@shared/money'
import { formatDateShort, formatMonthTitle } from '@shared/months'
import type { SavingsMovement, SavingsOverview } from '@shared/types'
import { EmptyState } from '@/components/empty-state'
import { Fab } from '@/components/fab'
import { Money } from '@/components/money'
import { Screen } from '@/components/screen'
import { Button, Card, Muted, SectionTitle } from '@/components/ui'
import { GoalCard } from '@/features/ahorros/goal-card'
import { MovementRow } from '@/features/ahorros/movement-row'
import { openGoal, openMovement } from '@/features/ahorros/open'
import { keys, useApiQuery } from '@/lib/hooks'
import { radius, space, useColors } from '@/lib/theme'

export default function AhorrosScreen() {
  const c = useColors()
  const { data, isLoading } = useApiQuery('savings:overview', {}, keys.savings)

  return (
    <Screen
      title="Ahorros"
      bottomSpace
      right={
        <Button
          size="sm"
          variant="outline"
          label="Nueva meta"
          icon={<Goal color={c.foreground} size={16} />}
          onPress={() => openGoal(null)}
        />
      }
      overlay={<Fab label="Movimiento" onPress={() => openMovement({ movement: null })} />}
    >
      {isLoading || !data ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: space(8) }} />
      ) : (
        <>
          <Balances data={data} />
          <Goals data={data} />
          <History data={data} />
        </>
      )}
    </Screen>
  )
}

function Balances({ data }: { data: SavingsOverview }) {
  const c = useColors()
  const total = data.usdInArsCents !== null ? data.balances.ARS + data.usdInArsCents : null
  return (
    <View style={{ gap: space(3) }}>
      <View style={styles.tiles}>
        <Tile
          label="En pesos"
          icon={<Wallet color={c.primary} size={16} />}
          tone={c.primary}
          testID="savings-ars"
          onAdd={() => openMovement({ movement: null, defaults: { currency: 'ARS' } })}
        >
          <Money cents={data.balances.ARS} style={styles.tileAmount} />
        </Tile>
        <Tile
          label="En dólares"
          icon={<DollarSign color={c.positive} size={16} />}
          tone={c.positive}
          testID="savings-usd"
          onAdd={() => openMovement({ movement: null, defaults: { currency: 'USD' } })}
        >
          <Money cents={data.balances.USD} currency="USD" style={styles.tileAmount} />
        </Tile>
      </View>
      <Card style={{ gap: space(1) }}>
        <View style={styles.between}>
          <Muted>Total aproximado en pesos</Muted>
          <PiggyBank color={c.mutedForeground} size={16} />
        </View>
        {total !== null ? (
          <Money cents={total} decimals="never" style={styles.tileAmount} />
        ) : (
          <Text style={[styles.tileAmount, { color: c.mutedForeground }]}>—</Text>
        )}
        <Muted style={{ fontSize: 12 }}>
          {data.lastRate
            ? `Última cotización ${formatMoney(data.lastRate.rateCentsPerUsd)} (${formatDateShort(data.lastRate.date)})`
            : 'Cargá una compra de dólares con pesos para tener cotización.'}
        </Muted>
      </Card>
    </View>
  )
}

function Tile({
  label,
  icon,
  tone,
  onAdd,
  testID,
  children,
}: {
  label: string
  icon: ReactNode
  tone: string
  onAdd: () => void
  testID: string
  children: ReactNode
}) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={`Cargar un movimiento ${label.toLowerCase()}`}
      testID={testID}
      onPress={onAdd}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: c.card, borderColor: c.border },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={styles.between}>
        <Muted>{label}</Muted>
        <View style={[styles.tileIcon, { backgroundColor: `${tone}26` }]}>{icon}</View>
      </View>
      {children}
      <View style={styles.inline}>
        <Plus color={c.mutedForeground} size={12} />
        <Muted style={{ fontSize: 12 }}>Cargar</Muted>
      </View>
    </Pressable>
  )
}

function Goals({ data }: { data: SavingsOverview }) {
  const c = useColors()
  const [showArchived, setShowArchived] = useState(false)
  const active = data.goals.filter((g) => !g.archived)
  const archived = data.goals.filter((g) => g.archived)
  return (
    <View style={{ gap: space(3) }}>
      <SectionTitle>Metas</SectionTitle>
      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Goal color={c.mutedForeground} size={22} />}
            title="Todavía no tenés metas"
            description="Creá una con un objetivo y, si querés, una fecha: te decimos cuánto ahorrar por mes."
            action={<Button label="Nueva meta" variant="outline" onPress={() => openGoal(null)} />}
          />
        </Card>
      ) : (
        active.map((g) => <GoalCard key={g.id} goal={g} />)
      )}
      {archived.length > 0 ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            label={`${showArchived ? 'Ocultar' : 'Ver'} archivadas (${String(archived.length)})`}
            icon={<Archive color={c.mutedForeground} size={16} />}
            style={{ alignSelf: 'flex-start' }}
            onPress={() => setShowArchived((v) => !v)}
          />
          {showArchived ? archived.map((g) => <GoalCard key={g.id} goal={g} />) : null}
        </>
      ) : null}
    </View>
  )
}

function History({ data }: { data: SavingsOverview }) {
  const c = useColors()
  const goalNames = new Map(data.goals.map((g) => [g.id, g.name]))
  const byMonth = new Map<string, SavingsMovement[]>()
  for (const m of data.movements) {
    const list = byMonth.get(m.month) ?? []
    list.push(m)
    byMonth.set(m.month, list)
  }
  return (
    <View style={{ gap: space(3) }}>
      <SectionTitle>Historial</SectionTitle>
      {data.movements.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PiggyBank color={c.mutedForeground} size={22} />}
            title="Todavía no cargaste movimientos de ahorro"
            action={
              <Button label="Cargar aporte" onPress={() => openMovement({ movement: null })} />
            }
          />
        </Card>
      ) : (
        <Card style={{ gap: space(4), paddingHorizontal: space(2) }}>
          {[...byMonth].map(([month, items]) => (
            <View key={month} style={{ gap: space(1) }}>
              <Text style={[styles.month, { color: c.mutedForeground }]}>
                {formatMonthTitle(month)}
              </Text>
              {items.map((m) => (
                <MovementRow
                  key={m.id}
                  movement={m}
                  goalName={m.goalId !== null ? goalNames.get(m.goalId) : undefined}
                />
              ))}
            </View>
          ))}
        </Card>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', gap: space(3) },
  tile: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space(4),
    gap: space(2),
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileAmount: { fontSize: 22, fontWeight: '700' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  month: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: space(2),
  },
})
