import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ArrowDownLeft, ArrowUpRight, Goal } from 'lucide-react-native'
import { formatMoney } from '@shared/money'
import { formatDateShort } from '@shared/months'
import type { SavingsMovement } from '@shared/types'
import { Money } from '@/components/money'
import { radius, space, useColors } from '@/lib/theme'
import { openMovement } from './open'

export function MovementRow({
  movement: m,
  goalName,
}: {
  movement: SavingsMovement
  goalName: string | undefined
}) {
  const c = useColors()
  const deposit = m.amountMinor > 0
  const usd = m.currency === 'USD'
  const boughtOrSold = usd && m.arsCostCents !== null && m.arsCostCents > 0
  const title = boughtOrSold
    ? deposit
      ? 'Compra de dólares'
      : 'Venta de dólares'
    : `${deposit ? 'Aporte' : 'Retiro'}${usd ? ' en dólares' : ''}`
  const tone = deposit ? c.positive : c.negative
  let detail = formatDateShort(m.date)
  if (m.note) detail += ` · ${title}`
  if (usd && m.arsCostCents !== null && m.rateCentsPerUsd !== null) {
    detail += ` · ${deposit ? 'pagaste' : 'recibiste'} ${formatMoney(m.arsCostCents)} a ${formatMoney(m.rateCentsPerUsd)}`
  }

  return (
    <Pressable
      accessibilityRole="button"
      testID="savings-row"
      onPress={() => openMovement({ movement: m })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.accent }]}
    >
      <View style={[styles.icon, { backgroundColor: `${tone}26` }]}>
        {deposit ? (
          <ArrowDownLeft color={tone} size={16} />
        ) : (
          <ArrowUpRight color={tone} size={16} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: c.foreground }]}>
            {m.note || title}
          </Text>
          {goalName ? (
            <View style={[styles.goal, { backgroundColor: c.muted }]}>
              <Goal color={c.mutedForeground} size={11} />
              <Text numberOfLines={1} style={{ color: c.foreground, fontSize: 11 }}>
                {goalName}
              </Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 12 }}>
          {detail}
        </Text>
      </View>
      <Money
        cents={m.amountMinor}
        currency={m.currency}
        showPlus
        tone={deposit ? 'positive' : 'negative'}
        style={styles.amount}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2.5),
    paddingHorizontal: space(2),
    borderRadius: radius.md,
  },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    flexShrink: 1,
  },
  amount: { fontSize: 15, fontWeight: '700' },
})
