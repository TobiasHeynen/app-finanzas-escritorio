import { AppError } from '@shared/errors'
import { formatMoney, splitInstallments, sumCents } from '@shared/money'
import type {
  Expense,
  ExpenseGroup,
  ExpenseSplit,
  Group,
  GroupBalance,
  GroupInput,
  Settlement,
  SettlementInput,
} from '@shared/types'
import type { Repos } from '../repositories'
import type { ShareWrite } from '../repositories/expenses'
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

const splitMemberIds = (split: ExpenseSplit): number[] =>
  split.kind === 'equal' ? split.memberIds : split.shares.map((s) => s.memberId)

/** Partes iguales entre las personas activas del grupo (cuotas, recurrentes, gastos sin reparto). */
export function equalShares(repos: Repos, groupId: number): ShareWrite[] {
  return repos.groups
    .get(groupId)
    .members.filter((m) => !m.archived)
    .map((m) => ({ memberId: m.id, cents: null }))
}

/**
 * Valida el grupo y el reparto de un gasto y devuelve qué guardar. Sin reparto = partes iguales entre las
 * personas activas. A mano, las partes tienen que sumar el monto. Una persona archivada sólo puede
 * seguir en el reparto si ya estaba en el del gasto que se edita.
 */
export function resolveExpenseGroup(
  repos: Repos,
  input: (ExpenseGroup & { split?: ExpenseSplit | undefined }) | null | undefined,
  amountCents: number | null,
  previous?: (ExpenseGroup & { split: ExpenseSplit }) | null,
): { group: ExpenseGroup | null; shares: ShareWrite[] } {
  const group = checkExpenseGroup(repos, input, previous)
  if (!group || !input) return { group: null, shares: [] }
  if (!input.split) return { group, shares: equalShares(repos, group.groupId) }

  const g = repos.groups.get(group.groupId)
  const before = previous?.groupId === g.id ? splitMemberIds(previous.split) : []
  const ids = splitMemberIds(input.split)
  if (new Set(ids).size !== ids.length) {
    throw new AppError('VALIDATION', 'Hay una persona repetida en el reparto', {
      split: 'Repetida',
    })
  }
  for (const id of ids) {
    const m = g.members.find((x) => x.id === id)
    if (!m)
      throw new AppError('VALIDATION', 'Esa persona no es del grupo', { split: 'No es del grupo' })
    if (m.archived && !before.includes(id)) {
      throw new AppError('VALIDATION', `${m.name} ya no está en el grupo`, { split: 'Archivada' })
    }
  }
  if (input.split.kind === 'equal') {
    return { group, shares: ids.map((memberId) => ({ memberId, cents: null })) }
  }
  if (amountCents === null) {
    throw new AppError('VALIDATION', 'Para repartir a mano, cargá el monto', { split: 'Sin monto' })
  }
  const total = sumCents(input.split.shares.map((x) => x.cents))
  if (total !== amountCents) {
    throw new AppError(
      'VALIDATION',
      `Las partes suman ${formatMoney(total)} y el gasto es de ${formatMoney(amountCents)}`,
      { split: 'No suma el monto' },
    )
  }
  return {
    group,
    shares: input.split.shares.map((x) => ({ memberId: x.memberId, cents: x.cents })),
  }
}

/**
 * Cuánto le toca a cada persona de un gasto. Partes iguales: el resto de centavos va a la primera en el
 * orden del grupo (igual que en las cuotas). Un gasto pendiente no reparte nada.
 */
export function expenseShareAmounts(
  expense: Pick<Expense, 'amountCents' | 'group'>,
  memberOrder: number[],
): Map<number, number> {
  const out = new Map<number, number>()
  const { group, amountCents } = expense
  if (!group || amountCents === null) return out
  if (group.split.kind === 'custom') {
    for (const s of group.split.shares) out.set(s.memberId, (out.get(s.memberId) ?? 0) + s.cents)
    return out
  }
  const position = (id: number) => {
    const i = memberOrder.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const ids = [
    ...(group.split.memberIds.length > 0 ? group.split.memberIds : [group.paidByMemberId]),
  ]
  ids.sort((a, b) => position(a) - position(b) || a - b)
  splitInstallments(amountCents, ids.length).forEach((cents, i) => {
    const id = ids[i]
    if (id !== undefined) out.set(id, cents)
  })
  return out
}

/** La menor cantidad de pagos (aproximada, la clásica de "el que más debe le paga al que más le deben"). */
export function settleUp(
  balances: { memberId: number; balanceCents: number }[],
): GroupBalance['transfers'] {
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ id: b.memberId, left: -b.balanceCents }))
    .sort((a, b) => b.left - a.left)
  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ id: b.memberId, left: b.balanceCents }))
    .sort((a, b) => b.left - a.left)
  const transfers: GroupBalance['transfers'] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    if (!d || !c) break
    const amount = Math.min(d.left, c.left)
    transfers.push({ fromMemberId: d.id, toMemberId: c.id, amountCents: amount })
    d.left -= amount
    c.left -= amount
    if (d.left === 0) i++
    if (c.left === 0) j++
  }
  return transfers
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

    /** Cuánto puso cada uno, cuánto le tocaba, el saldo (con los pagos para saldar) y cómo quedar a mano. */
    balance(groupId: number): GroupBalance {
      const g = groups.get(groupId)
      const order = g.members.map((m) => m.id)
      const paid = new Map<number, number>()
      const share = new Map<number, number>()
      const add = (map: Map<number, number>, id: number, cents: number) =>
        map.set(id, (map.get(id) ?? 0) + cents)
      const expenses = repos.expenses.listByGroup(groupId)
      let total = 0
      let pending = 0
      for (const e of expenses) {
        if (e.amountCents === null || !e.group) {
          pending++
          continue
        }
        total += e.amountCents
        add(paid, e.group.paidByMemberId, e.amountCents)
        for (const [id, cents] of expenseShareAmounts(e, order)) add(share, id, cents)
      }
      const settlements = groups.listSettlements(groupId)
      const settled = new Map<number, number>()
      for (const s of settlements) {
        add(settled, s.fromMemberId, s.amountCents)
        add(settled, s.toMemberId, -s.amountCents)
      }
      // Las personas archivadas aparecen sólo si tienen algo (gastos o saldo).
      const members = g.members
        .map((m) => {
          const paidCents = paid.get(m.id) ?? 0
          const shareCents = share.get(m.id) ?? 0
          return {
            memberId: m.id,
            archived: m.archived,
            paidCents,
            shareCents,
            balanceCents: paidCents - shareCents + (settled.get(m.id) ?? 0),
          }
        })
        .filter((m) => !m.archived || m.paidCents > 0 || m.shareCents > 0 || m.balanceCents !== 0)
        .map(({ archived: _archived, ...m }) => m)
      return {
        groupId,
        totalCents: total,
        expenseCount: expenses.length - pending,
        pendingCount: pending,
        members,
        transfers: settleUp(members),
        settlements,
      }
    },

    settle(input: SettlementInput): Settlement {
      const g = groups.get(input.groupId)
      for (const id of [input.fromMemberId, input.toMemberId]) {
        if (!g.members.some((m) => m.id === id)) {
          throw new AppError('VALIDATION', 'Esa persona no es del grupo')
        }
      }
      return groups.insertSettlement(input)
    },

    removeSettlement: (id: number): void => groups.removeSettlement(id),
    restoreSettlement: (id: number): void => groups.restoreSettlement(id),
  }
}
