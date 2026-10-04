import { beforeEach, describe, expect, it } from 'vitest'
import { createServices } from '@core/services'
import { AppError } from '@shared/errors'
import type { Group } from '@shared/types'
import { createTestContext, idsByName, type TestContext } from '../helpers/context'

let ctx: TestContext
let svc: ReturnType<typeof createServices>
let ids: ReturnType<typeof idsByName>

beforeEach(() => {
  ctx = createTestContext('2026-10-15')
  svc = createServices(ctx)
  ids = idsByName(ctx)
})

const newMembers = (...names: string[]) => names.map((name) => ({ id: null, name }))
const memberId = (g: Group, name: string): number => {
  const m = g.members.find((x) => x.name === name)
  if (!m) throw new Error(`No está ${name}`)
  return m.id
}
const active = (g: Group) => g.members.filter((m) => !m.archived).map((m) => m.name)

const expense = () => ({
  subcategoryId: ids.sub('Chino'),
  paymentMethodId: ids.method('Efectivo'),
  description: 'Cena',
  purchaseDate: '2026-10-10',
  amountCents: 4_000_000,
  chargeMonthOverride: null,
  notes: null,
})

describe('grupos', () => {
  it('crea un grupo con sus personas en orden', () => {
    const g = svc.groups.create({ name: 'Casa', members: newMembers('Ana', 'Tobi') })
    expect(g.name).toBe('Casa')
    expect(active(g)).toEqual(['Ana', 'Tobi'])
    expect(svc.groups.list()).toHaveLength(1)
  })

  it('no deja dos grupos con el mismo nombre', () => {
    svc.groups.create({ name: 'Casa', members: newMembers('Ana', 'Tobi') })
    expect(() => svc.groups.create({ name: 'casa', members: newMembers('A', 'B') })).toThrow(
      AppError,
    )
  })

  it('renombra, reordena e intercambia nombres sin chocar', () => {
    const g = svc.groups.create({ name: 'Casa', members: newMembers('Ana', 'Tobi') })
    const ana = memberId(g, 'Ana')
    const tobi = memberId(g, 'Tobi')
    const u = svc.groups.update(g.id, {
      name: 'Depto',
      members: [
        { id: ana, name: 'Tobi' },
        { id: tobi, name: 'Ana' },
      ],
    })
    expect(u.name).toBe('Depto')
    expect(u.members.map((m) => [m.id, m.name])).toEqual([
      [ana, 'Tobi'],
      [tobi, 'Ana'],
    ])
  })

  it('archiva a quien se saca y lo reactiva si se vuelve a agregar con el mismo nombre', () => {
    const g = svc.groups.create({ name: 'Viaje', members: newMembers('Ana', 'Tobi', 'Lu') })
    const lu = memberId(g, 'Lu')
    const sinLu = svc.groups.update(g.id, {
      name: 'Viaje',
      members: g.members.filter((m) => m.name !== 'Lu').map((m) => ({ id: m.id, name: m.name })),
    })
    expect(active(sinLu)).toEqual(['Ana', 'Tobi'])
    expect(sinLu.members.find((m) => m.id === lu)?.archived).toBe(true)

    const conLu = svc.groups.update(g.id, {
      name: 'Viaje',
      members: [
        ...sinLu.members.filter((m) => !m.archived).map((m) => ({ id: m.id, name: m.name })),
        { id: null, name: 'lu' },
      ],
    })
    expect(conLu.members).toHaveLength(3)
    expect(conLu.members.find((m) => m.id === lu)).toMatchObject({ name: 'lu', archived: false })
  })

  it('rechaza nombres repetidos y menos de 2 personas', async () => {
    const { groupInputSchema } = await import('@shared/schemas')
    expect(groupInputSchema.safeParse({ name: 'X', members: newMembers('Ana') }).success).toBe(
      false,
    )
    expect(
      groupInputSchema.safeParse({ name: 'X', members: newMembers('Ana', 'ana') }).success,
    ).toBe(false)
  })
})

