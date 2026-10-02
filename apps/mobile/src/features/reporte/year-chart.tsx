import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatMonthAbbr, formatMonthTitle } from '@shared/months'
import type { YearReport } from '@shared/types'
import { Money } from '@/components/money'
import { useCatalog } from '@/lib/catalog'
import { space, useColors } from '@/lib/theme'

const HEIGHT = 160

/**
 * Barras apiladas de gasto por categoría, una por mes, con una marca para los ingresos. Tocar un mes
 * muestra sus números. Los meses proyectados (futuros) van más claros.
 */
export function YearChart({ report }: { report: YearReport }) {
  const c = useColors()
  const { categoryById } = useCatalog()
  const [selected, setSelected] = useState<number | null>(null)
  const max = Math.max(1, ...report.spent.byMonth, ...report.income.byMonth)

  const pick = selected ?? null
  const month = pick !== null ? report.months[pick] : undefined

  return (
    <View style={{ gap: space(3) }}>
      <View style={[styles.chart, { height: HEIGHT, borderBottomColor: c.border }]}>
        {report.months.map((m, i) => {
          const projected = report.projectedFrom !== null && m >= report.projectedFrom
          const income = report.income.byMonth[i] ?? 0
          const segments = report.categories
            .map((cat) => ({ id: cat.categoryId, v: cat.byMonth[i] ?? 0 }))
            .filter((s) => s.v > 0)
          const spent = report.spent.byMonth[i] ?? 0
          return (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={formatMonthTitle(m)}
              testID="chart-month"
              onPress={() => setSelected(selected === i ? null : i)}
              style={[
                styles.column,
                selected === i && { backgroundColor: c.accent },
                projected && { opacity: 0.45 },
              ]}
            >
              <View style={{ flex: max - spent }} />
              <View style={[styles.bar, { flex: spent }]}>
                {segments.map((s) => (
                  <View
                    key={s.id}
                    style={{
                      flex: s.v,
                      backgroundColor: categoryById.get(s.id)?.color ?? c.mutedForeground,
                    }}
                  />
                ))}
              </View>
              {income > 0 ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.income,
                    { bottom: (income / max) * HEIGHT - 1.5, backgroundColor: c.positive },
                  ]}
                />
              ) : null}
            </Pressable>
          )
        })}
      </View>
      <View style={styles.labels}>
        {report.months.map((m) => (
          <Text key={m} style={[styles.label, { color: c.mutedForeground }]}>
            {formatMonthAbbr(m).slice(0, 1).toUpperCase()}
          </Text>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendLine, { backgroundColor: c.positive }]} />
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>Ingresos</Text>
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          · Barras: gastos por categoría{report.projectedFrom ? ' · claro: proyectado' : ''}
        </Text>
      </View>
      {month !== undefined && pick !== null ? (
        <View style={[styles.detail, { backgroundColor: c.muted }]} testID="chart-detail">
          <Text style={{ color: c.foreground, fontWeight: '700', textTransform: 'capitalize' }}>
            {formatMonthTitle(month)}
          </Text>
          <Text style={{ color: c.mutedForeground }}>
            Gastado <Money cents={report.spent.byMonth[pick] ?? 0} decimals="never" /> · Ingresos{' '}
            <Money cents={report.income.byMonth[pick] ?? 0} decimals="never" />
          </Text>
        </View>
      ) : (
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          Tocá un mes para ver los números.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'stretch', gap: 3, borderBottomWidth: 1 },
  column: { flex: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  bar: { borderTopLeftRadius: 3, borderTopRightRadius: 3, overflow: 'hidden', marginHorizontal: 2 },
  income: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2 },
  labels: { flexDirection: 'row', gap: 3, marginTop: -space(2) },
  label: { flex: 1, textAlign: 'center', fontSize: 11 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), flexWrap: 'wrap' },
  legendLine: { width: 14, height: 3, borderRadius: 2 },
  detail: { borderRadius: 10, padding: space(3), gap: 2 },
})
