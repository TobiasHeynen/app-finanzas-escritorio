import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '@main/db/connection'
import { migrate } from '@core/db/migrate'
import { migrations } from '@core/db/migrations'
import { seed } from '@core/db/seed'
import { createServices } from '@core/services'
import { settleUp } from '@core/services/groups'
import type { Group } from '@shared/types'
import { createTestContext, idsByName, type TestContext } from '../helpers/context'

let ctx: TestContext
let svc: ReturnType<typeof createServices>
let ids: ReturnType<typeof idsByName>
let casa: Group
let tobi: number
let ana: number
let lu: number

beforeEach(() => {
  ctx = createTestContext('2026-10-15')
  svc = createServices(ctx)
  ids = idsByName(ctx)
  casa = svc.groups.create({
    name: 'Casa',
    members: ['Tobi', 'Ana', 'Lu'].map((name) => ({ id: null, name })),
  })
  const id = (name: string) => casa.members.find((m) => m.name === name)?.id ?? 0
  tobi = id('Tobi')
  ana = id('Ana')
  lu = id('Lu')
})

const expense = (amountCents: number | null, paidBy: number, split?: unknown) => ({
  subcategoryId: ids.sub('Chino'),
  paymentMethodId: ids.method('Efectivo'),
  description: 'Gasto',
  purchaseDate: '2026-10-10',
  amountCents,
  chargeMonthOverride: null,
  notes: null,
  group: { groupId: casa.id, paidByMemberId: paidBy, ...(split ? { split } : {}) } as never,
})

const balanceOf = (memberId: number) =>
  svc.groups.balance(casa.id).members.find((m) => m.memberId === memberId)?.balanceCents

describe('reparto de un gasto de grupo', () => {
  it('sin reparto: partes iguales entre todos, el resto de centavos a la primera persona', () => {
    const e = svc.expenses.create(expense(100, ana))
    expect(e.group?.split).toEqual({ kind: 'equal', memberIds: [tobi, ana, lu] })
    const b = svc.groups.balance(casa.id)
    expect(b.members.map((m) => [m.memberId, m.paidCents, m.shareCents, m.balanceCents])).toEqual([
      [tobi, 0, 34, -34],
      [ana, 100, 33, 67],
      [lu, 0, 33, -33],
    ])
    expect(b.totalCents).toBe(100)
  })

  it('partes iguales entre algunas personas', () => {
    svc.expenses.create(expense(4_000_000, tobi, { kind: 'equal', memberIds: [tobi, ana] }))
    expect(balanceOf(tobi)).toBe(2_000_000)
    expect(balanceOf(ana)).toBe(-2_000_000)
    expect(balanceOf(lu)).toBe(0)
  })

  it('a mano: tiene que sumar el monto y necesita monto', () => {
    const custom = (a: number, b: number) => ({
      kind: 'custom',
      shares: [
        { memberId: tobi, cents: a },
        { memberId: ana, cents: b },
      ],
    })
    expect(() => svc.expenses.create(expense(1000, tobi, custom(500, 400)))).toThrow(
      /Las partes suman/,
    )
    expect(() => svc.expenses.create(expense(null, tobi, custom(500, 500)))).toThrow(
      'Para repartir a mano, cargá el monto',
    )
    const e = svc.expenses.create(expense(1000, tobi, custom(700, 300)))
    expect(e.group?.split).toEqual(custom(700, 300))
    expect(balanceOf(ana)).toBe(-300)
  })

  it('un pendiente no cuenta hasta que se carga el monto; a mano pasa a partes iguales', () => {
    const e = svc.expenses.create(expense(null, tobi))
    expect(svc.groups.balance(casa.id)).toMatchObject({ totalCents: 0, pendingCount: 1 })
    svc.expenses.setAmount(e.id, 300)
    expect(balanceOf(tobi)).toBe(200)

    const custom = svc.expenses.create(
      expense(1000, ana, {
        kind: 'custom',
        shares: [
          { memberId: tobi, cents: 1000 },
          { memberId: ana, cents: 0 },
        ],
      }),
    )
    expect(svc.expenses.setAmount(custom.id, 2000).group?.split).toEqual({
      kind: 'equal',
      memberIds: [tobi, ana],
    })
  })

  it('un gasto borrado no cuenta', () => {
    const e = svc.expenses.create(expense(900, tobi))
    svc.expenses.remove(e.id)
    expect(svc.groups.balance(casa.id).totalCents).toBe(0)
  })

  it('las cuotas y los recurrentes se reparten entre todos', () => {
    svc.expenses.createPlan({
      subcategoryId: ids.sub('Chino'),
      paymentMethodId: ids.method('VISA'),
      description: 'Heladera',
      purchaseDate: '2026-10-10',
      totalCents: 90_000,
      installmentsCount: 3,
      startAtInstallment: 1,
      firstChargeMonthOverride: null,
      notes: null,
      group: { groupId: casa.id, paidByMemberId: lu },
    })
    expect(balanceOf(lu)).toBe(60_000)
    svc.recurring.create({
      description: 'Internet',
      subcategoryId: ids.sub('Chino'),
      paymentMethodId: ids.method('Efectivo'),
      defaultAmountCents: 3000,
      dayOfMonth: 1,
      startMonth: '2026-10',
      endMonth: null,
      active: true,
      group: { groupId: casa.id, paidByMemberId: tobi },
    })
    expect(balanceOf(tobi)).toBe(-30_000 + 2000)
  })

  it('una persona que se sacó del grupo no entra en repartos nuevos pero conserva su saldo', () => {
    svc.expenses.create(expense(300, lu))
    svc.groups.update(casa.id, {
      name: 'Casa',
      members: [
        { id: tobi, name: 'Tobi' },
        { id: ana, name: 'Ana' },
      ],
    })
    expect(() =>
      svc.expenses.create(expense(100, tobi, { kind: 'equal', memberIds: [tobi, lu] })),
    ).toThrow('Lu ya no está en el grupo')
    expect(svc.expenses.create(expense(100, tobi)).group?.split).toEqual({
      kind: 'equal',
      memberIds: [tobi, ana],
    })
    expect(balanceOf(lu)).toBe(200)
  })
})

