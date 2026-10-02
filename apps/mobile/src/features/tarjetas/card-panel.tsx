import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CalendarClock } from 'lucide-react-native'
import { formatDateShort, formatMonthLong, formatMonthShort } from '@shared/months'
import type { CardOverview, PaymentMethod, PlanProgress } from '@shared/types'
import { CategoryIcon, PaymentMethodIcon } from '@/components/icons'
import { Money } from '@/components/money'
import { Progress } from '@/components/progress'
import { Card, Muted } from '@/components/ui'
import { useCatalog } from '@/lib/catalog'
import { radius, space, useColors } from '@/lib/theme'
import { openPlan } from './open-plan'

export function CardPanel({ overview, method }: { overview: CardOverview; method: PaymentMethod }) {
  const c = useColors()
  const { dueThisMonth: due, openStatement: open } = overview
  return (
    <Card style={{ gap: space(4) }}>
      <View style={styles.header} testID={`card-${String(method.id)}`}>
        <PaymentMethodIcon method={method} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.foreground }]}>{method.name}</Text>
          <Muted>
            Cierra el {method.closingDay ?? '—'}
            {method.dueDay !== null ? ` · vence el ${String(method.dueDay)}` : ''}
          </Muted>
        </View>
      </View>

      <View style={styles.tiles}>
        <View style={[styles.tile, { backgroundColor: c.muted }]} testID="card-due">
          <Muted style={styles.tileLabel}>Vence en {formatMonthLong(due.month)}</Muted>
          <Money cents={due.totalCents} style={styles.tileAmount} />
          <Muted style={styles.tileLabel}>
            {due.dueDate ? `Antes del ${formatDateShort(due.dueDate)}` : 'Pagá antes del 5'}
          </Muted>
          {due.pendingCount > 0 ? (
            <Text style={[styles.pending, { color: c.pending }]}>
              {due.pendingCount} {due.pendingCount === 1 ? 'pendiente' : 'pendientes'}
            </Text>
          ) : null}
        </View>
        <View style={[styles.tile, { borderWidth: 1, borderColor: c.border }]} testID="card-open">
          <View style={styles.inline}>
            <CalendarClock color={c.mutedForeground} size={13} />
            <Muted style={styles.tileLabel}>Resumen abierto</Muted>
          </View>
          <Money cents={open.totalCents} style={styles.tileAmount} />
          <Muted style={styles.tileLabel}>
            Cierra el {formatDateShort(open.closingDate)} · se paga en{' '}
            {formatMonthShort(open.chargeMonth)}
          </Muted>
        </View>
      </View>

      <View style={{ gap: space(1) }}>
        <View style={styles.plansHeader}>
          <Text style={[styles.plansTitle, { color: c.foreground }]}>Cuotas activas</Text>
          {overview.committedCents > 0 ? (
            <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
              Comprometido: <Money cents={overview.committedCents} style={{ fontSize: 12 }} />
            </Text>
          ) : null}
        </View>
        {overview.plans.length === 0 ? (
          <Muted style={{ paddingVertical: space(2) }}>Sin cuotas activas.</Muted>
        ) : (
          overview.plans.map((p) => <PlanRow key={p.planId} plan={p} />)
        )}
      </View>
    </Card>
  )
}

function PlanRow({ plan }: { plan: PlanProgress }) {
  const c = useColors()
  const { subcategoryById } = useCatalog()
  const sub = subcategoryById.get(plan.subcategoryId)
  const color = sub?.category.color ?? c.mutedForeground
  const progress = `${String(plan.paidCount)} de ${String(plan.installmentsCount)}`
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plan.description || 'Compra en cuotas'}, ${progress} cuotas`}
      testID="plan-row"
      onPress={() => openPlan(plan.planId)}
      style={({ pressed }) => [styles.planRow, pressed && { backgroundColor: c.accent }]}
    >
      <CategoryIcon icon={sub?.category.icon ?? 'tag'} color={color} size="sm" />
      <View style={{ flex: 1, minWidth: 0, gap: space(1.5) }}>
        <View style={styles.between}>
          <Text numberOfLines={1} style={[styles.planName, { color: c.foreground }]}>
            {plan.description || sub?.name || 'Compra en cuotas'}
          </Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12, fontVariant: ['tabular-nums'] }}>
            {progress}
          </Text>
        </View>
        <Progress value={(plan.paidCount / plan.installmentsCount) * 100} color={color} />
        <View style={styles.between}>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            Cuota <Money cents={plan.nextAmountCents} style={{ fontSize: 12 }} />
          </Text>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            Faltan <Money cents={plan.remainingCents} style={{ fontSize: 12 }} /> · hasta{' '}
            {formatMonthShort(plan.lastMonth)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  name: { fontSize: 17, fontWeight: '700' },
  tiles: { flexDirection: 'row', gap: space(2) },
  tile: { flex: 1, borderRadius: radius.md, padding: space(3), gap: space(1) },
  tileLabel: { fontSize: 12 },
  tileAmount: { fontSize: 19, fontWeight: '700' },
  pending: { fontSize: 12, fontWeight: '600' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  plansHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  plansTitle: { fontSize: 14, fontWeight: '600' },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2),
    paddingHorizontal: space(1),
    borderRadius: radius.md,
  },
  planName: { fontSize: 14, flexShrink: 1 },
  between: { flexDirection: 'row', justifyContent: 'space-between', gap: space(2) },
})
