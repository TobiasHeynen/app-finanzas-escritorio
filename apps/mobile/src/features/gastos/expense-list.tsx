import { StyleSheet, Text, View } from 'react-native'
import { sumCents } from '@shared/money'
import { formatDayHeading, monthOf, type Month } from '@shared/months'
import type { Expense, ProjectedExpense } from '@shared/types'
import { Money } from '@/components/money'
import { space, useColors } from '@/lib/theme'
import { ExpenseRow, ProjectedRow } from './expense-row'

type Item =
  | { kind: 'expense'; date: string; expense: Expense }
  | { kind: 'projected'; date: string; item: ProjectedExpense }

const EARLIER = 'anteriores'

/**
 * Gastos agrupados por día (más reciente primero), con subtotal por día. Lo comprado en meses
 * anteriores que impacta en este (tarjeta y cuotas) va en un grupo aparte al final. Igual que la PC.
 */
export function ExpenseList({
  expenses,
  projected = [],
  month,
}: {
  expenses: Expense[]
  projected?: ProjectedExpense[]
  month?: Month
}) {
  const c = useColors()
  const items: Item[] = [
    ...expenses.map((expense) => ({
      kind: 'expense' as const,
      date: expense.purchaseDate,
      expense,
    })),
    ...projected.map((item) => ({ kind: 'projected' as const, date: item.date, item })),
  ]
  const groups = new Map<string, Item[]>()
  for (const item of items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))) {
    const key = month !== undefined && monthOf(item.date) < month ? EARLIER : item.date
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  const earlier = groups.get(EARLIER)
  if (earlier) {
    groups.delete(EARLIER)
    groups.set(EARLIER, earlier)
  }

  return (
    <View style={{ gap: space(4) }}>
      {[...groups].map(([date, list]) => {
        const amounts = list.map((i) =>
          i.kind === 'expense' ? i.expense.amountCents : i.item.amountCents,
        )
        return (
          <View key={date}>
            <View style={styles.header}>
              <Text style={[styles.headerText, { color: c.mutedForeground }]}>
                {date === EARLIER ? 'Comprado antes · tarjeta y cuotas' : formatDayHeading(date)}
              </Text>
              {amounts.some((a) => a !== null) ? (
                <Money cents={sumCents(amounts)} tone="muted" style={styles.headerText} />
              ) : null}
            </View>
            {list.map((i) =>
              i.kind === 'expense' ? (
                <ExpenseRow key={`e${String(i.expense.id)}`} expense={i.expense} />
              ) : (
                <ProjectedRow key={`p${String(i.item.templateId)}`} item={i.item} />
              ),
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space(2),
    paddingBottom: space(1),
  },
  headerText: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
})
