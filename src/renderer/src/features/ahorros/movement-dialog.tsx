import { useRef, useState } from 'react'
import { formatMoney, impliedRate, usdToArs, type Currency } from '@shared/money'
import { isIsoDate, monthOf, todayIso, type Month } from '@shared/months'
import type { SavingsGoal, SavingsMovement } from '@shared/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { movementKeys, useApiMutation } from '@renderer/lib/hooks'

type Kind = 'aporte' | 'retiro'

export interface MovementDefaults {
  currency?: Currency
  kind?: Kind
  goalId?: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement: SavingsMovement | null
  defaults?: MovementDefaults | undefined
  goals: SavingsGoal[]
}

export function MovementDialog({ open, onOpenChange, movement, defaults, goals }: Props) {
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
        <MovementForm
          movement={movement}
          defaults={defaults}
          goals={goals}
          amountRef={amountRef}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function MovementForm({
  movement,
  defaults,
  goals,
  amountRef,
  onClose,
}: {
  movement: SavingsMovement | null
  defaults?: MovementDefaults | undefined
  goals: SavingsGoal[]
  amountRef: React.RefObject<HTMLInputElement | null>
  onClose: () => void
}) {
  const [kind, setKind] = useState<Kind>(
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

  const options = { invalidate: movementKeys, toastErrors: false, onSuccess: onClose }
  const create = useApiMutation('savings:createMovement', {
    ...options,
    success: (_d, input) => (input.kind === 'aporte' ? 'Aporte guardado' : 'Retiro guardado'),
  })
  const update = useApiMutation('savings:updateMovement', {
    ...options,
    success: 'Movimiento actualizado',
  })

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
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
    const onError = (err: Error & { fields?: Record<string, string> }) =>
      setErrors({ _: err.message, ...err.fields })
    if (movement) update.mutate({ id: movement.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{movement ? 'Editar movimiento' : 'Movimiento de ahorro'}</DialogTitle>
        <DialogDescription>
          {isUsd
            ? kind === 'aporte'
              ? 'Compra de dólares: los pesos que pagaste salen del disponible del mes.'
              : 'Venta de dólares: los pesos que recibiste suman al disponible del mes.'
            : kind === 'aporte'
              ? 'Lo que guardás sale del disponible del mes.'
              : 'Lo que sacás del ahorro suma al disponible del mes.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <ToggleGroup
          type="single"
          value={kind}
          onValueChange={(v) => v && setKind(v as Kind)}
          aria-label="Tipo de movimiento"
        >
          <ToggleGroupItem value="aporte" className="flex-1">
            {isUsd ? 'Compra' : 'Aporte'}
          </ToggleGroupItem>
          <ToggleGroupItem value="retiro" className="flex-1">
            {isUsd ? 'Venta' : 'Retiro'}
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={currency}
          onValueChange={(v) => {
            if (!v) return
            setCurrency(v as Currency)
            setGoalId(null)
          }}
          aria-label="Moneda"
        >
          <ToggleGroupItem value="ARS" className="flex-1">
            Pesos
          </ToggleGroupItem>
          <ToggleGroupItem value="USD" className="flex-1">
            Dólares
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="saving-amount">{isUsd ? 'Dólares' : 'Monto'}</Label>
        <MoneyInput
          id="saving-amount"
          ref={amountRef}
          currency={currency}
          value={amount}
          className="h-12 text-2xl font-semibold"
          aria-invalid={Boolean(errors['amountMinor'])}
          onValueChange={(c, v) => {
            setAmount(c)
            setInvalid((s) => ({ ...s, amount: !v }))
            if (isUsd) recalcArs(c, rate)
          }}
        />
        <FieldError message={errors['amountMinor']} />
      </div>

      {isUsd && (
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/60 p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="saving-rate">Cotización</Label>
            <MoneyInput
              id="saving-rate"
              value={rate}
              placeholder="1.250"
              onValueChange={(c, v) => {
                setRate(c)
                setInvalid((s) => ({ ...s, rate: !v }))
                recalcArs(amount, c)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="saving-ars">
              {kind === 'aporte' ? 'Pesos pagados' : 'Pesos recibidos'}
            </Label>
            <MoneyInput
              id="saving-ars"
              value={ars}
              aria-invalid={Boolean(errors['arsCents'])}
              onValueChange={(c, v) => {
                setArs(c)
                setInvalid((s) => ({ ...s, ars: !v }))
                recalcRate(amount, c)
              }}
            />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">
            {ars !== null && ars > 0 && rate !== null
              ? `${formatMoney(ars)} a ${formatMoney(rate)} por dólar.`
              : 'Dejalo vacío si no salieron pesos (por ejemplo, un cobro en dólares).'}
          </p>
          <FieldError message={errors['arsCents']} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="saving-date">Fecha</Label>
          <Input
            id="saving-date"
            type="date"
            value={date}
            aria-invalid={Boolean(errors['date'])}
            onChange={(e) => {
              setDate(e.target.value)
              if (isIsoDate(e.target.value)) setMonth(monthOf(e.target.value))
            }}
          />
          <FieldError message={errors['date']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Cuenta en</Label>
          <MonthStepper size="sm" value={month} onChange={setMonth} className="h-9" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="saving-goal">Meta</Label>
          <Select
            value={goalId?.toString() ?? 'none'}
            onValueChange={(v) => setGoalId(v === 'none' ? null : Number(v))}
          >
            <SelectTrigger id="saving-goal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin meta</SelectItem>
              {goalOptions.map((g) => (
                <SelectItem key={g.id} value={g.id.toString()}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors['goalId']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="saving-note">Nota</Label>
          <Input
            id="saving-note"
            value={note}
            maxLength={200}
            placeholder="Opcional"
            onChange={(e) => setNote(e.target.value)}
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