describe('gastos de un grupo', () => {
  let casa: Group
  beforeEach(() => {
    casa = svc.groups.create({ name: 'Casa', members: newMembers('Ana', 'Tobi') })
  })

  it('guarda el grupo y quién pagó; sin grupo queda personal', () => {
    const group = { groupId: casa.id, paidByMemberId: memberId(casa, 'Ana') }
    expect(svc.expenses.create({ ...expense(), group }).group).toEqual(group)
    expect(svc.expenses.create(expense()).group).toBeNull()
  })

  it('se puede sacar o cambiar el grupo al editar', () => {
    const e = svc.expenses.create({
      ...expense(),
      group: { groupId: casa.id, paidByMemberId: memberId(casa, 'Ana') },
    })
    const tobi = { groupId: casa.id, paidByMemberId: memberId(casa, 'Tobi') }
    expect(svc.expenses.update(e.id, { ...expense(), group: tobi }).group).toEqual(tobi)
    expect(svc.expenses.update(e.id, { ...expense(), group: null }).group).toBeNull()
  })

  it('rechaza a una persona de otro grupo', () => {
    const viaje = svc.groups.create({ name: 'Viaje', members: newMembers('Lu', 'Mar') })
    expect(() =>
      svc.expenses.create({
        ...expense(),
        group: { groupId: casa.id, paidByMemberId: memberId(viaje, 'Lu') },
      }),
    ).toThrow('Esa persona no es del grupo')
  })

  it('no deja cargar con un grupo archivado, pero sí editar un gasto que ya era de ese grupo', () => {
    const group = { groupId: casa.id, paidByMemberId: memberId(casa, 'Ana') }
    const e = svc.expenses.create({ ...expense(), group })
    svc.groups.setArchived(casa.id, true)
    expect(() => svc.expenses.create({ ...expense(), group })).toThrow('archivado')
    expect(svc.expenses.update(e.id, { ...expense(), description: 'Otra', group }).group).toEqual(
      group,
    )
  })

  it('no deja elegir como pagador a alguien que se sacó del grupo', () => {
    const ana = memberId(casa, 'Ana')
    svc.groups.update(casa.id, {
      name: 'Casa',
      members: [
        { id: memberId(casa, 'Tobi'), name: 'Tobi' },
        { id: null, name: 'Lu' },
      ],
    })
    expect(() =>
      svc.expenses.create({ ...expense(), group: { groupId: casa.id, paidByMemberId: ana } }),
    ).toThrow('Ana ya no está en el grupo')
  })

  it('duplicar copia el grupo', () => {
    const group = { groupId: casa.id, paidByMemberId: memberId(casa, 'Tobi') }
    const e = svc.expenses.create({ ...expense(), group })
    expect(svc.expenses.duplicate(e.id).group).toEqual(group)
  })

  it('las cuotas llevan el grupo del plan, también al editarlo', () => {
    const ana = { groupId: casa.id, paidByMemberId: memberId(casa, 'Ana') }
    const plan = svc.expenses.createPlan({
      subcategoryId: ids.sub('Chino'),
      paymentMethodId: ids.method('VISA'),
      description: 'Heladera',
      purchaseDate: '2026-10-10',
      totalCents: 300_000,
      installmentsCount: 3,
      startAtInstallment: 1,
      firstChargeMonthOverride: null,
      notes: null,
      group: ana,
    })
    expect(plan.group).toEqual(ana)
    expect(ctx.repos.expenses.listByPlan(plan.id).map((e) => e.group)).toEqual([ana, ana, ana])

    const tobi = { groupId: casa.id, paidByMemberId: memberId(casa, 'Tobi') }
    const edited = svc.expenses.updatePlan(
      plan.id,
      {
        subcategoryId: ids.sub('Chino'),
        paymentMethodId: ids.method('VISA'),
        description: 'Heladera',
        totalCents: 300_000,
        installmentsCount: 3,
        notes: null,
        group: tobi,
      },
      'all',
    )
    expect(edited.group).toEqual(tobi)
    expect(
      ctx.repos.expenses
        .listByPlan(plan.id)
        .every((e) => e.group?.paidByMemberId === tobi.paidByMemberId),
    ).toBe(true)
  })

  it('los recurrentes generan y proyectan con su grupo', () => {
    const group = { groupId: casa.id, paidByMemberId: memberId(casa, 'Ana') }
    const t = svc.recurring.create({
      description: 'Alquiler',
      subcategoryId: ids.sub('Chino'),
      paymentMethodId: ids.method('Efectivo'),
      defaultAmountCents: 50_000_000,
      dayOfMonth: 1,
      startMonth: '2026-09',
      endMonth: null,
      active: true,
      group,
    })
    expect(t.group).toEqual(group)
    const generated = ctx.repos.expenses
      .listByRange('2026-09', '2026-10')
      .filter((e) => e.recurringTemplateId === t.id)
    expect(generated).toHaveLength(2)
    expect(generated.every((e) => e.group?.groupId === casa.id)).toBe(true)
    expect(svc.recurring.projectionsFor('2026-11')[0]?.group).toEqual(group)
  })
})
