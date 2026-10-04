import { useMemo, useRef, useState } from 'react'
import { CalendarClock, CreditCard, RotateCcw, StickyNote } from 'lucide-react'
import { computeChargeMonth } from '@shared/domain/charge-month'
import { formatMoney, splitInstallments } from '@shared/money'
import { formatMonthLong, isIsoDate, monthOf, todayIso, type Month } from '@shared/months'
import { sumCents } from '@shared/money'
import type { Expense, ExpenseGroup, ExpenseSplit } from '@shared/types'
import { SplitEditor } from '@renderer/components/split-editor'
import { GroupFields } from '@renderer/components/group-fields'
import { MoneyInput } from '@renderer/components/money-input'
import { MonthStepper } from '@renderer/components/month-stepper'
import { FieldError } from '@renderer/components/page'
import { PaymentMethodSelect } from '@renderer/components/payment-method-select'
import { SubcategoryPicker } from '@renderer/components/subcategory-picker'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { Textarea } from '@renderer/components/ui/textarea'
import { useCatalog } from '@renderer/lib/catalog'
import { defaultSplit, rememberPayer, useGroupsIndex } from '@renderer/lib/groups'
import { movementKeys, useApiMutation } from '@renderer/lib/hooks'
import { cn } from '@renderer/lib/utils'

export interface ExpenseDefaults {
  purchaseDate?: string
  subcategoryId?: number
  paymentMethodId?: number
  description?: string
  amountCents?: number | null
}

const LAST_METHOD_KEY = 'mis-finanzas:last-payment-method'

