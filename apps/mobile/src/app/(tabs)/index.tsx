import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { formatMoney } from '@shared/money'
import { addMonths, currentMonth, formatMonthTitle } from '@shared/months'
import { Screen } from '@/components/screen'
import { keys } from '@/lib/query'
import { radius, space, useColors, type Colors } from '@/lib/theme'
import { useServices } from '@/lib/use-services'

export default function InicioScreen() {
  const colors = useColors()
  const services = useServices()
  const [month, setMonth] = useState(() => currentMonth())
  const { data } = useQuery({
    queryKey: keys.summary(month),
    queryFn: () => services.summary.overview(month),
  })
  const summary = data?.summary

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton label="Mes anterior" onPress={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft color={colors.foreground} size={22} />
        </IconButton>
        <Text style={[styles.month, { color: colors.foreground }]}>{formatMonthTitle(month)}</Text>
        <IconButton label="Mes siguiente" onPress={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight color={colors.foreground} size={22} />
        </IconButton>
      </View>

      {summary ? (
        <>
          <View style={[styles.hero, { backgroundColor: colors.primary }]}>
            <Text style={[styles.heroLabel, { color: colors.primaryForeground }]}>Disponible</Text>
            <Text style={[styles.heroValue, { color: colors.primaryForeground }]}>
              {formatMoney(summary.availableCents)}
            </Text>
          </View>
          <View style={styles.grid}>
            <Tile colors={colors} label="Ingresos" value={summary.incomeCents} />
            <Tile colors={colors} label="Gastos" value={summary.spentCents} />
            <Tile colors={colors} label="Ahorro" value={summary.savedCents} />
          </View>
          {summary.pendingCount > 0 ? (
            <Text style={{ color: colors.pending }}>
              {summary.pendingCount === 1
                ? '1 gasto pendiente de cargar'
                : `${String(summary.pendingCount)} gastos pendientes de cargar`}
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}

function IconButton({
  label,
  onPress,
  children,
}: {
  label: string
  onPress: () => void
  children: ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}
    >
      {children}
    </Pressable>
  )
}

function Tile({ colors, label, value }: { colors: Colors; label: string; value: number }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text
        style={[styles.tileValue, { color: colors.foreground }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {formatMoney(value, 'ARS', { decimals: 'never' })}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 20, fontWeight: '700' },
  iconButton: { padding: space(2) },
  hero: { borderRadius: radius.xl, padding: space(5), gap: space(1) },
  heroLabel: { fontSize: 14, fontWeight: '500', opacity: 0.9 },
  heroValue: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', gap: space(3) },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space(3),
    gap: space(1),
  },
  tileLabel: { fontSize: 12, fontWeight: '500' },
  tileValue: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
})
