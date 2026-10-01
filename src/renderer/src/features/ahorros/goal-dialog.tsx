import { useRef, useState } from 'react'
import type { Currency } from '@shared/money'
import { isIsoDate } from '@shared/months'
import type { SavingsGoal } from '@shared/types'
import { MoneyInput } from '@renderer/components/money-input'
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
import { keys, useApiMutation } from '@renderer/lib/hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: SavingsGoal | null
}

export function GoalDialog({ open, onOpenChange, goal }: Props) {
  const nameRef = useRef<HTMLInputElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          nameRef.current?.focus()
        }}
      >
        <GoalForm goal={goal} nameRef={nameRef} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GoalForm({
  goal,
  nameRef,
  onClose,
}: {
  goal: SavingsGoal | null
  nameRef: React.RefObject<HTMLInputElement | null>
  onClose: () => void
}) {
  const [name, setName] = useState(goal?.name ?? '')
  const [currency, setCurrency] = useState<Currency>(goal?.currency ?? 'ARS')
  const [target, setTarget] = useState<number | null>(goal?.targetMinor ?? null)
  const [validTarget, setValidTarget] = useState(true)
  const [date, setDate] = useState(goal?.targetDate ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const hasMovements = goal !== null && goal.savedMinor !== 0

  const options = { invalidate: [keys.savings], toastErrors: false, onSuccess: onClose }
  const create = useApiMutation('savings:createGoal', { ...options, success: 'Meta creada' })
  const update = useApiMutation('savings:updateGoal', { ...options, success: 'Meta actualizada' })

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (name.trim() === '') next['name'] = 'Poné un nombre'
    if (!validTarget || target === null || target <= 0) next['targetMinor'] = 'Poné el objetivo'
    if (date !== '' && !isIsoDate(date)) next['targetDate'] = 'Fecha inválida'
    setErrors(next)
    if (Object.keys(next).length > 0 || target === null) return
    const data = {
      name: name.trim(),
      currency,
      targetMinor: target,
      targetDate: date === '' ? null : date,
    }
    const onError = (err: Error & { fields?: Record<string, string> }) =>
      setErrors({ _: err.message, ...err.fields })
    if (goal) update.mutate({ id: goal.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{goal ? 'Editar meta' : 'Nueva meta'}</DialogTitle>
        <DialogDescription>
          Con fecha objetivo te decimos cuánto ahorrar por mes para llegar.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="goal-name">Nombre</Label>
        <Input
          id="goal-name"
          ref={nameRef}
          value={name}
          maxLength={80}
          placeholder="Vacaciones, fondo de emergencia…"
          aria-invalid={Boolean(errors['name'])}
          onChange={(e) => setName(e.target.value)}
        />
        <FieldError message={errors['name']} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Moneda</Label>
        <ToggleGroup
          type="single"
          value={currency}
          disabled={hasMovements}
          onValueChange={(v) => v && setCurrency(v as Currency)}
          aria-label="Moneda"
        >
          <ToggleGroupItem value="ARS" className="flex-1">
            Pesos
          </ToggleGroupItem>
          <ToggleGroupItem value="USD" className="flex-1">
            Dólares
          </ToggleGroupItem>
        </ToggleGroup>
        {hasMovements && (
          <p className="text-xs text-muted-foreground">
            Tiene aportes cargados, así que no se puede cambiar la moneda.
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-target">Objetivo</Label>
          <MoneyInput
            id="goal-target"
            currency={currency}
            value={target}
            aria-invalid={Boolean(errors['targetMinor'])}
            onValueChange={(c, v) => {
              setTarget(c)
              setValidTarget(v)
            }}
          />
          <FieldError message={errors['targetMinor']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal-date">Fecha objetivo</Label>
          <Input
            id="goal-date"
            type="date"
            value={date}
            aria-invalid={Boolean(errors['targetDate'])}
            onChange={(e) => setDate(e.target.value)}
          />
          <FieldError message={errors['targetDate']} />
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
