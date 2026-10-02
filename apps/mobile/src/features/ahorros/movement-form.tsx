import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { formatMoney, impliedRate, usdToArs, type Currency } from '@shared/money'
import { isIsoDate, monthOf, todayIso, type Month } from '@shared/months'
import type { SavingsGoal } from '@shared/types'
import { DateField } from '@/components/date-field'
import { Field, FormScreen } from '@/components/form-screen'
import { MoneyField } from '@/components/money-field'
import { MonthStepper } from '@/components/month-stepper'
import { Chip, FieldError, TextField } from '@/components/ui'
import { call, type ApiError } from '@/lib/api'
import { movementKeys, useApiMutation } from '@/lib/hooks'
import { useUndoToast } from '@/lib/movements'
import { radius, space, useColors } from '@/lib/theme'
import type { MovementKind, MovementTarget } from './open'

export function MovementForm({ target, goals }: { target: MovementTarget; goals: SavingsGoal[] }) {
  const c = useColors()
  const { movement, defaults } = target
  const [kind, setKind] = useState<MovementKind>(
    movement ? (movement.amountMinor > 0 ? 'aporte' : 'retiro') : (defaults?.kind ?? 'aporte'),
  )
  const [currency, setCurrency] = useState<Currency>(
    movement?.currency ?? defaults?.currency ?? 'ARS',
  )
  const [amount, setAmount] = useState<number | null>(
    movement ? Math.abs(movement.amountMinor) : null,
  )
  const [ars, setArs] = useState<number | null>(movement?.arsCostCents ?? null)
  const [rate, setRate] = useState<number | null>(movement?.rateCentsPerUsd ?? null)
  const [invalid, setInvalid] = useState<Record<string, boolean>>({})
  const [date, setDate] = useState(movement?.date ?? todayIso())
  const [month, setMonth] = useState<Month>(movement?.month ?? monthOf(todayIso()))
  const [goalId, setGoalId] = useState<number | null>(movement?.goalId ?? defaults?.goalId ?? null)
  const [note, setNote] = useState(movement?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const goalOptions = goals.filter(
    (g) => g.currency === currency && (!g.archived || g.id === goalId),
  )
  const isUsd = currency === 'USD'

  // Pesos ↔ cotización: si cambia el monto o la cotización se recalculan los pesos;
  // si se escriben los pesos, se recalcula la cotización.
  const recalcArs = (usd: number | null, r: number | null) => {
    if (usd !== null && usd > 0 && r !== null && r > 0) setArs(usdToArs(usd, r))
  }
  const recalcRate = (usd: number | null, a: number | null) => {
    setRate(usd !== null && usd > 0 && a !== null && a > 0 ? impliedRate(a, usd) : null)
  }

  const options = { invalidate: movementKeys, toastErrors: false, onSuccess: () => router.back() }
  const create = useApiMutation('savings:createMovement', {
    ...options,
    success: (_d, input) => (input.kind === 'aporte' ? 'Aporte guardado' : 'Retiro guardado'),
  })
  const update = useApiMutation('savings:updateMovement', {
    ...options,
    success: 'Movimiento actualizado',
  })
  const undoToast = useUndoToast()
  const remove = useApiMutation('savings:removeMovement', {
    invalidate: movementKeys,
    onSuccess: (_d, { id }) => {
      router.back()
      undoToast('Movimiento borrado', () => call('savings:restoreMovement', { id }))
    },
  })

  const submit = () => {
    const next: Record<string, string> = {}
    if (invalid['amount'] || amount === null || amount === 0) next['amountMinor'] = 'Poné el monto'
    if (isUsd && (invalid['ars'] || invalid['rate'])) next['arsCents'] = 'Revisá los pesos'
    if (!isIsoDate(date)) next['date'] = 'Fecha inválida'
    setErrors(next)
    if (Object.keys(next).length > 0 || amount === null) return
    const data = {
      kind,
      currency,
      amountMinor: amount,
      arsCents: isUsd ? ars : null,
      date,
      month,
      goalId,
      note: note.trim(),
    }
    const onError = (err: ApiError) => {
      setErrors({ _: err.message, ...err.fields })
    }
    if (movement) update.mutate({ id: movement.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <FormScreen
      title={movement ? 'Editar movimiento' : 'Movimiento de ahorro'}
      description={
        isUsd
          ? kind === 'aporte'
            ? 'Compra de dólares: los pesos que pagaste salen del disponible del mes.'
            : 'Venta de dólares: los pesos que recibiste suman al disponible del mes.'
          : kind === 'aporte'
            ? 'Lo que guardás sale del disponible del mes.'
            : 'Lo que sacás del ahorro suma al disponible del mes.'
      }
      onSave={submit}
      saving={create.isPending || update.isPending}
      onDelete={movement ? () => remove.mutate({ id: movement.id }) : undefined}
      deleteLabel="Borrar movimiento"
      error={errors['_']}
    >
      <View style={styles.toggles}>
        <View style={styles.toggle}>
          <Chip
            label={isUsd ? 'Compra' : 'Aporte'}
            selected={kind === 'aporte'}
            onPress={() => setKind('aporte')}
          />
          <Chip
            label={isUsd ? 'Venta' : 'Retiro'}
            selected={kind === 'retiro'}
            onPress={() => setKind('retiro')}
          />
        </View>
        <View style={styles.toggle}>
          {(['ARS', 'USD'] as const).map((cur) => (
            <Chip
              key={cur}
              label={cur === 'ARS' ? 'Pesos' : 'Dólares'}
              selected={currency === cur}
              onPress={() => {
                setCurrency(cur)
                setGoalId(null)
              }}
            />
          ))}
        </View>
      </View>

      <Field label={isUsd ? 'Dólares' : 'Monto'} error={errors['amountMinor']}>
        <MoneyField
          large
          autoFocus={!movement}
          currency={currency}
          value={amount}
          invalid={Boolean(errors['amountMinor'])}
          onValueChange={(cents, v) => {
            setAmount(cents)
            setInvalid((s) => ({ ...s, amount: !v }))
            if (isUsd) recalcArs(cents, rate)
          }}
        />
      </Field>

      {isUsd ? (
        <View style={[styles.usd, { backgroundColor: c.muted }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Cotización">
                <MoneyField
                  value={rate}
                  placeholder="1.250"
                  onValueChange={(cents, v) => {
                    setRate(cents)
                    setInvalid((s) => ({ ...s, rate: !v }))
                    recalcArs(amount, cents)
                  }}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={kind === 'aporte' ? 'Pesos pagados' : 'Pesos recibidos'}>
                <MoneyField
                  value={ars}
                  invalid={Boolean(errors['arsCents'])}
                  onValueChange={(cents, v) => {
                    setArs(cents)
                    setInvalid((s) => ({ ...s, ars: !v }))
                    recalcRate(amount, cents)
                  }}
                />
              </Field>
            </View>
          </View>
          <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
            {ars !== null && ars > 0 && rate !== null
              ? `${formatMoney(ars)} a ${formatMoney(rate)} por dólar.`
              : 'Dejalo vacío si no salieron pesos (por ejemplo, un cobro en dólares).'}
          </Text>
          <FieldError message={errors['arsCents']} />
        </View>
      ) : null}

      <Field label="Fecha" error={errors['date']}>
        <DateField
          value={date}
          onChange={(d) => {
            setDate(d)
            setMonth(monthOf(d))
          }}
        />
      </Field>
      <Field label="Cuenta en">
        <MonthStepper size="sm" value={month} onChange={setMonth} />
      </Field>
      <Field label="Meta" error={errors['goalId']}>
        <View style={styles.wrap}>
          <Chip label="Sin meta" selected={goalId === null} onPress={() => setGoalId(null)} />
          {goalOptions.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={goalId === g.id}
              onPress={() => setGoalId(g.id)}
            />
          ))}
        </View>
      </Field>
      <Field label="Nota">
        <TextField value={note} maxLength={200} placeholder="Opcional" onChangeText={setNote} />
      </Field>
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  toggles: { gap: space(2) },
  toggle: { flexDirection: 'row', gap: space(2) },
  usd: { borderRadius: radius.md, padding: space(3), gap: space(2) },
  row: { flexDirection: 'row', gap: space(3) },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
})
