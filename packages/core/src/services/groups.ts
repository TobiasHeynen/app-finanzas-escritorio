import { AppError } from '@shared/errors'
import type { ExpenseGroup, Group, GroupInput } from '@shared/types'
import type { Repos } from '../repositories'
import type { ServiceContext } from './context'

export type GroupsService = ReturnType<typeof createGroupsService>

/**
 * Valida el grupo de un gasto (o plan, o recurrente): el grupo existe, la persona es de ese grupo y
 * ninguno de los dos está archivado, salvo que ya fueran los del registro que se edita.
 */
export function checkExpenseGroup(
  repos: Repos,
  group: ExpenseGroup | null | undefined,
  previous?: ExpenseGroup | null,
): ExpenseGroup | null {
  if (!group) return null
  const g = repos.groups.get(group.groupId)
  if (g.archived && previous?.groupId !== g.id) {
    throw new AppError('VALIDATION', 'El grupo está archivado', { group: 'Archivado' })
  }
  const member = g.members.find((m) => m.id === group.paidByMemberId)
  if (!member) {
    throw new AppError('VALIDATION', 'Esa persona no es del grupo', { group: 'Elegí quién pagó' })
  }
  if (member.archived && previous?.paidByMemberId !== member.id) {
    throw new AppError('VALIDATION', `${member.name} ya no está en el grupo`, {
      group: 'Elegí quién pagó',
    })
  }
  return { groupId: g.id, paidByMemberId: member.id }
}

export function createGroupsService({ db, repos }: ServiceContext) {
  const { groups } = repos

  /**
   * Deja las personas del grupo como vienen en el input: renombra y reordena las que tienen id,
   * archiva las que no vienen (sus gastos siguen diciendo que pagaron ellas) y agrega las nuevas.
   * Si se agrega un nombre que estaba archivado, se reactiva a esa persona en vez de duplicarla.
   */
  function saveMembers(groupId: number, input: GroupInput['members']) {
    const current = groups.get(groupId).members
    const keepIds = new Set<number>()
    for (const m of input) {
      if (m.id === null) continue
      if (!current.some((c) => c.id === m.id)) {
        throw new AppError('VALIDATION', 'Esa persona no es del grupo')
      }
      keepIds.add(m.id)
    }
    const toArchive = current.filter((c) => !c.archived && !keepIds.has(c.id))
    for (const c of toArchive) groups.archiveMember(c.id)

    // Nombres provisorios primero, así un intercambio de nombres (Ana <-> Tobi) no choca con el UNIQUE.
    for (const id of keepIds) groups.updateMember(id, `#${String(id)}`, 0)

    // Todas las que no vienen ya quedaron archivadas: se pueden reactivar por nombre.
    const archivedByName = new Map(
      current
        .filter((c) => !keepIds.has(c.id))
        .map((c) => [c.name.toLocaleLowerCase('es-AR'), c.id]),
    )
    input.forEach((m, i) => {
      const revived = m.id ?? archivedByName.get(m.name.toLocaleLowerCase('es-AR'))
      if (revived === undefined) groups.insertMember(groupId, m.name, i)
      else {
        archivedByName.delete(m.name.toLocaleLowerCase('es-AR'))
        try {
          groups.updateMember(revived, m.name, i)
        } catch (err) {
          if ((err as { code?: unknown }).code !== 'SQLITE_CONSTRAINT_UNIQUE') throw err
          throw new AppError('CONFLICT', `Ya hubo alguien llamado ${m.name} en el grupo`)
        }
      }
    })
  }

  return {
    list: (): Group[] => groups.list(),

    create(input: GroupInput): Group {
      const id = db.transaction(() => {
        const groupId = groups.insertGroup(input.name)
        input.members.forEach((m, i) => groups.insertMember(groupId, m.name, i))
        return groupId
      })()
      return groups.get(id)
    },

    update(id: number, input: GroupInput): Group {
      db.transaction(() => {
        groups.renameGroup(id, input.name)
        saveMembers(id, input.members)
      })()
      return groups.get(id)
    },

    setArchived(id: number, archived: boolean): Group {
      groups.setGroupArchived(id, archived)
      return groups.get(id)
    },
  }
}
