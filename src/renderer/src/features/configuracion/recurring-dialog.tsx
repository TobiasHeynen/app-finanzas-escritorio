import { useState } from 'react'
import { currentMonth, type Month } from '@shared/months'
import type { RecurringTemplate } from '@shared/types'
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
import { useCatalog } from '@renderer/lib/catalog'
import { keys, movementKeys, useApiMutation } from '@renderer/lib/hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: RecurringTemplate | null
}

export function RecurringDialog({ open, onOpenChange, template }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <RecurringForm template={template} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RecurringForm({
  template,
  onClose,
}: {
  template: RecurringTemplate | null
  onClose: () => void
}) {
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
  const [errors, setErrors] = useState<Record<string, string>>({})

  const options = {
    invalidate: [keys.recurring, ...movementKeys],
    toastErrors: false,
    onSuccess: onClose,
  }
  const create = useApiMutation('recurring:create', { ...options, success: 'Recurrente creado' })
  const update = useApiMutation('recurring:update', { ...options, success: 'Recurrente guardado' })

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
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
    }
    const onError = (err: Error & { fields?: Record<string, string> }) =>
      setErrors({ _: err.message, ...err.fields })
    if (template) update.mutate({ id: template.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{template ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente'}</DialogTitle>
        <DialogDescription>
          Se genera solo una vez por mes. Sin monto, queda pendiente para que lo completes.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="rec-description">Nombre</Label>
          <Input
            id="rec-description"
            autoFocus
            value={description}
            placeholder="Alquiler"
            maxLength={120}
            aria-invalid={Boolean(errors['description'])}
            onChange={(e) => setDescription(e.target.value)}
          />
          <FieldError message={errors['description']} />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="rec-category">Categoría</Label>
          <SubcategoryPicker id="rec-category" value={subcategoryId} onChange={setSubcategoryId} />
          <FieldError message={errors['subcategoryId']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-amount">Monto por defecto</Label>
          <MoneyInput
            id="rec-amount"
            value={amount}
            placeholder="Vacío = pendiente"
            onValueChange={(c, v) => {
              setAmount(c)
              setAmountValid(v)
            }}
          />
          <FieldError message={errors['defaultAmountCents']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-method">Medio de pago</Label>
          <PaymentMethodSelect
            id="rec-method"
            methods={paymentMethods}
            value={paymentMethodId}
            onChange={setPaymentMethodId}
          />
          <FieldError message={errors['paymentMethodId']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rec-day">Día del mes</Label>
          <Input
            id="rec-day"
            inputMode="numeric"
            value={day}
            aria-invalid={Boolean(errors['dayOfMonth'])}
            onChange={(e) => setDay(e.target.value)}
          />
          <FieldError message={errors['dayOfMonth']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Desde</Label>
          <MonthStepper size="sm" value={startMonth} onChange={setStartMonth} className="h-9" />
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-lg border px-3 py-2">
          <div className="flex items-center gap-2">
            <Switch id="rec-has-end" checked={hasEnd} onCheckedChange={setHasEnd} />
            <Label htmlFor="rec-has-end" className="font-normal">
              Termina
            </Label>
          </div>
          {hasEnd && <MonthStepper size="sm" value={endMonth} onChange={setEndMonth} />}
        </div>
        <FieldError message={errors['endMonth']} />
        <div className="col-span-2 flex items-center gap-2">
          <Switch id="rec-active" checked={active} onCheckedChange={setActive} />
          <Label htmlFor="rec-active" className="font-normal">
            Activo
          </Label>
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
