import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MonthSummary } from '@shared/types'
import { CategoryIcon } from '@/components/icons'
import { Money } from '@/components/money'
import { useCatalog } from '@/lib/catalog'
import { radius, space, useColors } from '@/lib/theme'

/** Gastado por categoría, de mayor a menor. Tocar una filtra la lista; tocarla de nuevo, la limpia. */
export function CategoryBars({
  summary,
  selected,
  onSelect,
}: {
  summary: MonthSummary
  selected: number | null
  onSelect: (categoryId: number | null) => void
}) {
  const c = useColors()
  const { categoryById } = useCatalog()
  const rows = summary.byCategory.filter((r) => r.amountCents > 0)
  const max = Math.max(1, ...rows.map((r) => r.amountCents))
  if (rows.length === 0) return null
  return (
    <View style={{ gap: space(2.5) }}>
      {rows.map((r) => {
        const cat = categoryById.get(r.categoryId)
        if (!cat) return null
        const active = selected === r.categoryId
        const dimmed = selected !== null && !active
        return (
          <Pressable
            key={r.categoryId}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filtrar por ${cat.name}`}
            onPress={() => onSelect(active ? null : r.categoryId)}
            style={[styles.row, dimmed && { opacity: 0.45 }]}
          >
            <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.labels}>
                <Text numberOfLines={1} style={[styles.name, { color: c.foreground }]}>
                  {cat.name}
                </Text>
                <Money cents={r.amountCents} decimals="never" style={styles.amount} />
              </View>
              <View style={[styles.track, { backgroundColor: c.muted }]}>
                <View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: cat.color,
                      width: `${Math.max(2, Math.round((r.amountCents / max) * 100))}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: space(2) },
  name: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  amount: { fontSize: 14, fontWeight: '600' },
  track: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  bar: { height: 6, borderRadius: radius.sm },
})
