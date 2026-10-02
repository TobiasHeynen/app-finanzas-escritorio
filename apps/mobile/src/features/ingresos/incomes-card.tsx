import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { BriefcaseBusiness, Copy, Gift, Laptop, Plus, Wallet } from 'lucide-react-native'
import { formatDateShort, type Month } from '@shared/months'
import type { Income } from '@shared/types'
import { INCOME_TYPE_LABELS } from '@shared/types'
import { Money } from '@/components/money'
import { Button, Card, Muted, SectionTitle } from '@/components/ui'
import { call } from '@/lib/api'
import { keys, movementKeys, useApiMutation, useApiQuery } from '@/lib/hooks'
import { useUndoToast } from '@/lib/movements'
import { openWith } from '@/lib/nav-payload'
import { toast } from '@/lib/toast'
import { space, useColors } from '@/lib/theme'

const ICONS = { sueldo: BriefcaseBusiness, aguinaldo: Gift, freelance: Laptop, otro: Wallet }

export interface IncomeTarget {
  income: Income | null
  month: Month
}

export function openIncome(target: IncomeTarget): void {
  openWith<IncomeTarget>('/ingreso', target)
}

export function IncomesCard({ month }: { month: Month }) {
  const c = useColors()
  const { data: incomes = [] } = useApiQuery('incomes:list', { month }, [...keys.incomes, month])
  const undoToast = useUndoToast()
  const remove = useApiMutation('incomes:remove', {
    invalidate: movementKeys,
    onSuccess: (_d, { id }) => {
      undoToast('Ingreso borrado', () => call('incomes:restore', { id }))
    },
  })
  const copy = useApiMutation('incomes:copyPreviousSalary', {
    invalidate: movementKeys,
    onSuccess: (income) => {
      if (income) toast.success('Copiamos el sueldo del mes anterior')
      else toast.info('No hay un sueldo anterior para copiar')
    },
  })
  const hasSalary = incomes.some((i) => i.type === 'sueldo')

  return (
    <Card style={{ gap: space(2) }}>
      <SectionTitle
        right={
          <Button
            label="Ingreso"
            size="sm"
            variant="ghost"
            icon={<Plus color={c.foreground} size={16} />}
            onPress={() => openIncome({ income: null, month })}
          />
        }
      >
        Ingresos del mes
      </SectionTitle>
      {incomes.length === 0 ? <Muted>Todavía no cargaste ingresos este mes.</Muted> : null}
      {incomes.map((income) => {
        const Icon = ICONS[income.type]
        return (
          <Pressable
            key={income.id}
            testID="income-row"
            accessibilityRole="button"
            onPress={() => openIncome({ income, month })}
            onLongPress={() =>
              Alert.alert(income.description || INCOME_TYPE_LABELS[income.type], undefined, [
                {
                  text: 'Borrar',
                  style: 'destructive',
                  onPress: () => remove.mutate({ id: income.id }),
                },
                { text: 'Cancelar', style: 'cancel' },
              ])
            }
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.icon, { backgroundColor: `${c.positive}22` }]}>
              <Icon color={c.positive} size={16} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: c.foreground, fontWeight: '600' }}>
                {income.description || INCOME_TYPE_LABELS[income.type]}
              </Text>
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
                {INCOME_TYPE_LABELS[income.type]} · {formatDateShort(income.date)}
              </Text>
            </View>
            <Money cents={income.amountCents} tone="positive" style={{ fontWeight: '700' }} />
          </Pressable>
        )
      })}
      {!hasSalary ? (
        <Button
          label="Copiar sueldo del mes anterior"
          variant="outline"
          size="sm"
          icon={<Copy color={c.foreground} size={16} />}
          disabled={copy.isPending}
          style={{ alignSelf: 'flex-start' }}
          onPress={() => copy.mutate({ month })}
        />
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(1.5) },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
})
