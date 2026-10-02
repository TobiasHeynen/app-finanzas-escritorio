import type { SqlDb as Db } from './sql'

interface SeedCategory {
  name: string
  icon: string
  color: string
  subcategories: string[]
}

/** Categorías iniciales (editables desde Configuración). Íconos: nombres de lucide en kebab-case. */
export const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: 'Gastos fijos',
    icon: 'house',
    color: '#6366f1',
    subcategories: ['Alquiler', 'Expensas', 'Luz', 'Gas', 'Internet', 'Celular'],
  },
  {
    name: 'Supermercado',
    icon: 'shopping-cart',
    color: '#10b981',
    subcategories: ['Chino', 'Verdulería', 'Carnicería', 'Delivery', 'Pedidos Ya - Mercado'],
  },
  { name: 'Formación', icon: 'graduation-cap', color: '#0ea5e9', subcategories: ['Cursos'] },
  {
    name: 'Ocio',
    icon: 'party-popper',
    color: '#f59e0b',
    subcategories: ['Vacaciones', 'Salidas', 'Uber', 'Apuestas', 'Otros'],
  },
  { name: 'Salud', icon: 'heart-pulse', color: '#ef4444', subcategories: ['Gimnasio', 'Médico'] },
  {
    name: 'Hogar',
    icon: 'sofa',
    color: '#8b5cf6',
    subcategories: ['Electrodomésticos', 'Mantenimiento'],
  },
  { name: 'Ropa', icon: 'shirt', color: '#ec4899', subcategories: ['Ropa'] },
  { name: 'Suscripciones', icon: 'tv', color: '#14b8a6', subcategories: ['Juegos/Streaming'] },
  { name: 'Créditos', icon: 'landmark', color: '#64748b', subcategories: ['Préstamo ANSES'] },
]

export const SEED_PAYMENT_METHODS = [
  { name: 'Efectivo', type: 'efectivo', closingDay: null, dueDay: null, color: '#22c55e' },
  { name: 'Débito', type: 'debito', closingDay: null, dueDay: null, color: '#0ea5e9' },
  {
    name: 'Transferencia',
    type: 'transferencia',
    closingDay: null,
    dueDay: null,
    color: '#a855f7',
  },
  // Día de cierre aproximado: se ajusta en Configuración.
  { name: 'VISA', type: 'tarjeta_credito', closingDay: 25, dueDay: 5, color: '#1d4ed8' },
  { name: 'MASTERCARD', type: 'tarjeta_credito', closingDay: 25, dueDay: 5, color: '#ea580c' },
] as const

const SEEDED_KEY = 'seeded_at'

/**
 * Carga los datos iniciales una sola vez (la primera vez que se crea la base).
 * Queda marcado en settings: si después borrás o archivás todo, no se vuelve a sembrar.
 */
export function seed(db: Db): boolean {
  const already = db.prepare('SELECT 1 FROM settings WHERE key = ?').get(SEEDED_KEY)
  if (already) return false

  db.transaction(() => {
    const insertCategory = db.prepare(
      'INSERT INTO categories (name, icon, color, sort_order) VALUES (?, ?, ?, ?)',
    )
    const insertSub = db.prepare(
      'INSERT INTO subcategories (category_id, name, sort_order) VALUES (?, ?, ?)',
    )
    SEED_CATEGORIES.forEach((c, i) => {
      const id = insertCategory.run(c.name, c.icon, c.color, i).lastInsertRowid
      c.subcategories.forEach((name, j) => insertSub.run(id, name, j))
    })

    const insertMethod = db.prepare(
      `INSERT INTO payment_methods (name, type, closing_day, due_day, color, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    SEED_PAYMENT_METHODS.forEach((m, i) =>
      insertMethod.run(m.name, m.type, m.closingDay, m.dueDay, m.color, i),
    )

    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      SEEDED_KEY,
      new Date().toISOString(),
    )
  })()
  return true
}