function readLastMethod(): number | null {
  try {
    const v = Number(localStorage.getItem(LAST_METHOD_KEY))
    return Number.isInteger(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function rememberMethod(id: number): void {
  try {
    localStorage.setItem(LAST_METHOD_KEY, String(id))
  } catch {
    // opcional
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: Expense | null
  defaults?: ExpenseDefaults | undefined
}

export function ExpenseDialog({ open, onOpenChange, expense, defaults }: Props) {
  const amountRef = useRef<HTMLInputElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          amountRef.current?.focus()
        }}
      >
        <ExpenseForm
          expense={expense}
          defaults={defaults}
          amountRef={amountRef}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

// El form se monta cada vez que se abre el diálogo: el estado inicial sale de las props.
function ExpenseForm({
  expense,
  defaults,
  amountRef,
  onClose,
}: {
  expense: Expense | null
  defaults: ExpenseDefaults | undefined
  amountRef: React.RefObject<HTMLInputElement | null>
  onClose: () => void
}) {
  const { paymentMethods, paymentMethodById } = useCatalog()

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
  /** null = partes iguales entre todos (lo que propone el server si no viene reparto). */
  const [split, setSplit] = useState<ExpenseSplit | null>(expense?.group?.split ?? null)
  const groupsIndex = useGroupsIndex()
  const groupEntity = group ? groupsIndex.groupById.get(group.groupId) : undefined
  const [showNotes, setShowNotes] = useState(Boolean(expense?.notes))
  const [inInstallments, setInInstallments] = useState(false)
  const showSplit = Boolean(groupEntity) && !inInstallments
  const [count, setCount] = useState('3')
  const [startAt, setStartAt] = useState('1')
  const [override, setOverride] = useState<Month | null>(
    expense?.chargeMonthLocked ? expense.chargeMonth : null,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  /** "Guardar y cargar otro": limpia monto, detalle y nota; deja categoría, medio, fecha y cuotas. */
  const resetForNext = () => {
    setAmount(null)
    setAmountValid(true)
    setDescription('')
    setNotes('')
    setShowNotes(false)
    setErrors({})
  }

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
        ? `${remaining} cuota${remaining === 1 ? '' : 's'} de ${formatMoney(rest)}`
        : `1 cuota de ${formatMoney(first)} y ${countNum - 1} de ${formatMoney(rest)}`
    return start > 1
      ? `Vas por la ${start}/${countNum}: quedan ${amounts}${when}`
      : `${amounts}${when}`
  }, [inInstallments, amount, countNum, startNum, effectiveMonth])

  const onDone = (another: boolean) => {
    if (paymentMethodId !== null) rememberMethod(paymentMethodId)
    rememberPayer(group)
    if (another) {
      resetForNext()
      amountRef.current?.focus()
    } else onClose()
  }

  const fieldErrors = (err: Error & { fields?: Record<string, string> }) =>
    setErrors({ _: err.message, ...err.fields })

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
    success: (p) => `Compra en ${p.installmentsCount} cuotas guardada`,
    toastErrors: false,
  })
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
        next['startAtInstallment'] = `Entre 1 y ${countNum}`
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

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        submit(false)
      }}
    >
      <DialogHeader>
        <DialogTitle>{expense ? 'Editar gasto' : 'Nuevo gasto'}</DialogTitle>
        <DialogDescription>
          {expense ? 'Cambiá lo que necesites.' : 'Enter guarda, Esc cierra.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="expense-amount">{inInstallments ? 'Total de la compra' : 'Monto'}</Label>
        <MoneyInput
          id="expense-amount"
          ref={amountRef}
          value={amount}
          className="h-12 text-2xl font-semibold"
          placeholder={inInstallments ? '0' : 'Vacío = pendiente'}
          aria-invalid={Boolean(errors['amountCents'])}
          onValueChange={(cents, valid) => {
            setAmount(cents)
            setAmountValid(valid)
          }}
        />
        <FieldError message={errors['amountCents']} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="expense-category">Categoría</Label>
          <SubcategoryPicker
            id="expense-category"
            value={subcategoryId}
            onChange={setSubcategoryId}
            invalid={Boolean(errors['subcategoryId'])}
          />
          <FieldError message={errors['subcategoryId']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-method">Medio de pago</Label>
          <PaymentMethodSelect
            id="expense-method"
            methods={paymentMethods}
            value={paymentMethodId}
            onChange={(id) => {
              setPaymentMethodId(id)
              setOverride(null)
            }}
            invalid={Boolean(errors['paymentMethodId'])}
          />
          <FieldError message={errors['paymentMethodId']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-date">Fecha</Label>
          <Input
            id="expense-date"
            type="date"
            value={purchaseDate}
            aria-invalid={Boolean(errors['purchaseDate'])}
            onChange={(e) => {
              setPurchaseDate(e.target.value)
              setOverride(null)
            }}
          />
          <FieldError message={errors['purchaseDate']} />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="expense-description">Detalle</Label>
          <Input
            id="expense-description"
            value={description}
            maxLength={200}
            placeholder="Opcional"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <GroupFields
          idPrefix="expense"
          value={group}
          onChange={(g) => {
            if (g?.groupId !== group?.groupId) setSplit(null)
            setGroup(g)
          }}
          error={errors['group']}
        />
        {showSplit && groupEntity && (
          <SplitEditor
            group={groupEntity}
            amount={amount}
            value={split ?? defaultSplit(groupEntity)}
            onChange={setSplit}
            error={errors['split']}
          />
        )}
      </div>

      {!expense && (
        <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="expense-installments" className="font-normal">
              <CreditCard className="size-4 text-muted-foreground" />
              En cuotas
            </Label>
            <Switch
              id="expense-installments"
              checked={inInstallments}
              onCheckedChange={(v) => {
                setInInstallments(v)
                setOverride(null)
              }}
            />
          </div>
          {inInstallments && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expense-count" className="text-xs">
                  Cantidad de cuotas
                </Label>
                <Input
                  id="expense-count"
                  inputMode="numeric"
                  value={count}
                  aria-invalid={Boolean(errors['installmentsCount'])}
                  onChange={(e) => setCount(e.target.value)}
                />
                <FieldError message={errors['installmentsCount']} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="expense-start" className="text-xs">
                  Voy por la cuota
                </Label>
                <Input
                  id="expense-start"
                  inputMode="numeric"
                  value={startAt}
                  aria-invalid={Boolean(errors['startAtInstallment'])}
                  onChange={(e) => {
                    setStartAt(e.target.value)
                    setOverride(null)
                  }}
                />
                <FieldError message={errors['startAtInstallment']} />
              </div>
              {installmentPreview && (
                <p className="col-span-2 text-sm font-medium text-accent-foreground">
                  {installmentPreview}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {effectiveMonth && (isCard || override !== null || (inInstallments && startNum > 1)) && (
        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            {inInstallments ? 'Primera cuota en' : 'Impacta en'}
          </span>
          <div className="flex items-center gap-1">
            <MonthStepper
              size="sm"
              value={effectiveMonth}
              onChange={(m) => setOverride(m === computedMonth ? null : m)}
            />
            {override !== null && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setOverride(null)}
                aria-label="Volver al mes calculado"
                title="Volver al mes calculado"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {showNotes ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expense-notes">Nota</Label>
          <Textarea
            id="expense-notes"
            value={notes}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      ) : (
        <Button
          type="button"
          variant="link"
          className="h-auto self-start p-0 text-muted-foreground"
          onClick={() => setShowNotes(true)}
        >
          <StickyNote /> Agregar nota
        </Button>
      )}

      {errors['_'] && Object.keys(errors).length === 1 && <FieldError message={errors['_']} />}

      <DialogFooter className={cn(!expense && 'sm:justify-between')}>
        {!expense && (
          <Button type="button" variant="ghost" disabled={saving} onClick={() => submit(true)}>
            Guardar y cargar otro
          </Button>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            Guardar
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}
