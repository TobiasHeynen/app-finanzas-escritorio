import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { CheckCircle2, Circle } from 'lucide-react-native'
import { formatMoney } from '@shared/money'
import { compareMonths, currentMonth, formatMonthShort } from '@shared/months'
import type { InstallmentPlan, PlanScope } from '@shared/types'
import { ChoiceSheet } from '@/components/choice-sheet'
import { Field, FormScreen } from '@/components/form-screen'
import { Money } from '@/components/money'
import { MoneyField } from '@/components/money-field'
import { PaymentMethodChips } from '@/components/pickers'
import { Progress } from '@/components/progress'
import { SubcategoryPicker } from '@/components/subcategory-picker'
import { TextField } from '@/components/ui'
import { useCatalog } from '@/lib/catalog'
import { movementKeys, useApiMutation } from '@/lib/hooks'
import { useDeletePlan } from '@/lib/movements'
import { radius, space, useColors } from '@/lib/theme'

type Confirm = 'save' | 'delete' | null

/** Detalle y edición de una compra en cuotas (en la PC es el diálogo "Compra en cuotas"). */
export function PlanForm({ plan }: { plan: InstallmentPlan }) {
  const c = useColors()
  const { paymentMethods } = useCatalog()
  const [subcategoryId, setSubcategoryId] = useState<number | null>(plan.subcategoryId)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(plan.paymentMethodId)
  const [description, setDescription] = useState(plan.description)
  const [total, setTotal] = useState<number | null>(plan.totalCents)
  const [totalValid, setTotalValid] = useState(true)
  const [count, setCount] = useState(String(plan.installmentsCount))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<Confirm>(null)

  const update = useApiMutation('plans:update', {
    invalidate: movementKeys,
    success: 'Cuotas actualizadas',
    toastErrors: false,
    onSuccess: () => router.back(),
  })
  const remove = useDeletePlan()

  const current = currentMonth()
  const paid = plan.installments.filter((i) => compareMonths(i.month, current) <= 0)
  const future = plan.installments.filter((i) => compareMonths(i.month, current) > 0)
  const countNum = /^\d+$/.test(count) ? Number(count) : NaN
  const firstNumber = plan.installments[0]?.number ?? 1
  const paidCount = paid.at(-1)?.number ?? firstNumber - 1

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!totalValid || total === null || total <= 0) next['totalCents'] = 'Total inválido'
    if (!(countNum >= 2 && countNum <= 120)) next['installmentsCount'] = 'Entre 2 y 120'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = (scope: PlanScope) => {
    if (subcategoryId === null || paymentMethodId === null || total === null) return
    update.mutate(
      {
        id: plan.id,
        scope,
        data: {
          subcategoryId,
          paymentMethodId,
          description: description.trim(),
          totalCents: total,
          installmentsCount: countNum,
          notes: null,
        },
      },
      { onError: (err) => setErrors({ _: err.message, ...err.fields }) },
    )
  }

  const del = (scope: PlanScope) => {
    remove.mutate({ id: plan.id, scope }, { onSuccess: () => router.back() })
  }

  return (
    <FormScreen
      title="Compra en cuotas"
      description={`${plan.description || 'Sin detalle'} · ${formatMoney(plan.totalCents)} en ${String(plan.installmentsCount)} cuotas`}
      onSave={() => {
        if (validate()) setConfirm('save')
      }}
      saving={update.isPending}
      onDelete={plan.installments.length > 0 ? () => setConfirm('delete') : undefined}
      deleteLabel="Borrar cuotas"
      error={errors['_']}
    >
      <View style={{ gap: space(1.5) }}>
        <View style={styles.between}>
          <Text style={{ color: c.mutedForeground, fontSize: 14 }}>Pagadas</Text>
          <Text style={[styles.strong, { color: c.foreground }]} testID="plan-paid">
            {paidCount} de {plan.installmentsCount}
          </Text>
        </View>
        <Progress value={(paidCount / plan.installmentsCount) * 100} height={8} />
      </View>

      <Field label="Categoría">
        <SubcategoryPicker value={subcategoryId} onChange={setSubcategoryId} />
      </Field>
      <Field label="Medio de pago">
        <PaymentMethodChips
          methods={paymentMethods}
          value={paymentMethodId}
          onChange={setPaymentMethodId}
        />
      </Field>
      <Field label="Detalle">
        <TextField value={description} maxLength={200} onChangeText={setDescription} />
      </Field>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Total" error={errors['totalCents']}>
            <MoneyField
              value={total}
              invalid={Boolean(errors['totalCents'])}
              onValueChange={(cents, v) => {
                setTotal(cents)
                setTotalValid(v)
              }}
            />
          </Field>
        </View>
        <View style={{ width: 110 }}>
          <Field label="Cuotas" error={errors['installmentsCount']}>
            <TextField
              accessibilityLabel="Cantidad de cuotas"
              value={count}
              keyboardType="number-pad"
              invalid={Boolean(errors['installmentsCount'])}
              onChangeText={setCount}
            />
          </Field>
        </View>
      </View>

      <Field label="Cuotas">
        <View style={[styles.list, { borderColor: c.border }]}>
          {plan.installments.map((i) => {
            const isPaid = compareMonths(i.month, current) <= 0
            return (
              <View
                key={i.expenseId}
                testID="plan-installment"
                style={[styles.item, i.month === current && { backgroundColor: c.accent }]}
              >
                {isPaid ? (
                  <CheckCircle2 color={c.positive} size={15} />
                ) : (
                  <Circle color={c.mutedForeground} size={15} />
                )}
                <Text style={[styles.num, { color: c.foreground }]}>
                  {i.number}/{plan.installmentsCount}
                </Text>
                <Text style={[styles.month, { color: c.mutedForeground }]}>
                  {formatMonthShort(i.month)}
                </Text>
                <Money cents={i.amountCents} style={{ fontSize: 14 }} />
              </View>
            )
          })}
          {plan.installments.length === 0 ? (
            <Text style={{ color: c.mutedForeground, padding: space(2) }}>No quedan cuotas.</Text>
          ) : null}
        </View>
      </Field>

      <ChoiceSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm === 'delete' ? '¿Qué cuotas querés borrar?' : '¿A qué cuotas aplicás el cambio?'
        }
        description={
          confirm === 'delete'
            ? `Las futuras son las que vencen después de este mes (${String(future.length)}). Si cancelaste la compra, borrá sólo las futuras.`
            : `Sólo las futuras: las ${String(paid.length)} cuotas ya pagadas quedan igual y el resto del total se reparte entre las que faltan, hasta completar ${String(countNum)} cuotas.`
        }
        choices={[
          {
            label: 'Sólo las futuras',
            disabled: confirm === 'delete' && future.length === 0,
            onPress: () => (confirm === 'delete' ? del('future') : save('future')),
          },
          {
            label: 'Todas',
            variant: confirm === 'delete' ? 'destructive' : 'primary',
            onPress: () => (confirm === 'delete' ? del('all') : save('all')),
          },
        ]}
      />
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  strong: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: space(3) },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space(1) },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(2),
    paddingVertical: space(1.5),
    borderRadius: radius.sm,
  },
  num: { width: 48, fontSize: 14, fontVariant: ['tabular-nums'] },
  month: { flex: 1, fontSize: 14, textTransform: 'capitalize' },
})
