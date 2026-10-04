import type { ExpenseGroup } from '@shared/types'
import { FieldError } from '@renderer/components/page'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { readLastPayer, useGroupsIndex } from '@renderer/lib/groups'

const NONE = 'none'

/**
 * Grupo y quién pagó. No se muestra si no hay grupos (salvo que el gasto ya tenga uno), así quien no
 * usa grupos no ve nada nuevo. Las personas archivadas sólo aparecen si son las que ya estaban elegidas.
 */
export function GroupFields({
  value,
  onChange,
  error,
  idPrefix,
}: {
  value: ExpenseGroup | null
  onChange: (group: ExpenseGroup | null) => void
  error?: string | undefined
  idPrefix: string
}) {
  const index = useGroupsIndex()
  const groups = index.groups.filter((g) => !g.archived || g.id === value?.groupId)
  if (groups.length === 0) return null

  const selected = value ? index.groupById.get(value.groupId) : undefined
  const members = (selected?.members ?? []).filter(
    (m) => !m.archived || m.id === value?.paidByMemberId,
  )

  const pickGroup = (raw: string) => {
    if (raw === NONE) {
      onChange(null)
      return
    }
    const g = index.groupById.get(Number(raw))
    const candidates = g?.members.filter((m) => !m.archived) ?? []
    const last = g ? readLastPayer(g.id) : null
    const payer = candidates.find((m) => m.id === last) ?? candidates[0]
    if (g && payer) onChange({ groupId: g.id, paidByMemberId: payer.id })
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-group`}>Grupo</Label>
        <Select value={value?.groupId.toString() ?? NONE} onValueChange={pickGroup}>
          <SelectTrigger id={`${idPrefix}-group`} aria-invalid={Boolean(error)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin grupo (personal)</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id.toString()}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={error} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-payer`}>Pagó</Label>
        <Select
          value={value?.paidByMemberId.toString() ?? ''}
          disabled={!value}
          onValueChange={(v) => {
            // Radix manda "" cuando el valor cambia y la opción todavía no está montada: se ignora.
            if (value && v !== '') onChange({ ...value, paidByMemberId: Number(v) })
          }}
        >
          <SelectTrigger id={`${idPrefix}-payer`}>
            <SelectValue placeholder="—" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id.toString()}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
