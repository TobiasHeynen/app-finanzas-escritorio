import { useState } from 'react'
import type { PaymentMethod, PaymentMethodType } from '@shared/types'
import { PAYMENT_METHOD_TYPE_LABELS } from '@shared/types'
import { ColorPicker } from '@renderer/components/color-picker'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { keys, useApiMutation } from '@renderer/lib/hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  method: PaymentMethod | null
}

const TYPES = Object.entries(PAYMENT_METHOD_TYPE_LABELS) as [PaymentMethodType, string][]

export function PaymentMethodDialog({ open, onOpenChange, method }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <PaymentMethodForm method={method} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function PaymentMethodForm({
  method,
  onClose,
}: {
  method: PaymentMethod | null
  onClose: () => void
}) {
  const [name, setName] = useState(method?.name ?? '')
  const [type, setType] = useState<PaymentMethodType>(method?.type ?? 'tarjeta_credito')
  const [closingDay, setClosingDay] = useState(method?.closingDay?.toString() ?? '')
  const [dueDay, setDueDay] = useState(method?.dueDay?.toString() ?? '')
  const [color, setColor] = useState(method?.color ?? '#3b82f6')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const options = {
    invalidate: [keys.paymentMethods, keys.cards],
    toastErrors: false,
    onSuccess: onClose,
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

  const parseDay = (v: string): number | null => {
    if (!/^\d{1,2}$/.test(v.trim())) return null
    const n = Number(v)
    return n >= 1 && n <= 31 ? n : null
  }

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
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
    const onError = (err: Error & { fields?: Record<string, string> }) =>
      setErrors({ name: err.message, ...err.fields })
    if (method) update.mutate({ id: method.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{method ? 'Editar medio de pago' : 'Nuevo medio de pago'}</DialogTitle>
        <DialogDescription>
          Las tarjetas de crédito imputan el gasto en el mes en que pagás el resumen.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="pm-name">Nombre</Label>
          <Input
            id="pm-name"
            autoFocus
            value={name}
            maxLength={60}
            aria-invalid={Boolean(errors['name'])}
            onChange={(e) => setName(e.target.value)}
          />
          <FieldError message={errors['name']} />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as PaymentMethodType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isCard && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-closing">Día de cierre</Label>
              <Input
                id="pm-closing"
                inputMode="numeric"
                value={closingDay}
                placeholder="25"
                aria-invalid={Boolean(errors['closingDay'])}
                onChange={(e) => setClosingDay(e.target.value)}
              />
              <FieldError message={errors['closingDay']} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-due">Día de vencimiento</Label>
              <Input
                id="pm-due"
                inputMode="numeric"
                value={dueDay}
                placeholder="5"
                aria-invalid={Boolean(errors['dueDay'])}
                onChange={(e) => setDueDay(e.target.value)}
              />
              <FieldError message={errors['dueDay']} />
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Lo comprado hasta el día de cierre se paga el mes siguiente; lo posterior, dos meses
              después. El vencimiento es sólo informativo (suele ser los primeros días del mes).
            </p>
          </>
        )}
        <div className="col-span-2 flex flex-col gap-2">
          <Label>Color</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
      </div>
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
