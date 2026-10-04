import { useMemo } from 'react'
import type { ExpenseGroup, Group, GroupMember } from '@shared/types'
import { keys, useApiQuery } from './hooks'

export function useGroups() {
  return useApiQuery('groups:list', {}, keys.groups)
}

export interface GroupsIndex {
  groups: Group[]
  groupById: Map<number, Group>
  memberById: Map<number, GroupMember>
}

export function useGroupsIndex(): GroupsIndex {
  const { data } = useGroups()
  return useMemo(() => {
    const groups = data ?? []
    return {
      groups,
      groupById: new Map(groups.map((g) => [g.id, g])),
      memberById: new Map(groups.flatMap((g) => g.members.map((m) => [m.id, m]))),
    }
  }, [data])
}

/** "Casa · pagó Ana" para mostrar en una fila. */
export function groupLabel(index: GroupsIndex, group: ExpenseGroup | null): string | null {
  if (!group) return null
  const g = index.groupById.get(group.groupId)
  const m = index.memberById.get(group.paidByMemberId)
  if (!g || !m) return null
  return `${g.name} · pagó ${m.name}`
}