describe('saldar', () => {
  it('propone los pagos, registrar uno deja el saldo en cero y se puede deshacer', () => {
    svc.expenses.create(expense(3000, tobi))
    const b = svc.groups.balance(casa.id)
    expect(b.transfers).toEqual([
      { fromMemberId: ana, toMemberId: tobi, amountCents: 1000 },
      { fromMemberId: lu, toMemberId: tobi, amountCents: 1000 },
    ])
    const s = svc.groups.settle({
      groupId: casa.id,
      fromMemberId: ana,
      toMemberId: tobi,
      amountCents: 1000,
      date: '2026-10-15',
      note: '',
    })
    expect(balanceOf(ana)).toBe(0)
    expect(balanceOf(tobi)).toBe(1000)
    expect(svc.groups.balance(casa.id).settlements).toHaveLength(1)
    svc.groups.removeSettlement(s.id)
    expect(balanceOf(ana)).toBe(-1000)
    svc.groups.restoreSettlement(s.id)
    expect(balanceOf(ana)).toBe(0)
  })

  it('saldar no cambia el disponible del mes', () => {
    svc.expenses.create(expense(3000, tobi))
    const before = svc.summary.overview('2026-10').summary.availableCents
    svc.groups.settle({
      groupId: casa.id,
      fromMemberId: ana,
      toMemberId: tobi,
      amountCents: 1000,
      date: '2026-10-15',
      note: '',
    })
    expect(svc.summary.overview('2026-10').summary.availableCents).toBe(before)
  })

  it('rechaza a alguien de otro grupo', () => {
    const otro = svc.groups.create({
      name: 'Viaje',
      members: ['A', 'B'].map((name) => ({ id: null, name })),
    })
    expect(() =>
      svc.groups.settle({
        groupId: casa.id,
        fromMemberId: otro.members[0]?.id ?? 0,
        toMemberId: tobi,
        amountCents: 100,
        date: '2026-10-15',
        note: '',
      }),
    ).toThrow('Esa persona no es del grupo')
  })

  it('settleUp: el que más debe le paga al que más le deben', () => {
    expect(
      settleUp([
        { memberId: 1, balanceCents: 500 },
        { memberId: 2, balanceCents: -300 },
        { memberId: 3, balanceCents: -200 },
        { memberId: 4, balanceCents: 0 },
      ]),
    ).toEqual([
      { fromMemberId: 2, toMemberId: 1, amountCents: 300 },
      { fromMemberId: 3, toMemberId: 1, amountCents: 200 },
    ])
  })
})

describe('migración 003', () => {
  it('reparte en partes iguales los gastos de grupo cargados con la 002', () => {
    const db = openDatabase(':memory:')
    migrate(db, migrations.slice(0, 2))
    seed(db)
    db.prepare("INSERT INTO shared_groups (name) VALUES ('Casa')").run()
    db.prepare("INSERT INTO group_members (group_id, name) VALUES (1, 'A'), (1, 'B')").run()
    db.prepare(
      `INSERT INTO expenses (subcategory_id, payment_method_id, purchase_date, charge_month, amount_cents,
         group_id, paid_by_member_id) VALUES (1, 1, '2026-10-01', '2026-10', 1000, 1, 1)`,
    ).run()
    migrate(db)
    expect(db.prepare('SELECT member_id, share_cents FROM expense_shares').all()).toEqual([
      { member_id: 1, share_cents: null },
      { member_id: 2, share_cents: null },
    ])
  })
})
