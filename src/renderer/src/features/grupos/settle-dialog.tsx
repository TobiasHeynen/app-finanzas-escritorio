import { useState } from 'react'
import { todayIso, isIsoDate } from '@shared/months'
import type { Group } from '@shared/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { movementKeys, useApiMutation } from '@renderer/lib/hooks'

export interface SettleDraft {
  fromMemberId: number
  toMemberId: number
  amountCents: number
}

export function SettleDialog({
  group,
  draft,
  onClose,
}: {
  group: Group
  draft: SettleDraft | null
  onClose: () => void
}) {
  return (
    <Dialog open={draft !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {draft && <SettleForm group={group} draft={draft} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function SettleForm({
  group,
  draft,
  onClose,
}: {
  group: Group
  draft: SettleDraft
  onClose: () => void
}) {
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
    onSuccess: onClose,
  })
  const members = group.members.filter(
    (m) => !m.archived || m.id === draft.fromMemberId || m.id === draft.toMemberId,
  )

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
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
      { onError: (err) => setErrors({ _: err.message, ...err.fields }) },
    )
  }

  const memberSelect = (id: string, value: number, onChange: (v: number) => void) => (
    <Select value={value.toString()} onValueChange={(v) => v !== '' && onChange(Number(v))}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id.toString()}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Saldar en {group.name}</DialogTitle>
        <DialogDescription>
          Registrá lo que una persona le pasó a otra. No cambia tus gastos ni tu disponible.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settle-from">Quién pagó</Label>
          {memberSelect('settle-from', from, setFrom)}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settle-to">A quién</Label>
          {memberSelect('settle-to', to, setTo)}
          <FieldError message={errors['toMemberId']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settle-amount">Monto</Label>
          <MoneyInput
            id="settle-amount"
            value={amount}
            aria-invalid={Boolean(errors['amountCents'])}
            onValueChange={(c, v) => {
              setAmount(c)
              setValid(v)
            }}
          />
          <FieldError message={errors['amountCents']} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="settle-date">Fecha</Label>
          <Input
            id="settle-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <FieldError message={errors['date']} />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="settle-note">Nota</Label>
          <Input
            id="settle-note"
            value={note}
            maxLength={200}
            placeholder="Opcional (ej.: transferencia)"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <FieldError message={errors['_']} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={settle.isPending}>
          Registrar pago
        </Button>
      </DialogFooter>
    </form>
  )
}
