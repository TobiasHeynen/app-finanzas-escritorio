import { useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus, Users } from 'lucide-react'
import type { Group } from '@shared/types'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { useGroups } from '@renderer/lib/groups'
import { keys, movementKeys, useApiMutation } from '@renderer/lib/hooks'
import { cn } from '@renderer/lib/utils'
import { GroupDialog } from './group-dialog'

export function GroupsSection() {
  const { data: groups = [] } = useGroups()
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Group | null>(null)
  const [open, setOpen] = useState(false)
  const archive = useApiMutation('groups:archive', {
    invalidate: [keys.groups, ...movementKeys],
    success: (g) => (g.archived ? `"${g.name}" archivado` : `"${g.name}" restaurado`),
  })

  const visible = groups.filter((g) => showArchived || !g.archived)
  const openDialog = (group: Group | null) => {
    setEditing(group)
    setOpen(true)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Grupos</h2>
          <p className="text-sm text-muted-foreground">
            Para gastos compartidos con tu pareja, amigos o en un viaje. Las personas son sólo
            nombres: no necesitan cuenta ni mail.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {groups.some((g) => g.archived) && (
            <div className="flex items-center gap-2">
              <Switch
                id="groups-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="groups-archived" className="font-normal text-muted-foreground">
                Ver archivados
              </Label>
            </div>
          )}
          <Button onClick={() => openDialog(null)}>
            <Plus /> Grupo
          </Button>
        </div>
      </div>
      {visible.length === 0 ? (
        <Card className="items-center gap-2 px-4 py-10 text-center text-muted-foreground">
          <Users className="size-8" />
          <p>Todavía no armaste ningún grupo.</p>
          <p className="text-sm">
            Creá uno y al cargar un gasto vas a poder elegir el grupo y quién pagó.
          </p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {visible.map((g) => (
            <Card
              key={g.id}
              className={cn('flex-row items-center gap-3 px-4 py-3', g.archived && 'opacity-60')}
            >
              <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Users className="size-4" />
              </span>
              <div className="flex flex-1 flex-col">
                <span className="flex items-center gap-2 font-medium">
                  {g.name}
                  {g.archived && <Badge variant="secondary">Archivado</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {g.members
                    .filter((m) => !m.archived)
                    .map((m) => m.name)
                    .join(', ')}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${g.name}`}
                onClick={() => openDialog(g)}
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={g.archived ? `Restaurar ${g.name}` : `Archivar ${g.name}`}
                onClick={() => archive.mutate({ id: g.id, archived: !g.archived })}
              >
                {g.archived ? <ArchiveRestore /> : <Archive />}
              </Button>
            </Card>
          ))}
        </div>
      )}
      <GroupDialog open={open} onOpenChange={setOpen} group={editing} />
    </section>
  )
}
