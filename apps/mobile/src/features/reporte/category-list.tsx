import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, ChevronRight } from 'lucide-react-native'
import type { YearReport } from '@shared/types'
import { CategoryIcon } from '@/components/icons'
import { Money } from '@/components/money'
import { useCatalog } from '@/lib/catalog'
import { radius, space, useColors } from '@/lib/theme'

/** En la PC es una tabla de 12 meses; en el celu, total y promedio por categoría y subcategoría. */
export function CategoryList({ report }: { report: YearReport }) {
  const c = useColors()
  const { categoryById, subcategoryById } = useCatalog()
  const [open, setOpen] = useState<Set<number>>(new Set())
  const toggle = (id: number) => {
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const total = Math.max(1, report.spent.totalCents)

  return (
    <View style={{ gap: space(1) }}>
      {report.categories.map((cat) => {
        const info = categoryById.get(cat.categoryId)
        const expanded = open.has(cat.categoryId)
        const pct = Math.round((cat.totalCents / total) * 100)
        return (
          <View key={cat.categoryId}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={info?.name ?? 'Categoría'}
              testID="report-category"
              onPress={() => toggle(cat.categoryId)}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.accent }]}
            >
              {expanded ? (
                <ChevronDown color={c.mutedForeground} size={16} />
              ) : (
                <ChevronRight color={c.mutedForeground} size={16} />
              )}
              <CategoryIcon
                icon={info?.icon ?? 'tag'}
                color={info?.color ?? c.mutedForeground}
                size="sm"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[styles.name, { color: c.foreground }]}>
                  {info?.name ?? '—'}
                </Text>
                <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                  {pct}% · promedio{' '}
                  <Money cents={cat.averageCents} decimals="never" style={{ fontSize: 12 }} />
                  /mes
                </Text>
              </View>
              <Money cents={cat.totalCents} decimals="never" style={styles.total} />
            </Pressable>
            {expanded
              ? cat.subcategories.map((s) => (
                  <View key={s.subcategoryId} style={styles.sub}>
                    <Text
                      numberOfLines={1}
                      style={{ color: c.mutedForeground, flex: 1, fontSize: 14 }}
                    >
                      {subcategoryById.get(s.subcategoryId)?.name ?? '—'}
                    </Text>
                    <Money cents={s.totalCents} decimals="never" style={{ fontSize: 14 }} />
                  </View>
                ))
              : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2.5),
    paddingVertical: space(2.5),
    paddingHorizontal: space(1),
    borderRadius: radius.md,
  },
  name: { fontSize: 15, fontWeight: '600' },
  total: { fontSize: 15, fontWeight: '700' },
  sub: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingVertical: space(1.5),
    paddingLeft: space(16),
    paddingRight: space(1),
  },
})
