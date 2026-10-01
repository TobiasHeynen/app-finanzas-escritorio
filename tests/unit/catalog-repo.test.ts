import { describe, expect, it } from 'vitest'
import { AppError } from '@shared/errors'
import { createTestContext } from '../helpers/context'

describe('repositorio de categorías', () => {
  it('lista categorías con subcategorías en orden', () => {
    const { repos } = createTestContext()
    const cats = repos.catalog.listCategories()
    expect(cats[0]?.name).toBe('Gastos fijos')
    expect(cats[0]?.subcategories.map((s) => s.name)).toEqual([
      'Alquiler',
      'Expensas',
      'Luz',
      'Gas',
      'Internet',
      'Celular',
    ])
  })

  it('crea, renombra y rechaza duplicados sin importar mayúsculas', () => {
    const { repos } = createTestContext()
    const c = repos.catalog.createCategory({ name: 'Mascotas', icon: 'dog', color: '#123456' })
    expect(c.sortOrder).toBe(9)
    expect(() =>
      repos.catalog.createCategory({ name: 'mascotas', icon: 'dog', color: '#123456' }),
    ).toThrow(AppError)
    const s = repos.catalog.createSubcategory(c.id, 'Veterinaria')
    expect(() => repos.catalog.createSubcategory(c.id, 'VETERINARIA')).toThrow(/Ya existe/)
    expect(repos.catalog.renameSubcategory(s.id, 'Vete').name).toBe('Vete')
  })

  it('archiva y desarchiva', () => {
    const { repos } = createTestContext()
    const [first] = repos.catalog.listCategories()
    expect(repos.catalog.setCategoryArchived(first!.id, true).archived).toBe(true)
    expect(repos.catalog.setCategoryArchived(first!.id, false).archived).toBe(false)
  })

  it('reordena', () => {
    const { repos } = createTestContext()
    const ids = repos.catalog.listCategories().map((c) => c.id)
    repos.catalog.reorderCategories([...ids].reverse())
    expect(repos.catalog.listCategories().map((c) => c.id)).toEqual([...ids].reverse())
  })

  it('medios de pago: valida tarjetas y duplicados', () => {
    const { repos } = createTestContext()
    const naranja = repos.paymentMethods.create({
      name: 'Naranja',
      type: 'tarjeta_credito',
      closingDay: 20,
      dueDay: 5,
      color: null,
    })
    expect(naranja.closingDay).toBe(20)
    expect(() =>
      repos.paymentMethods.create({
        name: 'naranja',
        type: 'efectivo',
        closingDay: null,
        dueDay: null,
        color: null,
      }),
    ).toThrow(AppError)
  })

  it('settings', () => {
    const { repos } = createTestContext()
    expect(repos.settings.get('theme')).toBeNull()
    repos.settings.set('theme', 'dark')
    repos.settings.set('theme', 'light')
    expect(repos.settings.get('theme')).toBe('light')
  })
})
