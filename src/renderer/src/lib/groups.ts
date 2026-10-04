import { useMemo } from 'react'
import type { ExpenseGroup, ExpenseSplit, Group, GroupMember } from '@shared/types'
import { keys, useApiQuery } from './hooks'

export function useGroups() {
  return useApiQuery('groups:list', {}, keys.groups)
}

export interface GroupsIndex {
  groups: Group[]
  /** Grupos no archivados, para elegir al cargar un gasto. */
  active: Group[]
  groupById: Map<number, Group>
  memberById: Map<number, GroupMember>
}

export function useGroupsIndex(): GroupsIndex {
  const { data } = useGroups()
  return useMemo(() => {
    const groups = data ?? []
    return {
      groups,
      active: groups.filter((g) => !g.archived),
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

const lastPayerKey = (groupId: number) => `mis-finanzas:last-payer:${String(groupId)}`

export function readLastPayer(groupId: number): number | null {
  try {
    const v = Number(localStorage.getItem(lastPayerKey(groupId)))
    return Number.isInteger(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/** Recuerda quién pagó por última vez en cada grupo, para proponerlo la próxima. */
export function rememberPayer(group: ExpenseGroup | null): void {
  if (!group) return
  try {
    localStorage.setItem(lastPayerKey(group.groupId), String(group.paidByMemberId))
  } catch {
    // opcional
  }
}

/** Reparto por defecto: partes iguales entre las personas activas. */
export function defaultSplit(group: Group): ExpenseSplit {
  return { kind: 'equal', memberIds: group.members.filter((m) => !m.archived).map((m) => m.id) }
}
