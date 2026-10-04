import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Group } from '@shared/types'
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
import { keys, movementKeys, useApiMutation } from '@renderer/lib/hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group | null
}

export function GroupDialog({ open, onOpenChange, group }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <GroupForm group={group} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

interface MemberDraft {
  key: number
  id: number | null
  name: string
}

let nextKey = 0
const draft = (id: number | null, name: string): MemberDraft => ({ key: nextKey++, id, name })

function GroupForm({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const [members, setMembers] = useState<MemberDraft[]>(() =>
    group
      ? group.members.filter((m) => !m.archived).map((m) => draft(m.id, m.name))
      : [draft(null, ''), draft(null, '')],
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const options = {
    invalidate: [keys.groups, ...movementKeys],
    toastErrors: false,
    onSuccess: onClose,
  }
  const create = useApiMutation('groups:create', { ...options, success: 'Grupo creado' })
  const update = useApiMutation('groups:update', { ...options, success: 'Grupo guardado' })

  const setMember = (key: number, value: string) =>
    setMembers((list) => list.map((m) => (m.key === key ? { ...m, name: value } : m)))

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    const filled = members.filter((m) => m.name.trim() !== '')
    const next: Record<string, string> = {}
    if (!name.trim()) next['name'] = 'Poné un nombre'
    if (filled.length < 2) next['members'] = 'Agregá al menos 2 personas'
    const names = filled.map((m) => m.name.trim().toLocaleLowerCase('es-AR'))
    if (new Set(names).size !== names.length) next['members'] = 'Hay nombres repetidos'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    const data = {
      name: name.trim(),
      members: filled.map((m) => ({ id: m.id, name: m.name.trim() })),
    }
    const onError = (err: Error & { fields?: Record<string, string> }) =>
      setErrors({ _: err.message, ...err.fields })
    if (group) update.mutate({ id: group.id, data }, { onError })
    else create.mutate(data, { onError })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{group ? 'Editar grupo' : 'Nuevo grupo'}</DialogTitle>
        <DialogDescription>
          Si sacás a alguien, sus gastos anteriores siguen diciendo que pagó esa persona.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-name">Nombre</Label>
        <Input
          id="group-name"
          autoFocus
          value={name}
          placeholder="Casa, Viaje a Bariloche…"
          maxLength={60}
          aria-invalid={Boolean(errors['name'])}
          onChange={(e) => setName(e.target.value)}
        />
        <FieldError message={errors['name']} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Personas</Label>
        {members.map((m, i) => (
          <div key={m.key} className="flex items-center gap-2">
            <Input
              aria-label={`Persona ${String(i + 1)}`}
              value={m.name}
              placeholder={i === 0 ? 'Vos' : 'Nombre'}
              maxLength={40}
              onChange={(e) => setMember(m.key, e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Sacar a ${m.name || 'esta persona'}`}
              disabled={members.length <= 2}
              onClick={() => setMembers((list) => list.filter((x) => x.key !== m.key))}
            >
              <X />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={members.length >= 20}
          onClick={() => setMembers((list) => [...list, draft(null, '')])}
        >
          <Plus /> Agregar persona
        </Button>
        <FieldError message={errors['members']} />
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
