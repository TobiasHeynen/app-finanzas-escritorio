import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { isIsoDate, todayIso } from '@shared/months'
import { DateField } from '@/components/date-field'
import { Field, FormScreen } from '@/components/form-screen'
import { MoneyField } from '@/components/money-field'
import { Chip, TextField } from '@/components/ui'
import { movementKeys, useApiMutation } from '@/lib/hooks'
import { space } from '@/lib/theme'
import type { SettleDraft } from './open'

/** Registrar lo que una persona le pasó a otra. No cambia los gastos ni el disponible. */
export function SettleForm({ draft }: { draft: SettleDraft }) {
  const { group } = draft
  const [from, setFrom] = useState(draft.fromMemberId)
  const [to, setTo] = useState(draft.toMemberId)
  const [amount, setAmount] = useState<number | null>(draft.amountCents)
  const [valid, setValid] = useState(true)
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const settle = useApiMutation('groups:settle', {
    invalidate: movementKeys,
    success: 'Pago registrado',
    toastErrors: false,
    onSuccess: () => {
      router.back()
    },
  })
  const members = group.members.filter(
    (m) => !m.archived || m.id === draft.fromMemberId || m.id === draft.toMemberId,
  )

  const submit = () => {
    const next: Record<string, string> = {}
    if (!valid || amount === null || amount <= 0) next['amountCents'] = 'Poné el monto'
    if (from === to) next['toMemberId'] = 'Tienen que ser dos personas distintas'
    if (!isIsoDate(date)) next['date'] = 'Fecha inválida'
    setErrors(next)
    if (Object.keys(next).length > 0 || amount === null) return
    settle.mutate(
      {
        groupId: group.id,
        fromMemberId: from,
        toMemberId: to,
        amountCents: amount,
        date,
        note: note.trim(),
      },
      {
        onError: (err) => {
          setErrors({ _: err.message, ...err.fields })
        },
      },
    )
  }

  const memberChips = (value: number, onChange: (id: number) => void) => (
    <View style={styles.wrap}>
      {members.map((m) => (
        <Chip
          key={m.id}
          label={m.name}
          selected={m.id === value}
          onPress={() => {
            onChange(m.id)
          }}
        />
      ))}
    </View>
  )

  return (
    <FormScreen
      title={`Saldar en ${group.name}`}
      description="Registrá lo que una persona le pasó a otra. No cambia tus gastos ni tu disponible."
      onSave={submit}
      saving={settle.isPending}
      error={errors['_']}
    >
      <Field label="Quién pagó">{memberChips(from, setFrom)}</Field>
      <Field label="A quién" error={errors['toMemberId']}>
        {memberChips(to, setTo)}
      </Field>
      <Field label="Monto" error={errors['amountCents']}>
        <MoneyField
          value={amount}
          invalid={Boolean(errors['amountCents'])}
          onValueChange={(cents, ok) => {
            setAmount(cents)
            setValid(ok)
          }}
        />
      </Field>
      <Field label="Fecha" error={errors['date']}>
        <DateField value={date} onChange={setDate} invalid={Boolean(errors['date'])} />
      </Field>
      <Field label="Nota">
        <TextField
          value={note}
          maxLength={200}
          placeholder="Opcional (ej.: transferencia)"
          onChangeText={setNote}
        />
      </Field>
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
})
