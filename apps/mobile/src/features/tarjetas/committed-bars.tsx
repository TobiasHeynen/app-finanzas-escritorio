import { StyleSheet, Text, View } from 'react-native'
import { formatMonthShort } from '@shared/months'
import type { CardsOverview, PaymentMethod } from '@shared/types'
import { Money } from '@/components/money'
import { space, useColors } from '@/lib/theme'

/** Una fila por mes con una barra apilada por tarjeta (en la PC es un gráfico de barras). */
export function CommittedBars({
  overview,
  methods,
}: {
  overview: CardsOverview
  methods: PaymentMethod[]
}) {
  const c = useColors()
  const months = overview.committedByMonth.filter((m) => m.totalCents > 0)
  const max = Math.max(1, ...months.map((m) => m.totalCents))
  const colorOf = new Map(methods.map((m) => [m.id, m.color ?? c.mutedForeground]))

  return (
    <View style={{ gap: space(3) }}>
      <View style={styles.legend}>
        {methods.map((m) => (
          <View key={m.id} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: colorOf.get(m.id) }]} />
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>{m.name}</Text>
          </View>
        ))}
      </View>
      {months.map((m) => (
        <View key={m.month} style={styles.row} testID="committed-month">
          <Text style={[styles.month, { color: c.mutedForeground }]}>
            {formatMonthShort(m.month)}
          </Text>
          <View style={styles.track}>
            <View
              style={[styles.bar, { flex: m.totalCents }]}
              accessibilityLabel={formatMonthShort(m.month)}
            >
              {m.byCard
                .filter((b) => b.totalCents > 0)
                .map((b) => (
                  <View
                    key={b.paymentMethodId}
                    style={{
                      flex: b.totalCents,
                      backgroundColor: colorOf.get(b.paymentMethodId) ?? c.mutedForeground,
                    }}
                  />
                ))}
            </View>
            <View style={{ flex: max - m.totalCents }} />
          </View>
          <Money cents={m.totalCents} decimals="never" style={styles.amount} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  month: { width: 64, fontSize: 12, textTransform: 'capitalize' },
  track: { flex: 1, flexDirection: 'row' },
  bar: { flexDirection: 'row', height: 14, borderRadius: 4, overflow: 'hidden', minWidth: 2 },
  amount: { width: 96, textAlign: 'right', fontSize: 13, fontWeight: '600' },
})
