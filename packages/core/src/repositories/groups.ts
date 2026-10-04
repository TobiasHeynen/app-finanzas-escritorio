import type { SqlDb as Db } from '../db/sql'
import type { Group, GroupMember, Settlement, SettlementInput } from '@shared/types'
import { nowIso, notFound, translateSqliteError } from './util'

interface GroupRow {
  id: number
  name: string
  archived_at: string | null
}

interface MemberRow {
  id: number
  group_id: number
  name: string
  archived_at: string | null
}

const toMember = (r: MemberRow): GroupMember => ({
  id: r.id,
  groupId: r.group_id,
  name: r.name,
  archived: r.archived_at !== null,
})

interface SettlementRow {
  id: number
  group_id: number
  from_member_id: number
  to_member_id: number
  amount_cents: number
  date: string
  note: string
}

const toSettlement = (r: SettlementRow): Settlement => ({
  id: r.id,
  groupId: r.group_id,
  fromMemberId: r.from_member_id,
  toMemberId: r.to_member_id,
  amountCents: r.amount_cents,
  date: r.date,
  note: r.note,
})

const DUP_GROUP = { unique: 'Ya existe un grupo con ese nombre' }

export type GroupsRepo = ReturnType<typeof createGroupsRepo>

export function createGroupsRepo(db: Db) {
  const stmts = {
    groups: db.prepare<[], GroupRow>(
      'SELECT * FROM shared_groups ORDER BY archived_at IS NOT NULL, sort_order, id',
    ),
    group: db.prepare<[number], GroupRow>('SELECT * FROM shared_groups WHERE id = ?'),
    members: db.prepare<[], MemberRow>('SELECT * FROM group_members ORDER BY sort_order, id'),
    membersOf: db.prepare<[number], MemberRow>(
      'SELECT * FROM group_members WHERE group_id = ? ORDER BY sort_order, id',
    ),
    member: db.prepare<[number], MemberRow>('SELECT * FROM group_members WHERE id = ?'),
    nextOrder: db.prepare<[], { n: number }>(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM shared_groups',
    ),
    insertGroup: db.prepare('INSERT INTO shared_groups (name, sort_order) VALUES (?, ?)'),
    renameGroup: db.prepare('UPDATE shared_groups SET name = ? WHERE id = ?'),
    archiveGroup: db.prepare('UPDATE shared_groups SET archived_at = ? WHERE id = ?'),
    insertMember: db.prepare(
      'INSERT INTO group_members (group_id, name, sort_order) VALUES (?, ?, ?)',
    ),
    updateMember: db.prepare(
      'UPDATE group_members SET name = ?, sort_order = ?, archived_at = NULL WHERE id = ?',
    ),
    settlements: db.prepare<[number], SettlementRow>(
      'SELECT * FROM group_settlements WHERE group_id = ? AND deleted_at IS NULL ORDER BY date DESC, id DESC',
    ),
    settlement: db.prepare<[number], SettlementRow>(
      'SELECT * FROM group_settlements WHERE id = ? AND deleted_at IS NULL',
    ),
    insertSettlement: db.prepare(
      `INSERT INTO group_settlements (group_id, from_member_id, to_member_id, amount_cents, date, note)
       VALUES (@groupId, @fromMemberId, @toMemberId, @amountCents, @date, @note)`,
    ),
    deleteSettlement: db.prepare(
      'UPDATE group_settlements SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
    ),
    restoreSettlement: db.prepare(
      'UPDATE group_settlements SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
    ),
    archiveMember: db.prepare(
      'UPDATE group_members SET archived_at = ? WHERE id = ? AND archived_at IS NULL',
    ),
  }

  const mapGroup = (r: GroupRow, members: MemberRow[]): Group => ({
    id: r.id,
    name: r.name,
    archived: r.archived_at !== null,
    members: members.map(toMember),
  })

  function get(id: number): Group {
    const row = stmts.group.get(id) ?? notFound('El grupo')
    return mapGroup(row, stmts.membersOf.all(id))
  }

  return {
    list(): Group[] {
      const byGroup = new Map<number, MemberRow[]>()
      for (const m of stmts.members.all()) {
        const list = byGroup.get(m.group_id) ?? []
        list.push(m)
        byGroup.set(m.group_id, list)
      }
      return stmts.groups.all().map((g) => mapGroup(g, byGroup.get(g.id) ?? []))
    },

    get,

    getMember: (id: number): GroupMember =>
      toMember(stmts.member.get(id) ?? notFound('La persona')),

    insertGroup(name: string): number {
      try {
        const { n } = stmts.nextOrder.get() ?? { n: 0 }
        return Number(stmts.insertGroup.run(name, n).lastInsertRowid)
      } catch (err) {
        return translateSqliteError(err, DUP_GROUP)
      }
    },

    renameGroup(id: number, name: string): void {
      try {
        if (stmts.renameGroup.run(name, id).changes === 0) notFound('El grupo')
      } catch (err) {
        translateSqliteError(err, DUP_GROUP)
      }
    },

    setGroupArchived(id: number, archived: boolean): void {
      if (stmts.archiveGroup.run(archived ? nowIso() : null, id).changes === 0) notFound('El grupo')
    },

    insertMember(groupId: number, name: string, sortOrder: number): number {
      return Number(stmts.insertMember.run(groupId, name, sortOrder).lastInsertRowid)
    },

    /** Renombra, reordena y (si estaba archivada) vuelve a activar a una persona. */
    updateMember(id: number, name: string, sortOrder: number): void {
      if (stmts.updateMember.run(name, sortOrder, id).changes === 0) notFound('La persona')
    },

    archiveMember(id: number): void {
      stmts.archiveMember.run(nowIso(), id)
    },

    listSettlements: (groupId: number): Settlement[] =>
      stmts.settlements.all(groupId).map(toSettlement),

    insertSettlement(input: SettlementInput): Settlement {
      const id = Number(stmts.insertSettlement.run(input).lastInsertRowid)
      return toSettlement(stmts.settlement.get(id) ?? notFound('El pago'))
    },

    removeSettlement(id: number): void {
      if (stmts.deleteSettlement.run(nowIso(), id).changes === 0) notFound('El pago')
    },

    restoreSettlement(id: number): void {
      stmts.restoreSettlement.run(id)
    },
  }
}
