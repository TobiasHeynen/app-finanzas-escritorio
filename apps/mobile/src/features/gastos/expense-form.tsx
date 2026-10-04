import { useMemo, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type TextInput,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CalendarClock, CreditCard, RotateCcw, Trash2, X } from 'lucide-react-native'
import { computeChargeMonth } from '@shared/domain/charge-month'
import { formatMoney, splitInstallments, sumCents } from '@shared/money'
import { formatMonthLong, isIsoDate, monthOf, todayIso, type Month } from '@shared/months'
import type { Expense, ExpenseGroup, ExpenseSplit } from '@shared/types'
import { DateField } from '@/components/date-field'
import { GroupChips } from '@/components/group-chips'
import { PaymentMethodIcon } from '@/components/icons'
import { MoneyField } from '@/components/money-field'
import { MonthStepper } from '@/components/month-stepper'
import { SplitEditor } from '@/components/split-editor'
import { SubcategoryPicker } from '@/components/subcategory-picker'
import { Button, Chip, FieldError, Label, TextField } from '@/components/ui'
import type { ApiError } from '@/lib/api'
import { useCatalog } from '@/lib/catalog'
import { defaultSplit, useGroupsIndex } from '@/lib/groups'
import { movementKeys, useApiMutation } from '@/lib/hooks'
import { useDeleteExpense } from '@/lib/movements'
import { readLastMethod, rememberMethod, rememberPayer } from '@/lib/prefs'
import { radius, space, useColors } from '@/lib/theme'
import type { ExpenseDefaults } from './open-expense'

const COUNTS = ['3', '6', '9', '12', '18']

