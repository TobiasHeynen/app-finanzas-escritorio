import { useRef, useState } from 'react'
import { dateInMonth, isIsoDate, monthOf, todayIso, type Month } from '@shared/months'
import type { Income, IncomeType } from '@shared/types'
import { INCOME_TYPE_LABELS } from '@shared/types'
import { MoneyInput } from '@renderer/components/money-input'
import { MonthStepper } from '@renderer/components/month-stepper'
import { FieldError } from '@renderer/components/page'
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
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { movementKeys, useApiMutation } from '@renderer/lib/hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  income: Income | null
  month: Month
}

export function IncomeDialog({ open, onOpenChange, income, month }: Props) {
  const amountRef = useRef<HTMLInputElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          amountRef.current?.focus()
        }}
      >
        <IncomeForm
          income={income}
          month={month}
          amountRef={amountRef}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function defaultDate(month: Month): string {
  const today = todayIso()
  return monthOf(today) === month ? today : dateInMonth(month, 1)
}

function IncomeForm({
  income,
  month,
  amountRef,
  onClose,
}: {
  income: Income | null
  month: Month
  amountRef: React.RefObject<HTMLInputElement | null>
  onClose: () => void
}) {
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
    onSuccess: onClose,
  }
  const create = useApiMutation('incomes:create', { ...options, success: 'Ingreso guardado' })
  const update = useApiMutation('incomes:update', { ...options, success: 'Ingreso actualizado' })

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
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
    const onError = (err: Error & { fields?: Record<string, string> }) =>
      setErrors({ _: err.message, ...err.fields })
    if (income) update.mutate({ id: income.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{income ? 'Editar ingreso' : 'Nuevo ingreso'}</DialogTitle>
        <DialogDescription>Cuenta en el mes en que lo cobrás.</DialogDescription>
      </DialogHeader>
      <ToggleGroup
        type="single"
        value={type}
        onValueChange={(v) => v && setType(v as IncomeType)}
        aria-label="Tipo de ingreso"
        className="w-full"
      >
        {(Object.keys(INCOME_TYPE_LABELS) as IncomeType[]).map((t) => (
          <ToggleGroupItem key={t} value={t} className="flex-1">
            {INCOME_TYPE_LABELS[t]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="income-amount">Monto</Label>
        <MoneyInput
          id="income-amount"
          ref={amountRef}
          value={amount}
          className="h-12 text-2xl font-semibold"
          aria-invalid={Boolean(errors['amountCents'])}
          onValueChange={(c, v) => {
            setAmount(c)
            setValid(v)
          }}
        />
        <FieldError message={errors['amountCents']} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="income-date">Fecha de cobro</Label>
          <Input
            id="income-date"
            type="date"
            value={date}
            aria-invalid={Boolean(errors['date'])}
            onChange={(e) => {
              setDate(e.target.value)
              if (isIsoDate(e.target.value)) setIncomeMonth(monthOf(e.target.value))
            }}
          />
          <FieldError message={errors['date']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Cuenta en</Label>
          <MonthStepper size="sm" value={incomeMonth} onChange={setIncomeMonth} className="h-9" />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="income-description">Detalle</Label>
          <Input
            id="income-description"
            value={description}
            maxLength={200}
            placeholder="Opcional"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <FieldError message={errors['_']} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={create.isPending || update.isPending}>
          Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}
