import { useState } from 'react'
import { Alert, StyleSheet, Switch, Text, View } from 'react-native'
import { router } from 'expo-router'
import { currentMonth, type Month } from '@shared/months'
import type { ExpenseGroup, RecurringTemplate } from '@shared/types'
import { Field, FormScreen } from '@/components/form-screen'
import { GroupChips } from '@/components/group-chips'
import { MoneyField } from '@/components/money-field'
import { MonthStepper } from '@/components/month-stepper'
import { PaymentMethodChips } from '@/components/pickers'
import { SubcategoryPicker } from '@/components/subcategory-picker'
import { FieldError, TextField } from '@/components/ui'
import type { ApiError } from '@/lib/api'
import { useCatalog } from '@/lib/catalog'
import { keys, movementKeys, useApiMutation } from '@/lib/hooks'
import { radius, space, useColors } from '@/lib/theme'

export function RecurringForm({ template }: { template: RecurringTemplate | null }) {
  const c = useColors()
  const { paymentMethods } = useCatalog()
  const [description, setDescription] = useState(template?.description ?? '')
  const [subcategoryId, setSubcategoryId] = useState<number | null>(template?.subcategoryId ?? null)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(
    () => template?.paymentMethodId ?? paymentMethods.find((m) => !m.archived)?.id ?? null,
  )
  const [amount, setAmount] = useState<number | null>(template?.defaultAmountCents ?? null)
  const [amountValid, setAmountValid] = useState(true)
  const [day, setDay] = useState(String(template?.dayOfMonth ?? 1))
  const [startMonth, setStartMonth] = useState<Month>(template?.startMonth ?? currentMonth())
  const [hasEnd, setHasEnd] = useState(template?.endMonth != null)
  const [endMonth, setEndMonth] = useState<Month>(template?.endMonth ?? currentMonth())
  const [active, setActive] = useState(template?.active ?? true)
  const [group, setGroup] = useState<ExpenseGroup | null>(template?.group ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const options = {
    invalidate: [keys.recurring, ...movementKeys],
    toastErrors: false,
    onSuccess: () => router.back(),
  }
  const create = useApiMutation('recurring:create', { ...options, success: 'Gasto fijo creado' })
  const update = useApiMutation('recurring:update', { ...options, success: 'Gasto fijo guardado' })
  const remove = useApiMutation('recurring:remove', {
    invalidate: [keys.recurring, ...movementKeys],
    success: 'Gasto fijo borrado',
    onSuccess: () => router.back(),
  })

  const submit = () => {
    const next: Record<string, string> = {}
    const dayNum = /^\d{1,2}$/.test(day) ? Number(day) : NaN
    if (!description.trim()) next['description'] = 'Poné un nombre'
    if (subcategoryId === null) next['subcategoryId'] = 'Elegí una categoría'
    if (paymentMethodId === null) next['paymentMethodId'] = 'Elegí un medio de pago'
    if (!amountValid) next['defaultAmountCents'] = 'Monto inválido'
    if (!(dayNum >= 1 && dayNum <= 31)) next['dayOfMonth'] = 'Entre 1 y 31'
    if (hasEnd && endMonth < startMonth) next['endMonth'] = 'Tiene que ser posterior al inicio'
    setErrors(next)
    if (Object.keys(next).length > 0 || subcategoryId === null || paymentMethodId === null) return
    const data = {
      description: description.trim(),
      subcategoryId,
      paymentMethodId,
      defaultAmountCents: amount,
      dayOfMonth: dayNum,
      startMonth,
      endMonth: hasEnd ? endMonth : null,
      active,
      group,
    }
    const onError = (err: ApiError) => {
      setErrors({ _: err.message, ...err.fields })
    }
    if (template) update.mutate({ id: template.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  const confirmDelete = () => {
    if (!template) return
    Alert.alert(
      `¿Borrar "${template.description}"?`,
      'Deja de generarse. Los gastos que ya se cargaron quedan como están. Si sólo querés pausarlo, desactivalo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => remove.mutate({ id: template.id }) },
      ],
    )
  }

  return (
    <FormScreen
      title={template ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}
      description="Se genera solo una vez por mes. Sin monto, queda pendiente para que lo completes."
      onSave={submit}
      saving={create.isPending || update.isPending}
      onDelete={template ? confirmDelete : undefined}
      deleteLabel="Borrar gasto fijo"
      error={errors['_']}
    >
      <Field label="Nombre" error={errors['description']}>
        <TextField
          autoFocus={!template}
          value={description}
          placeholder="Alquiler"
          maxLength={120}
          invalid={Boolean(errors['description'])}
          onChangeText={setDescription}
        />
      </Field>
      <Field label="Categoría" error={errors['subcategoryId']}>
        <SubcategoryPicker value={subcategoryId} onChange={setSubcategoryId} />
      </Field>
      <Field label="Monto por defecto" error={errors['defaultAmountCents']}>
        <MoneyField
          value={amount}
          placeholder="Vacío = pendiente"
          onValueChange={(cents, v) => {
            setAmount(cents)
            setAmountValid(v)
          }}
        />
      </Field>
      <Field label="Medio de pago" error={errors['paymentMethodId']}>
        <PaymentMethodChips
          methods={paymentMethods}
          value={paymentMethodId}
          onChange={setPaymentMethodId}
        />
      </Field>
      <Field label="Día del mes" error={errors['dayOfMonth']}>
        <TextField
          value={day}
          keyboardType="number-pad"
          style={{ width: 100 }}
          invalid={Boolean(errors['dayOfMonth'])}
          onChangeText={setDay}
        />
      </Field>
      <Field label="Desde">
        <MonthStepper size="sm" value={startMonth} onChange={setStartMonth} />
      </Field>
      <GroupChips value={group} onChange={setGroup} error={errors['group']} />
      <View style={[styles.box, { borderColor: c.border }]}>
        <View style={styles.switchRow}>
          <Text style={{ color: c.foreground, fontSize: 15 }}>Termina</Text>
          <Switch
            accessibilityLabel="Termina"
            value={hasEnd}
            onValueChange={setHasEnd}
            trackColor={{ true: c.primary, false: c.border }}
            thumbColor="#ffffff"
          />
        </View>
        {hasEnd ? <MonthStepper size="sm" value={endMonth} onChange={setEndMonth} /> : null}
        <FieldError message={errors['endMonth']} />
      </View>
      <View style={[styles.box, { borderColor: c.border }]}>
        <View style={styles.switchRow}>
          <Text style={{ color: c.foreground, fontSize: 15 }}>Activo</Text>
          <Switch
            accessibilityLabel="Activo"
            value={active}
            onValueChange={setActive}
            trackColor={{ true: c.primary, false: c.border }}
            thumbColor="#ffffff"
          />
        </View>
      </View>
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: space(3), gap: space(2) },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