/** Alta y edición de un gasto (o compra en cuotas). Mismas reglas que el diálogo de la PC. */
export function ExpenseForm({
  expense,
  defaults,
}: {
  expense: Expense | null
  defaults: ExpenseDefaults | undefined
}) {
  const c = useColors()
  const { paymentMethods, paymentMethodById } = useCatalog()
  const amountRef = useRef<TextInput>(null)

  const [amount, setAmount] = useState<number | null>(
    expense ? expense.amountCents : (defaults?.amountCents ?? null),
  )
  const [amountValid, setAmountValid] = useState(true)
  const [subcategoryId, setSubcategoryId] = useState<number | null>(
    expense?.subcategoryId ?? defaults?.subcategoryId ?? null,
  )
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(() => {
    if (expense) return expense.paymentMethodId
    const last = defaults?.paymentMethodId ?? readLastMethod()
    if (last !== null && paymentMethodById.get(last)?.archived === false) return last
    return paymentMethods.find((m) => !m.archived)?.id ?? null
  })
  const [purchaseDate, setPurchaseDate] = useState(
    expense?.purchaseDate ?? defaults?.purchaseDate ?? todayIso(),
  )
  const [description, setDescription] = useState(
    expense?.description ?? defaults?.description ?? '',
  )
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [group, setGroup] = useState<ExpenseGroup | null>(
    expense?.group
      ? { groupId: expense.group.groupId, paidByMemberId: expense.group.paidByMemberId }
      : null,
  )
  /** null = partes iguales entre todos (lo que propone core si no viene reparto). */
  const [split, setSplit] = useState<ExpenseSplit | null>(expense?.group?.split ?? null)
  const groupsIndex = useGroupsIndex()
  const groupEntity = group ? groupsIndex.groupById.get(group.groupId) : undefined
  const [inInstallments, setInInstallments] = useState(false)
  const showSplit = Boolean(groupEntity) && !inInstallments
  const [count, setCount] = useState('3')
  const [startAt, setStartAt] = useState('1')
  const [override, setOverride] = useState<Month | null>(
    expense?.chargeMonthLocked ? expense.chargeMonth : null,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const method = paymentMethodId !== null ? paymentMethodById.get(paymentMethodId) : undefined
  const isCard = method?.type === 'tarjeta_credito'
  const dateValid = isIsoDate(purchaseDate)
  const countNum = /^\d+$/.test(count) ? Number(count) : NaN
  const startNum = /^\d+$/.test(startAt) ? Number(startAt) : NaN

  const computedMonth = useMemo<Month | null>(() => {
    if (!method || !dateValid) return null
    if (inInstallments && startNum > 1) return monthOf(todayIso())
    return computeChargeMonth(purchaseDate, method)
  }, [method, dateValid, purchaseDate, inInstallments, startNum])
  const effectiveMonth = override ?? computedMonth

  const installmentPreview = useMemo(() => {
    if (!inInstallments || amount === null || amount <= 0) return null
    if (!(countNum >= 2 && countNum <= 120)) return null
    const start = startNum >= 1 && startNum <= countNum ? startNum : 1
    const parts = splitInstallments(amount, countNum)
    const first = parts[0] ?? 0
    const rest = parts[1] ?? 0
    const remaining = countNum - start + 1
    const when = effectiveMonth ? ` desde ${formatMonthLong(effectiveMonth)}` : ''
    const amounts =
      first === rest || start > 1
        ? `${String(remaining)} cuota${remaining === 1 ? '' : 's'} de ${formatMoney(rest)}`
        : `1 cuota de ${formatMoney(first)} y ${String(countNum - 1)} de ${formatMoney(rest)}`
    return start > 1
      ? `Vas por la ${String(start)}/${String(countNum)}: quedan ${amounts}${when}`
      : `${amounts}${when}`
  }, [inInstallments, amount, countNum, startNum, effectiveMonth])

  const fieldErrors = (err: ApiError) => {
    setErrors({ _: err.message, ...err.fields })
  }

  const resetForNext = () => {
    setAmount(null)
    setAmountValid(true)
    setDescription('')
    setNotes('')
    setSplit(null)
    setErrors({})
    amountRef.current?.focus()
  }

  const onDone = (another: boolean) => {
    if (paymentMethodId !== null) rememberMethod(paymentMethodId)
    rememberPayer(group)
    if (another) resetForNext()
    else router.back()
  }

  const create = useApiMutation('expenses:create', {
    invalidate: movementKeys,
    success: (e) => (e.amountCents === null ? 'Gasto pendiente guardado' : 'Gasto guardado'),
    toastErrors: false,
  })
  const update = useApiMutation('expenses:update', {
    invalidate: movementKeys,
    success: 'Gasto actualizado',
    toastErrors: false,
  })
  const createPlan = useApiMutation('plans:create', {
    invalidate: movementKeys,
    success: (p) => `Compra en ${String(p.installmentsCount)} cuotas guardada`,
    toastErrors: false,
  })
  const remove = useDeleteExpense()
  const saving = create.isPending || update.isPending || createPlan.isPending

  const submit = (another: boolean) => {
    const next: Record<string, string> = {}
    if (!amountValid) next['amountCents'] = 'Monto inválido (ej.: 1.234,56)'
    if (subcategoryId === null) next['subcategoryId'] = 'Elegí una categoría'
    if (paymentMethodId === null) next['paymentMethodId'] = 'Elegí un medio de pago'
    if (!dateValid) next['purchaseDate'] = 'Fecha inválida'
    if (inInstallments) {
      if (amount === null || amount <= 0) next['amountCents'] = 'Poné el total de la compra'
      if (!(countNum >= 2 && countNum <= 120)) next['installmentsCount'] = 'Entre 2 y 120 cuotas'
      else if (!(startNum >= 1 && startNum <= countNum))
        next['startAtInstallment'] = `Entre 1 y ${String(countNum)}`
    }
    if (showSplit && split?.kind === 'equal' && split.memberIds.length === 0)
      next['split'] = 'Elegí al menos una persona'
    if (
      showSplit &&
      split?.kind === 'custom' &&
      sumCents(split.shares.map((x) => x.cents)) !== amount
    )
      next['split'] = 'Las partes tienen que sumar el monto'
    setErrors(next)
    if (Object.keys(next).length > 0 || subcategoryId === null || paymentMethodId === null) return

    const common = {
      subcategoryId,
      paymentMethodId,
      description: description.trim(),
      purchaseDate,
      notes: notes.trim() || null,
      group,
    }
    const withSplit = { ...common, group: group && split ? { ...group, split } : group }
    const options = { onSuccess: () => onDone(another), onError: fieldErrors }
    if (inInstallments && amount !== null) {
      createPlan.mutate(
        {
          ...common,
          totalCents: amount,
          installmentsCount: countNum,
          startAtInstallment: startNum,
          firstChargeMonthOverride: override,
        },
        options,
      )
    } else if (expense) {
      update.mutate(
        {
          id: expense.id,
          data: { ...withSplit, amountCents: amount, chargeMonthOverride: override },
        },
        options,
      )
    } else {
      create.mutate({ ...withSplit, amountCents: amount, chargeMonthOverride: override }, options)
    }
  }

  const visibleMethods = paymentMethods.filter((m) => !m.archived || m.id === paymentMethodId)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Button
            variant="ghost"
            icon={<X color={c.foreground} size={22} />}
            accessibilityLabel="Cerrar"
            onPress={() => router.back()}
          />
          <Text style={[styles.title, { color: c.foreground }]}>
            {expense ? 'Editar gasto' : 'Nuevo gasto'}
          </Text>
          {expense ? (
            <Button
              variant="ghost"
              icon={<Trash2 color={c.negative} size={20} />}
              accessibilityLabel="Borrar gasto"
              onPress={() => remove.mutate({ id: expense.id }, { onSuccess: () => router.back() })}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          <View style={styles.field}>
            <Label>{inInstallments ? 'Total de la compra' : 'Monto'}</Label>
            <MoneyField
              inputRef={amountRef}
              large
              autoFocus={!expense || expense.amountCents === null}
              value={amount}
              placeholder={inInstallments ? '0' : 'Vacío = pendiente'}
              invalid={Boolean(errors['amountCents'])}
              onValueChange={(cents, valid) => {
                setAmount(cents)
                setAmountValid(valid)
              }}
            />
            <FieldError message={errors['amountCents']} />
          </View>

          <View style={styles.field}>
            <Label>Categoría</Label>
            <SubcategoryPicker
              value={subcategoryId}
              onChange={setSubcategoryId}
              invalid={Boolean(errors['subcategoryId'])}
            />
            <FieldError message={errors['subcategoryId']} />
          </View>

          <View style={styles.field}>
            <Label>Medio de pago</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                {visibleMethods.map((m) => (
                  <Chip
                    key={m.id}
                    label={m.name}
                    selected={m.id === paymentMethodId}
                    icon={<PaymentMethodIcon method={m} size={16} />}
                    onPress={() => {
                      setPaymentMethodId(m.id)
                      setOverride(null)
                    }}
                  />
                ))}
              </View>
            </ScrollView>
            <FieldError message={errors['paymentMethodId']} />
          </View>

          <View style={styles.field}>
            <Label>Fecha</Label>
            <DateField
              value={purchaseDate}
              invalid={Boolean(errors['purchaseDate'])}
              onChange={(d) => {
                setPurchaseDate(d)
                setOverride(null)
              }}
            />
            <FieldError message={errors['purchaseDate']} />
          </View>

          <View style={styles.field}>
            <Label>Detalle</Label>
            <TextField
              value={description}
              maxLength={200}
              placeholder="Opcional"
              onChangeText={setDescription}
            />
          </View>

          <GroupChips
            value={group}
            onChange={(g) => {
              if (g?.groupId !== group?.groupId) setSplit(null)
              setGroup(g)
            }}
            error={errors['group']}
          />
          {showSplit && groupEntity ? (
            <SplitEditor
              group={groupEntity}
              amount={amount}
              value={split ?? defaultSplit(groupEntity)}
              onChange={setSplit}
              error={errors['split']}
            />
          ) : null}

          {!expense ? (
            <View style={[styles.box, { borderColor: c.border, backgroundColor: c.muted }]}>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <CreditCard color={c.mutedForeground} size={18} />
                  <Text style={{ color: c.foreground, fontSize: 15 }}>En cuotas</Text>
                </View>
                <Switch
                  accessibilityLabel="En cuotas"
                  value={inInstallments}
                  trackColor={{ true: c.primary, false: c.border }}
                  thumbColor="#ffffff"
                  onValueChange={(v) => {
                    setInInstallments(v)
                    setOverride(null)
                  }}
                />
              </View>
              {inInstallments ? (
                <View style={{ gap: space(3) }}>
                  <View style={styles.field}>
                    <Label>Cantidad de cuotas</Label>
                    <View style={styles.chips}>
                      {COUNTS.map((n) => (
                        <Chip
                          key={n}
                          label={n}
                          selected={count === n}
                          onPress={() => setCount(n)}
                        />
                      ))}
                      <TextField
                        value={COUNTS.includes(count) ? '' : count}
                        onChangeText={setCount}
                        keyboardType="number-pad"
                        placeholder="Otra"
                        style={{ width: 80, height: 36 }}
                        invalid={Boolean(errors['installmentsCount'])}
                      />
                    </View>
                    <FieldError message={errors['installmentsCount']} />
                  </View>
                  <View style={styles.field}>
                    <Label>Voy por la cuota</Label>
                    <TextField
                      value={startAt}
                      keyboardType="number-pad"
                      style={{ width: 100 }}
                      invalid={Boolean(errors['startAtInstallment'])}
                      onChangeText={(v) => {
                        setStartAt(v)
                        setOverride(null)
                      }}
                    />
                    <FieldError message={errors['startAtInstallment']} />
                  </View>
                  {installmentPreview ? (
                    <Text style={{ color: c.accentForeground, fontWeight: '600' }}>
                      {installmentPreview}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {effectiveMonth && (isCard || override !== null || (inInstallments && startNum > 1)) ? (
            <View style={[styles.monthRow, { borderColor: c.border }]}>
              <View style={styles.switchLabel}>
                <CalendarClock color={c.mutedForeground} size={18} />
                <Text style={{ color: c.mutedForeground }}>
                  {inInstallments ? 'Primera cuota en' : 'Impacta en'}
                </Text>
              </View>
              <View style={styles.switchLabel}>
                <MonthStepper
                  size="sm"
                  value={effectiveMonth}
                  onChange={(m) => setOverride(m === computedMonth ? null : m)}
                />
                {override !== null ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<RotateCcw color={c.mutedForeground} size={16} />}
                    accessibilityLabel="Volver al mes calculado"
                    onPress={() => setOverride(null)}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.field}>
            <Label>Nota</Label>
            <TextField
              value={notes}
              maxLength={1000}
              multiline
              placeholder="Opcional"
              onChangeText={setNotes}
              style={{ height: 72, paddingTop: space(2.5), textAlignVertical: 'top' }}
            />
          </View>

          {errors['_'] && Object.keys(errors).length === 1 ? (
            <FieldError message={errors['_']} />
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.card }]}>
          {!expense ? (
            <Button
              label="Guardar y otro"
              variant="outline"
              disabled={saving}
              style={{ flex: 1 }}
              onPress={() => submit(true)}
            />
          ) : null}
          <Button
            label="Guardar"
            loading={saving}
            style={{ flex: 1 }}
            onPress={() => submit(false)}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(2),
    paddingVertical: space(1),
  },
  title: { fontSize: 18, fontWeight: '700' },
  body: { padding: space(4), gap: space(4), paddingBottom: space(8) },
  field: { gap: space(1.5) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), alignItems: 'center' },
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space(3),
    gap: space(3),
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(1),
  },
  footer: {
    flexDirection: 'row',
    gap: space(3),
    padding: space(3),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
