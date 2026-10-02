import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ArrowDownRight, ArrowUpRight, PiggyBank } from 'lucide-react-native'
import type { MonthSummary } from '@shared/types'
import { Money } from '@/components/money'
import { radius, space, useColors } from '@/lib/theme'

export function SummaryCards({ summary }: { summary: MonthSummary }) {
  const c = useColors()
  const available = summary.availableCents
  return (
    <View style={{ gap: space(3) }}>
      <View
        testID="tile-disponible"
        style={[styles.hero, { backgroundColor: available >= 0 ? c.primary : c.negative }]}
      >
        <Text style={[styles.heroLabel, { color: c.primaryForeground }]}>Disponible</Text>
        <Money cents={available} style={[styles.heroValue, { color: c.primaryForeground }]} />
        <Text style={[styles.heroHint, { color: c.primaryForeground }]}>Queda para el mes</Text>
      </View>
      <View style={styles.grid}>
        <Tile
          label="Ingresos"
          icon={<ArrowUpRight color={c.positive} size={16} />}
          cents={summary.incomeCents}
        />
        <Tile
          label="Gastado"
          icon={<ArrowDownRight color={c.negative} size={16} />}
          cents={summary.spentCents}
          hint={
            summary.projectedCount > 0
              ? `Con ${String(summary.projectedCount)} proyectados`
              : undefined
          }
        />
        <Tile
          label="Ahorrado"
          icon={<PiggyBank color={c.primary} size={16} />}
          cents={summary.savedCents}
        />
      </View>
      {summary.pendingCount > 0 ? (
        <View
          testID="tile-pendientes"
          style={[
            styles.pending,
            { borderColor: `${c.pending}66`, backgroundColor: `${c.pending}14` },
          ]}
        >
          <Text style={{ color: c.pending, fontWeight: '600' }}>
            {summary.pendingCount === 1
              ? '1 gasto pendiente de cargar'
              : `${String(summary.pendingCount)} gastos pendientes de cargar`}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

function Tile({
  label,
  icon,
  cents,
  hint,
}: {
  label: string
  icon: ReactNode
  cents: number
  hint?: string | undefined
}) {
  const c = useColors()
  return (
    <View style={[styles.tile, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={styles.tileHead}>
        <Text style={[styles.tileLabel, { color: c.mutedForeground }]}>{label}</Text>
        {icon}
      </View>
      <Money cents={cents} decimals="never" style={styles.tileValue} />
      {hint ? (
        <Text numberOfLines={1} style={{ color: c.mutedForeground, fontSize: 11 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space(5), gap: space(1) },
  heroLabel: { fontSize: 14, fontWeight: '600', opacity: 0.9 },
  heroValue: { fontSize: 32, fontWeight: '800' },
  heroHint: { fontSize: 12, opacity: 0.85 },
  grid: { flexDirection: 'row', gap: space(2.5) },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space(3),
    gap: space(1),
  },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  tileValue: { fontSize: 16, fontWeight: '700' },
  pending: { borderWidth: 1, borderRadius: radius.md, padding: space(3) },
})
