import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Repeat, Users } from 'lucide-react-native'
import { formatMonthLong } from '@shared/months'
import type { Expense, ProjectedExpense } from '@shared/types'
import { CategoryIcon } from '@/components/icons'
import { Money } from '@/components/money'
import { useCatalog } from '@/lib/catalog'
import { groupLabel, useGroupsIndex } from '@/lib/groups'
import { useDeleteExpense, useDeletePlan, useDuplicateExpense } from '@/lib/movements'
import { radius, space, useColors } from '@/lib/theme'
import { openPlan } from '@/features/tarjetas/open-plan'
import { openEditExpense } from './open-expense'

export function ExpenseRow({ expense }: { expense: Expense }) {
  const c = useColors()
  const { subcategoryById, paymentMethodById } = useCatalog()
  const remove = useDeleteExpense()
  const removePlan = useDeletePlan()
  const duplicate = useDuplicateExpense()
  const inGroup = groupLabel(useGroupsIndex(), expense.group)
  const sub = subcategoryById.get(expense.subcategoryId)
  const method = paymentMethodById.get(expense.paymentMethodId)
  const title = expense.description || sub?.name || 'Gasto'

  const planActions = () => {
    const inst = expense.installment
    if (!inst) return
    Alert.alert(
      `${title} · cuota ${String(inst.number)}/${String(inst.count)}`,
      `Cae en ${formatMonthLong(expense.chargeMonth)}.`,
      [
        { text: 'Ver la compra', onPress: () => openPlan(inst.planId) },
        {
          text: 'Borrar las futuras',
          onPress: () => removePlan.mutate({ id: inst.planId, scope: 'future' }),
        },
        {
          text: 'Borrar todo el plan',
          style: 'destructive',
          onPress: () => removePlan.mutate({ id: inst.planId, scope: 'all' }),
        },
        { text: 'Cerrar', style: 'cancel' },
      ],
    )
  }

  const onPress = () => {
    if (expense.installment) openPlan(expense.installment.planId)
    else openEditExpense(expense)
  }

  const onLongPress = () => {
    if (expense.installment) {
      planActions()
      return
    }
    Alert.alert(title, undefined, [
      { text: 'Duplicar', onPress: () => duplicate.mutate({ id: expense.id }) },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => remove.mutate({ id: expense.id }),
      },
      { text: 'Cancelar', style: 'cancel' },
    ])
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Mantené apretado para más opciones"
      onPress={onPress}
      onLongPress={onLongPress}
      testID="expense-row"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.accent }]}
    >
      {sub ? <CategoryIcon icon={sub.category.icon} color={sub.category.color} /> : null}
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: c.foreground }]}>
            {title}
          </Text>
          {expense.installment ? (
            <Text style={[styles.badge, { backgroundColor: c.muted, color: c.foreground }]}>
              {expense.installment.number}/{expense.installment.count}
            </Text>
          ) : null}
          {expense.recurringTemplateId !== null ? (
            <Repeat color={c.mutedForeground} size={14} accessibilityLabel="Recurrente" />
          ) : null}
        </View>
        <Text numberOfLines={1} style={[styles.subtitle, { color: c.mutedForeground }]}>
          {sub ? `${sub.category.name} › ${sub.name}` : ''}
          {method ? ` · ${method.name}` : ''}
        </Text>
        {inGroup ? (
          <View style={styles.titleRow}>
            <Users color={c.mutedForeground} size={12} />
            <Text numberOfLines={1} style={[styles.subtitle, { color: c.mutedForeground }]}>
              {inGroup}
            </Text>
          </View>
        ) : null}
      </View>
      {expense.amountCents === null ? (
        <Text style={[styles.pending, { color: c.pending, borderColor: `${c.pending}66` }]}>
          Pendiente
        </Text>
      ) : (
        <Money cents={expense.amountCents} style={styles.amount} />
      )}
    </Pressable>
  )
}

export function ProjectedRow({ item }: { item: ProjectedExpense }) {
  const c = useColors()
  const { subcategoryById, paymentMethodById } = useCatalog()
  const sub = subcategoryById.get(item.subcategoryId)
  const method = paymentMethodById.get(item.paymentMethodId)
  return (
    <View style={[styles.row, { opacity: 0.6 }]} testID="projected-row">
      {sub ? <CategoryIcon icon={sub.category.icon} color={sub.category.color} muted /> : null}
      <View style={styles.texts}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, { color: c.foreground }]}>
            {item.description}
          </Text>
          <Text
            style={[styles.badge, { borderWidth: 1, borderColor: c.border, color: c.foreground }]}
          >
            Proyectado
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.subtitle, { color: c.mutedForeground }]}>
          {sub ? `${sub.category.name} › ${sub.name}` : ''}
          {method ? ` · ${method.name}` : ''}
        </Text>
      </View>
      <Money cents={item.amountCents} style={styles.amount} />
    </View>
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
  texts: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  title: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  subtitle: { fontSize: 12 },
  badge: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  amount: { fontSize: 15, fontWeight: '700' },
  pending: {
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
})
