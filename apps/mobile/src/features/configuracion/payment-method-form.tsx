import { useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import type { PaymentMethod, PaymentMethodType } from '@shared/types'
import { PAYMENT_METHOD_TYPE_LABELS } from '@shared/types'
import { Field, FormScreen } from '@/components/form-screen'
import { ColorPicker } from '@/components/pickers'
import { Chip, TextField } from '@/components/ui'
import type { ApiError } from '@/lib/api'
import { keys, useApiMutation } from '@/lib/hooks'
import { space, useColors } from '@/lib/theme'

const TYPES = Object.entries(PAYMENT_METHOD_TYPE_LABELS) as [PaymentMethodType, string][]

const parseDay = (v: string): number | null => {
  if (!/^\d{1,2}$/.test(v.trim())) return null
  const n = Number(v)
  return n >= 1 && n <= 31 ? n : null
}

export function PaymentMethodForm({ method }: { method: PaymentMethod | null }) {
  const c = useColors()
  const [name, setName] = useState(method?.name ?? '')
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? 'tarjeta_credito')
  const [closingDay, setClosingDay] = useState(method?.closingDay?.toString() ?? '')
  const [dueDay, setDueDay] = useState(method?.dueDay?.toString() ?? '')
  const [color, setColor] = useState(method?.color ?? '#3b82f6')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const options = {
    invalidate: [keys.paymentMethods, keys.cards],
    toastErrors: false,
    onSuccess: () => router.back(),
  }
  const create = useApiMutation('paymentMethods:create', {
    ...options,
    success: 'Medio de pago creado',
  })
  const update = useApiMutation('paymentMethods:update', {
    ...options,
    success: 'Medio de pago guardado',
  })
  const isCard = type === 'tarjeta_credito'

  const submit = () => {
    const next: Record<string, string> = {}
    if (!name.trim()) next['name'] = 'Poné un nombre'
    const closing = parseDay(closingDay)
    const due = dueDay.trim() === '' ? null : parseDay(dueDay)
    if (isCard && closing === null) next['closingDay'] = 'Día entre 1 y 31'
    if (isCard && dueDay.trim() !== '' && due === null) next['dueDay'] = 'Día entre 1 y 31'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    const data = {
      name: name.trim(),
      type,
      closingDay: isCard ? closing : null,
      dueDay: isCard ? due : null,
      color,
    }
    const onError = (err: ApiError) => {
      setErrors({ name: err.message, ...err.fields })
    }
    if (method) update.mutate({ id: method.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <FormScreen
      title={method ? 'Editar medio de pago' : 'Nuevo medio de pago'}
      description="Las tarjetas de crédito imputan el gasto en el mes en que pagás el resumen."
      onSave={submit}
      saving={create.isPending || update.isPending}
    >
      <Field label="Nombre" error={errors['name']}>
        <TextField
          autoFocus={!method}
          value={name}
          maxLength={60}
          invalid={Boolean(errors['name'])}
          onChangeText={setName}
        />
      </Field>
      <Field label="Tipo">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
          {TYPES.map(([value, label]) => (
            <Chip
              key={value}
              label={label}
              selected={type === value}
              onPress={() => setType(value)}
            />
          ))}
        </View>
      </Field>
      {isCard ? (
        <>
          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <View style={{ flex: 1 }}>
              <Field label="Día de cierre" error={errors['closingDay']}>
                <TextField
                  value={closingDay}
                  keyboardType="number-pad"
                  placeholder="25"
                  invalid={Boolean(errors['closingDay'])}
                  onChangeText={setClosingDay}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Día de vencimiento" error={errors['dueDay']}>
                <TextField
                  value={dueDay}
                  keyboardType="number-pad"
                  placeholder="5"
                  invalid={Boolean(errors['dueDay'])}
                  onChangeText={setDueDay}
                />
              </Field>
            </View>
          </View>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            Lo comprado hasta el día de cierre se paga el mes siguiente; lo posterior, dos meses
            después. El vencimiento es sólo informativo (suele ser los primeros días del mes).
          </Text>
        </>
      ) : null}
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
    </FormScreen>
  )
}
