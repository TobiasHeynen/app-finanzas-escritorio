import { beforeEach, describe, expect, it } from 'vitest'
import { createRecurringService } from '@core/services/recurring'
import { monthsToGenerate } from '@core/services/recurring-schedule'
import { createTestContext, idsByName, type TestContext } from '../helpers/context'

describe('monthsToGenerate', () => {
  const t = { startMonth: '2026-08', endMonth: null, active: true }
  it('incluye desde el inicio hasta el mes actual', () => {
    expect(monthsToGenerate(t, new Set(), '2026-10')).toEqual(['2026-08', '2026-09', '2026-10'])
  })
  it('saltea los ya generados', () => {
    expect(monthsToGenerate(t, new Set(['2026-08', '2026-10']), '2026-10')).toEqual(['2026-09'])
  })
  it('respeta el mes de fin y las inactivas', () => {
    expect(monthsToGenerate({ ...t, endMonth: '2026-09' }, new Set(), '2026-12')).toEqual([
      '2026-08',
      '2026-09',
    ])
    expect(monthsToGenerate({ ...t, active: false }, new Set(), '2026-12')).toEqual([])
  })
  it('no genera si empieza en el futuro', () => {
    expect(monthsToGenerate({ ...t, startMonth: '2027-01' }, new Set(), '2026-12')).toEqual([])
  })
})

describe('servicio de recurrentes', () => {
  let ctx: TestContext
  let svc: ReturnType<typeof createRecurringService>
  let ids: ReturnType<typeof idsByName>

  beforeEach(() => {
    ctx = createTestContext('2026-10-15')
    svc = createRecurringService(ctx)
    ids = idsByName(ctx)
  })

  const alquiler = () => ({
    description: 'Alquiler',
    subcategoryId: ids.sub('Alquiler'),
    paymentMethodId: ids.method('Transferencia'),
    defaultAmountCents: 70000000,
    dayOfMonth: 1,
    startMonth: '2026-10',
    endMonth: null,
    active: true,
  })

  const countExpenses = () =>
    (
      ctx.db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE deleted_at IS NULL').get() as {
        n: number
      }
    ).n

  it('genera el gasto del mes una sola vez (idempotente)', () => {
    svc.create(alquiler())
    expect(countExpenses()).toBe(1)
    expect(svc.generateDue()).toBe(0)
    expect(svc.generateDue()).toBe(0)
    expect(countExpenses()).toBe(1)
    const [e] = ctx.repos.expenses.listByMonth('2026-10')
    expect(e?.amountCents).toBe(70000000)
    expect(e?.purchaseDate).toBe('2026-10-01')
    expect(e?.recurringTemplateId).not.toBeNull()
  })

  it('completa los meses que faltan si no se abrió la app', () => {
    svc.create({ ...alquiler(), startMonth: '2026-07' })
    expect(countExpenses()).toBe(4) // jul, ago, sep, oct
    ctx.clock.set('2027-01-03')
    expect(svc.generateDue()).toBe(3) // nov, dic, ene
    expect(svc.generateDue()).toBe(0)
  })

  it('sin monto por defecto quedan pendientes', () => {
    svc.create({
      ...alquiler(),
      description: 'Luz',
      subcategoryId: ids.sub('Luz'),
      defaultAmountCents: null,
    })
    const [e] = ctx.repos.expenses.listByMonth('2026-10')
    expect(e?.amountCents).toBeNull()
  })

  it('si se borra el gasto generado no se vuelve a generar', () => {
    svc.create(alquiler())
    const [e] = ctx.repos.expenses.listByMonth('2026-10')
    ctx.repos.expenses.softDelete([e!.id])
    ctx.repos.expenses.purgeDeletedBefore('9999-01-01')
    expect(svc.generateDue()).toBe(0)
    expect(countExpenses()).toBe(0)
  })

  it('ajusta el día al largo del mes', () => {
    svc.create({ ...alquiler(), dayOfMonth: 31, startMonth: '2026-09' })
    expect(ctx.repos.expenses.listByMonth('2026-09')[0]?.purchaseDate).toBe('2026-09-30')
  })

  it('proyecta meses futuros sin guardarlos', () => {
    svc.create(alquiler())
    const projected = svc.projectionsFor('2026-12')
    expect(projected).toHaveLength(1)
    expect(projected[0]?.amountCents).toBe(70000000)
    expect(svc.projectionsFor('2026-10')).toEqual([])
    expect(countExpenses()).toBe(1)
  })

  it('una plantilla inactiva no genera ni proyecta', () => {
    svc.create({ ...alquiler(), active: false })
    expect(countExpenses()).toBe(0)
    expect(svc.projectionsFor('2026-12')).toEqual([])
  })

  it('borrar la plantilla deja los gastos generados', () => {
    const t = svc.create(alquiler())
    svc.remove(t.id)
    expect(countExpenses()).toBe(1)
    expect(ctx.repos.expenses.listByMonth('2026-10')[0]?.recurringTemplateId).toBeNull()
  })
})
