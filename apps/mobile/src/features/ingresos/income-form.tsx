import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { dateInMonth, isIsoDate, monthOf, todayIso, type Month } from '@shared/months'
import type { IncomeType } from '@shared/types'
import { INCOME_TYPE_LABELS } from '@shared/types'
import { DateField } from '@/components/date-field'
import { Field, FormScreen } from '@/components/form-screen'
import { MoneyField } from '@/components/money-field'
import { MonthStepper } from '@/components/month-stepper'
import { Chip, TextField } from '@/components/ui'
import { call, type ApiError } from '@/lib/api'
import { movementKeys, useApiMutation } from '@/lib/hooks'
import { useUndoToast } from '@/lib/movements'
import { space } from '@/lib/theme'
import type { IncomeTarget } from './incomes-card'

function defaultDate(month: Month): string {
  const today = todayIso()
  return monthOf(today) === month ? today : dateInMonth(month, 1)
}

export function IncomeForm({ income, month }: IncomeTarget) {
  const [type, setType] = useState<IncomeType>(income?.type ?? 'sueldo')
  const [amount, setAmount] = useState<number | null>(income?.amountCents ?? null)
  const [valid, setValid] = useState(true)
  const [date, setDate] = useState(() => income?.date ?? defaultDate(month))
  const [incomeMonth, setIncomeMonth] = useState<Month>(income?.month ?? month)
  const [description, setDescription] = useState(income?.description ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const options = {
    invalidate: movementKeys,
    toastErrors: false,
    onSuccess: () => router.back(),
  }
  const create = useApiMutation('incomes:create', { ...options, success: 'Ingreso guardado' })
  const update = useApiMutation('incomes:update', { ...options, success: 'Ingreso actualizado' })
  const undoToast = useUndoToast()
  const remove = useApiMutation('incomes:remove', {
    invalidate: movementKeys,
    onSuccess: (_d, { id }) => {
      router.back()
      undoToast('Ingreso borrado', () => call('incomes:restore', { id }))
    },
  })

  const submit = () => {
    const next: Record<string, string> = {}
    if (!valid || amount === null) next['amountCents'] = 'Poné el monto'
    if (!isIsoDate(date)) next['date'] = 'Fecha inválida'
    setErrors(next)
    if (Object.keys(next).length > 0 || amount === null) return
    const data = {
      type,
      amountCents: amount,
      date,
      month: incomeMonth,
      description: description.trim(),
    }
    const onError = (err: ApiError) => {
      setErrors({ _: err.message, ...err.fields })
    }
    if (income) update.mutate({ id: income.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <FormScreen
      title={income ? 'Editar ingreso' : 'Nuevo ingreso'}
      description="Cuenta en el mes en que lo cobrás."
      onSave={submit}
      saving={create.isPending || update.isPending}
      onDelete={income ? () => remove.mutate({ id: income.id }) : undefined}
      deleteLabel="Borrar ingreso"
      error={Object.keys(errors).length === 1 ? errors['_'] : undefined}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((t) => (
          <Chip
            key={t}
            label={INCOME_TYPE_LABELS[t]}
            selected={type === t}
            onPress={() => setType(t)}
          />
        ))}
      </View>
      <Field label="Monto" error={errors['amountCents']}>
        <MoneyField
          large
          autoFocus={!income}
          value={amount}
          invalid={Boolean(errors['amountCents'])}
          onValueChange={(cents, v) => {
            setAmount(cents)
            setValid(v)
          }}
        />
      </Field>
      <Field label="Fecha de cobro" error={errors['date']}>
        <DateField
          value={date}
          onChange={(d) => {
            setDate(d)
            setIncomeMonth(monthOf(d))
          }}
        />
      </Field>
      <Field label="Cuenta en">
        <MonthStepper size="sm" value={incomeMonth} onChange={setIncomeMonth} />
      </Field>
      <Field label="Detalle">
        <TextField
          value={description}
          maxLength={200}
          placeholder="Opcional"
          onChangeText={setDescription}
        />
      </Field>
    </FormScreen>
  )
}
