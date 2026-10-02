import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { Search, SearchX } from 'lucide-react-native'
import { sumCents } from '@shared/money'
import { addMonths, currentMonth, formatMonthTitle, type Month } from '@shared/months'
import type { Expense } from '@shared/types'
import { EmptyState } from '@/components/empty-state'
import { CategoryIcon, PaymentMethodIcon } from '@/components/icons'
import { Money } from '@/components/money'
import { MonthStepper } from '@/components/month-stepper'
import { Screen } from '@/components/screen'
import { Card, Chip, Label, TextField } from '@/components/ui'
import { ExpenseList } from '@/features/gastos/expense-list'
import { useCatalog } from '@/lib/catalog'
import { keys, useApiQuery } from '@/lib/hooks'
import { space, useColors } from '@/lib/theme'
import { useDebouncedValue } from '@/lib/use-debounced-value'

export default function MovimientosScreen() {
  const c = useColors()
  const { categories, paymentMethods } = useCatalog()
  const [fromMonth, setFromMonth] = useState<Month>(addMonths(currentMonth(), -2))
  const [toMonth, setToMonth] = useState<Month>(currentMonth())
  const [text, setText] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null)
  const debounced = useDebouncedValue(text, 250)

  const input = {
    fromMonth: fromMonth <= toMonth ? fromMonth : toMonth,
    toMonth: fromMonth <= toMonth ? toMonth : fromMonth,
    text: debounced.trim() || null,
    categoryId,
    paymentMethodId,
  }
  const { data = [], isLoading } = useApiQuery('expenses:search', input, [
    ...keys.expenses,
    'search',
    input,
  ])

  const byMonth = useMemo(() => {
    const map = new Map<string, Expense[]>()
    for (const e of data) {
      const list = map.get(e.chargeMonth) ?? []
      list.push(e)
      map.set(e.chargeMonth, list)
    }
    return [...map].sort(([a], [b]) => (a < b ? 1 : -1))
  }, [data])

  return (
    <Screen title="Movimientos">
      <Card style={{ gap: space(3) }}>
        <View style={[styles.search, { borderColor: c.border }]}>
          <Search color={c.mutedForeground} size={18} />
          <TextField
            value={text}
            onChangeText={setText}
            placeholder="Detalle, nota o subcategoría"
            autoCorrect={false}
            style={styles.searchInput}
          />
        </View>
        <View style={styles.range}>
          <View style={{ gap: space(1) }}>
            <Label>Desde</Label>
            <MonthStepper size="sm" value={fromMonth} onChange={setFromMonth} />
          </View>
          <View style={{ gap: space(1) }}>
            <Label>Hasta</Label>
            <MonthStepper size="sm" value={toMonth} onChange={setToMonth} />
          </View>
        </View>
        <Label>Categoría</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            <Chip
              label="Todas"
              selected={categoryId === null}
              onPress={() => setCategoryId(null)}
            />
            {categories.map((cat) => (
              <Chip
                key={cat.id}
                label={cat.name}
                color={cat.color}
                icon={<CategoryIcon icon={cat.icon} color={cat.color} size="sm" />}
                selected={categoryId === cat.id}
                onPress={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
              />
            ))}
          </View>
        </ScrollView>
        <Label>Medio de pago</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chips}>
            <Chip
              label="Todos"
              selected={paymentMethodId === null}
              onPress={() => setPaymentMethodId(null)}
            />
            {paymentMethods.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                icon={<PaymentMethodIcon method={m} size={16} />}
                selected={paymentMethodId === m.id}
                onPress={() => setPaymentMethodId(paymentMethodId === m.id ? null : m.id)}
              />
            ))}
          </View>
        </ScrollView>
      </Card>

      {!isLoading && byMonth.length === 0 ? (
        <EmptyState
          icon={<SearchX color={c.mutedForeground} size={22} />}
          title="No hay movimientos"
          description="Probá con otro rango o sacá algún filtro."
        />
      ) : (
        byMonth.map(([month, list]) => (
          <View key={month} testID="movimientos-mes" style={{ gap: space(2) }}>
            <View style={styles.monthHeader}>
              <Text style={[styles.monthTitle, { color: c.foreground }]}>
                {formatMonthTitle(month)}
              </Text>
              <Money
                cents={sumCents(list.map((e) => e.amountCents))}
                style={{ fontWeight: '700' }}
              />
            </View>
            <ExpenseList expenses={list} month={month} />
          </View>
        ))
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: space(3),
  },
  searchInput: { flex: 1, borderWidth: 0, paddingLeft: 0 },
  range: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space(2) },
  chips: { flexDirection: 'row', gap: space(2) },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthTitle: { fontSize: 18, fontWeight: '700' },
})
