import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CircleCheck } from 'lucide-react-native'
import { formatMonthLong, monthOf } from '@shared/months'
import type { GoalProgress } from '@shared/types'
import { ChoiceSheet } from '@/components/choice-sheet'
import { Money } from '@/components/money'
import { Progress } from '@/components/progress'
import { Muted } from '@/components/ui'
import { keys, useApiMutation } from '@/lib/hooks'
import { radius, space, useColors } from '@/lib/theme'
import { openGoal, openMovement } from './open'

export function GoalCard({ goal }: { goal: GoalProgress }) {
  const c = useColors()
  const [menu, setMenu] = useState(false)
  const archive = useApiMutation('savings:archiveGoal', {
    invalidate: [keys.savings],
    success: (_d, input) => (input.archived ? 'Meta archivada' : 'Meta restaurada'),
  })
  const pct = Math.min(100, Math.max(0, (goal.savedMinor / goal.targetMinor) * 100))
  const done = goal.remainingMinor === 0
  const small = { fontSize: 12 }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Meta ${goal.name}`}
        testID="goal-card"
        onPress={() => setMenu(true)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: c.card, borderColor: c.border },
          goal.archived && { opacity: 0.7 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={styles.between}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[styles.name, { color: c.foreground }]}>
              {goal.name}
            </Text>
            <Muted style={small}>
              {goal.targetDate
                ? `Para ${formatMonthLong(monthOf(goal.targetDate))}`
                : 'Sin fecha objetivo'}
            </Muted>
          </View>
          {done ? (
            <View style={[styles.badge, { backgroundColor: `${c.positive}26` }]}>
              <CircleCheck color={c.positive} size={13} />
              <Text style={[styles.badgeText, { color: c.positive }]}>Cumplida</Text>
            </View>
          ) : goal.overdue ? (
            <View style={[styles.badge, { backgroundColor: `${c.pending}26` }]}>
              <Text style={[styles.badgeText, { color: c.pending }]}>Vencida</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.between}>
          <Money cents={goal.savedMinor} currency={goal.currency} style={styles.saved} />
          <Text style={{ color: c.mutedForeground, fontSize: 13 }}>
            de{' '}
            <Money
              cents={goal.targetMinor}
              currency={goal.currency}
              decimals="never"
              style={{ fontSize: 13 }}
            />
          </Text>
        </View>
        <Progress
          value={pct}
          color={done ? c.positive : undefined}
          label={`${String(Math.floor(pct))}% de la meta`}
        />
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          {done ? (
            '¡Llegaste al objetivo!'
          ) : goal.perMonthMinor !== null ? (
            <>
              Faltan <Money cents={goal.remainingMinor} currency={goal.currency} style={small} />:
              ahorrá{' '}
              <Money
                cents={goal.perMonthMinor}
                currency={goal.currency}
                style={[small, { color: c.foreground, fontWeight: '600' }]}
              />{' '}
              {goal.monthsLeft === 1
                ? 'este mes.'
                : `por mes durante ${String(goal.monthsLeft)} meses.`}
            </>
          ) : (
            <>
              Faltan <Money cents={goal.remainingMinor} currency={goal.currency} style={small} />
              {goal.overdue ? '. La fecha ya pasó: editala si querés un nuevo plan.' : ''}
            </>
          )}
        </Text>
      </Pressable>
      <ChoiceSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={goal.name}
        choices={[
          ...(goal.archived
            ? []
            : [
                {
                  label: 'Aportar',
                  variant: 'primary' as const,
                  onPress: () =>
                    openMovement({
                      movement: null,
                      defaults: { currency: goal.currency, goalId: goal.id },
                    }),
                },
              ]),
          { label: 'Editar', onPress: () => openGoal(goal) },
          {
            label: goal.archived ? 'Restaurar' : 'Archivar',
            onPress: () => archive.mutate({ id: goal.id, archived: !goal.archived }),
          },
        ]}
      />
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space(4),
    gap: space(2.5),
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space(2),
  },
  name: { fontSize: 16, fontWeight: '600' },
  saved: { fontSize: 20, fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
})
