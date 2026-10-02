import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openDatabase } from '@main/db/connection'
import { getSchemaVersion, migrate, pendingMigrations, SchemaTooNewError } from '@core/db/migrate'
import { migrations, parseMigrationFiles } from '@core/db/migrations'
import { renderMigrations } from '../../scripts/gen-migrations.mjs'
import { seed, SEED_CATEGORIES, SEED_PAYMENT_METHODS } from '@core/db/seed'

describe('migraciones', () => {
  it('aplica todas desde cero y registra las versiones', () => {
    const db = openDatabase(':memory:')
    const applied = migrate(db)
    expect(applied).toEqual(migrations.map((m) => m.version))
    expect(getSchemaVersion(db)).toBe(migrations.length)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name)
    for (const t of [
      'categories',
      'subcategories',
      'payment_methods',
      'expenses',
      'installment_plans',
      'recurring_templates',
      'recurring_generations',
      'incomes',
      'savings_goals',
      'savings_movements',
      'settings',
      'schema_migrations',
    ]) {
      expect(tables).toContain(t)
    }
  })

  it('es idempotente: correr dos veces no aplica nada nuevo', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(migrate(db)).toEqual([])
    expect(pendingMigrations(db)).toEqual([])
  })

  it('aplica sólo las pendientes de forma incremental', () => {
    const db = openDatabase(':memory:')
    const first = [{ version: 1, name: 'a', sql: 'CREATE TABLE a (x INTEGER);' }]
    const both = [...first, { version: 2, name: 'b', sql: 'ALTER TABLE a ADD COLUMN y TEXT;' }]
    expect(migrate(db, first)).toEqual([1])
    db.prepare('INSERT INTO a (x) VALUES (1)').run()
    expect(migrate(db, both)).toEqual([2])
    expect(db.prepare('SELECT x, y FROM a').get()).toEqual({ x: 1, y: null })
  })

  it('revierte una migración que falla y no la registra', () => {
    const db = openDatabase(':memory:')
    const list = [
      { version: 1, name: 'ok', sql: 'CREATE TABLE a (x INTEGER);' },
      { version: 2, name: 'rota', sql: 'CREATE TABLE b (x INTEGER); INSERT INTO nope VALUES (1);' },
    ]
    expect(() => migrate(db, list)).toThrow()
    expect(getSchemaVersion(db)).toBe(1)
    const b = db.prepare("SELECT name FROM sqlite_master WHERE name = 'b'").get()
    expect(b).toBeUndefined()
  })

  it('rechaza una base de una versión más nueva', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    db.prepare("INSERT INTO schema_migrations VALUES (999, 'futuro', '2030-01-01')").run()
    expect(() => migrate(db)).toThrow(SchemaTooNewError)
  })

  it('migrations.generated.ts está al día con los .sql (si falla: node scripts/gen-migrations.mjs)', () => {
    const generated = readFileSync(
      join(import.meta.dirname, '../../packages/core/src/db/migrations.generated.ts'),
      'utf8',
    )
    expect(generated).toBe(renderMigrations())
  })

  it('valida los nombres y la secuencia de archivos', () => {
    expect(() => parseMigrationFiles({ './migrations/x.sql': '' })).toThrow()
    expect(() =>
      parseMigrationFiles({ './migrations/001_a.sql': '', './migrations/003_c.sql': '' }),
    ).toThrow(/Falta la migración 2/)
    expect(parseMigrationFiles({ './m/002_b.sql': 'B', './m/001_a.sql': 'A' })).toEqual([
      { version: 1, name: 'a', sql: 'A' },
      { version: 2, name: 'b', sql: 'B' },
    ])
  })

  it('activa foreign keys y las constraints de dinero', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    // FK inexistente
    expect(() =>
      db
        .prepare(
          `INSERT INTO expenses (subcategory_id, payment_method_id, purchase_date, charge_month)
           VALUES (999, 999, '2026-01-01', '2026-01')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/)
    // tarjeta sin día de cierre
    expect(() =>
      db.prepare("INSERT INTO payment_methods (name, type) VALUES ('X', 'tarjeta_credito')").run(),
    ).toThrow(/CHECK/)
    // monto negativo
    seed(db)
    expect(() =>
      db
        .prepare(
          `INSERT INTO expenses (subcategory_id, payment_method_id, purchase_date, charge_month, amount_cents)
           VALUES (1, 1, '2026-01-01', '2026-01', -5)`,
        )
        .run(),
    ).toThrow(/CHECK/)
  })

  it('el seed carga una sola vez', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(seed(db)).toBe(true)
    expect(seed(db)).toBe(false)
    const cats = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }
    const subs = db.prepare('SELECT COUNT(*) AS n FROM subcategories').get() as { n: number }
    const pms = db.prepare('SELECT COUNT(*) AS n FROM payment_methods').get() as { n: number }
    expect(cats.n).toBe(SEED_CATEGORIES.length)
    expect(subs.n).toBe(SEED_CATEGORIES.reduce((a, c) => a + c.subcategories.length, 0))
    expect(pms.n).toBe(SEED_PAYMENT_METHODS.length)
  })
})
