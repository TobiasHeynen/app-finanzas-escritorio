import { useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { router } from 'expo-router'
import type { Currency } from '@shared/money'
import { dateInMonth, addMonths, currentMonth, isIsoDate } from '@shared/months'
import type { SavingsGoal } from '@shared/types'
import { DateField } from '@/components/date-field'
import { Field, FormScreen } from '@/components/form-screen'
import { MoneyField } from '@/components/money-field'
import { Chip, TextField } from '@/components/ui'
import type { ApiError } from '@/lib/api'
import { keys, useApiMutation } from '@/lib/hooks'
import { space, useColors } from '@/lib/theme'

export function GoalForm({ goal }: { goal: SavingsGoal | null }) {
  const c = useColors()
  const [name, setName] = useState(goal?.name ?? '')
  const [currency, setCurrency] = useState<Currency>(goal?.currency ?? 'ARS')
  const [target, setTarget] = useState<number | null>(goal?.targetMinor ?? null)
  const [validTarget, setValidTarget] = useState(true)
  const [hasDate, setHasDate] = useState(goal?.targetDate != null)
  const [date, setDate] = useState(
    () => goal?.targetDate ?? dateInMonth(addMonths(currentMonth(), 12), 1),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const hasMovements = goal !== null && goal.savedMinor !== 0

  const options = { invalidate: [keys.savings], toastErrors: false, onSuccess: () => router.back() }
  const create = useApiMutation('savings:createGoal', { ...options, success: 'Meta creada' })
  const update = useApiMutation('savings:updateGoal', { ...options, success: 'Meta actualizada' })

  const submit = () => {
    const next: Record<string, string> = {}
    if (name.trim() === '') next['name'] = 'Poné un nombre'
    if (!validTarget || target === null || target <= 0) next['targetMinor'] = 'Poné el objetivo'
    if (hasDate && !isIsoDate(date)) next['targetDate'] = 'Fecha inválida'
    setErrors(next)
    if (Object.keys(next).length > 0 || target === null) return
    const data = {
      name: name.trim(),
      currency,
      targetMinor: target,
      targetDate: hasDate ? date : null,
    }
    const onError = (err: ApiError) => {
      setErrors({ _: err.message, ...err.fields })
    }
    if (goal) update.mutate({ id: goal.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <FormScreen
      title={goal ? 'Editar meta' : 'Nueva meta'}
      description="Con fecha objetivo te decimos cuánto ahorrar por mes para llegar."
      onSave={submit}
      saving={create.isPending || update.isPending}
      error={errors['_']}
    >
      <Field label="Nombre" error={errors['name']}>
        <TextField
          autoFocus={!goal}
          value={name}
          maxLength={80}
          placeholder="Vacaciones, fondo de emergencia…"
          invalid={Boolean(errors['name'])}
          onChangeText={setName}
        />
      </Field>
      <Field label="Moneda">
        <View style={styles.row}>
          {(['ARS', 'USD'] as const).map((cur) => (
            <Chip
              key={cur}
              label={cur === 'ARS' ? 'Pesos' : 'Dólares'}
              selected={currency === cur}
              onPress={() => {
                if (!hasMovements) setCurrency(cur)
              }}
            />
          ))}
        </View>
        {hasMovements ? (
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            Tiene aportes cargados, así que no se puede cambiar la moneda.
          </Text>
        ) : null}
      </Field>
      <Field label="Objetivo" error={errors['targetMinor']}>
        <MoneyField
          currency={currency}
          value={target}
          invalid={Boolean(errors['targetMinor'])}
          onValueChange={(cents, v) => {
            setTarget(cents)
            setValidTarget(v)
          }}
        />
      </Field>
      <View style={styles.switchRow}>
        <Text style={{ color: c.foreground, fontSize: 15, flex: 1 }}>Con fecha objetivo</Text>
        <Switch
          accessibilityLabel="Con fecha objetivo"
          value={hasDate}
          onValueChange={setHasDate}
          trackColor={{ true: c.primary, false: c.border }}
        />
      </View>
      {hasDate ? (
        <Field label="Fecha objetivo" error={errors['targetDate']}>
          <DateField value={date} onChange={setDate} />
        </Field>
      ) : null}
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space(2) },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
})
