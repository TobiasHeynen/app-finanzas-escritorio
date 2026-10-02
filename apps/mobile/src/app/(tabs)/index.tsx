import { useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Receipt } from 'lucide-react-native'
import { currentMonth } from '@shared/months'
import { EmptyState } from '@/components/empty-state'
import { Fab } from '@/components/fab'
import { MonthStepper } from '@/components/month-stepper'
import { Screen } from '@/components/screen'
import { Button, Card, Chip, SectionTitle } from '@/components/ui'
import { ExpenseList } from '@/features/gastos/expense-list'
import { openNewExpense } from '@/features/gastos/open-expense'
import { CategoryBars } from '@/features/inicio/category-bars'
import { SummaryCards } from '@/features/inicio/summary-cards'
import { useCatalog } from '@/lib/catalog'
import { useMonthOverview } from '@/lib/movements'
import { space, useColors } from '@/lib/theme'

export default function InicioScreen() {
  const c = useColors()
  const [month, setMonth] = useState(() => currentMonth())
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const { data } = useMonthOverview(month)
  const { categoryById } = useCatalog()
  const isCurrent = month === currentMonth()
  const newDefaults = isCurrent ? undefined : { purchaseDate: `${month}-01` }

  const filtered = useMemo(() => {
    if (!data) return { expenses: [], projected: [] }
    if (categoryId === null) return data
    return {
      expenses: data.expenses.filter((e) => e.categoryId === categoryId),
      projected: data.projected.filter((e) => e.categoryId === categoryId),
    }
  }, [data, categoryId])

  const empty = data !== undefined && data.expenses.length === 0 && data.projected.length === 0
  const filterName = categoryId !== null ? categoryById.get(categoryId)?.name : undefined

  return (
    <Screen bottomSpace overlay={<Fab label="Gasto" onPress={() => openNewExpense(newDefaults)} />}>
      <View style={styles.header}>
        <MonthStepper
          value={month}
          onChange={(m) => {
            setMonth(m)
            setCategoryId(null)
          }}
        />
        {!isCurrent ? (
          <Button
            label="Hoy"
            variant="ghost"
            size="sm"
            onPress={() => {
              setMonth(currentMonth())
              setCategoryId(null)
            }}
          />
        ) : null}
      </View>

      {data ? <SummaryCards summary={data.summary} /> : null}

      {data && data.summary.byCategory.some((r) => r.amountCents > 0) ? (
        <Card style={{ gap: space(3) }}>
          <SectionTitle>Por categoría</SectionTitle>
          <CategoryBars summary={data.summary} selected={categoryId} onSelect={setCategoryId} />
        </Card>
      ) : null}

      <View style={{ gap: space(2) }}>
        <SectionTitle
          right={
            filterName ? (
              <Chip label={`${filterName} ✕`} selected onPress={() => setCategoryId(null)} />
            ) : null
          }
        >
          Gastos
        </SectionTitle>
        {empty ? (
          <EmptyState
            icon={<Receipt color={c.mutedForeground} size={22} />}
            title="Todavía no cargaste gastos este mes."
            description="Tocá “+ Gasto” para cargar el primero."
          />
        ) : (
          <ExpenseList expenses={filtered.expenses} projected={filtered.projected} month={month} />
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
