import { describe, expect, it } from 'vitest'
import { namedParams, toExpoParams, wrapSyncSqlite } from '@core/db/sync-adapter'
import { initDatabase } from '@core/db/init'
import { fakeExpoSqlite } from '../helpers/fake-expo-sqlite'

const setup = () => {
  const db = wrapSyncSqlite(fakeExpoSqlite())
  db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL, cents INTEGER)')
  return db
}

describe('adaptador de expo-sqlite', () => {
  it('lee los nombres de parámetros ignorando strings', () => {
    expect(namedParams("SELECT * FROM t WHERE a = @a AND b = '@b' AND c = @c AND d = @a")).toEqual([
      'a',
      'c',
    ])
  })

  it('traduce parámetros con nombre al formato de expo y falla si falta uno', () => {
    expect(
      toExpoParams('INSERT INTO t VALUES (@id, @name)', [{ id: 1, name: 'x', extra: 2 }]),
    ).toEqual({ '@id': 1, '@name': 'x' })
    expect(() => toExpoParams('SELECT @a, @b', [{ a: 1 }])).toThrow('Falta el parámetro @b')
    expect(toExpoParams('SELECT ?, ?', [1, undefined])).toEqual([1, null])
  })

  it('run, get y all se comportan como en better-sqlite3', () => {
    const db = setup()
    const r = db
      .prepare('INSERT INTO t (name, cents) VALUES (@name, @cents)')
      .run({ name: 'a', cents: 100 })
    expect(r).toEqual({ changes: 1, lastInsertRowid: 1 })
    db.prepare('INSERT INTO t (name, cents) VALUES (?, ?)').run('b', null)
    expect(db.prepare('SELECT name FROM t WHERE id = ?').get(2)).toEqual({ name: 'b' })
    expect(db.prepare('SELECT name FROM t WHERE id = ?').get(99)).toBeUndefined()
    expect(db.prepare('SELECT id, cents FROM t ORDER BY id').all()).toEqual([
      { id: 1, cents: 100 },
      { id: 2, cents: null },
    ])
  })

  it('una transacción que falla no deja nada, y las anidadas usan savepoints', () => {
    const db = setup()
    const insert = db.prepare('INSERT INTO t (name) VALUES (?)')
    expect(() =>
      db.transaction(() => {
        insert.run('a')
        throw new Error('boom')
      })(),
    ).toThrow('boom')
    db.transaction(() => {
      insert.run('afuera')
      expect(() =>
        db.transaction(() => {
          insert.run('adentro')
          throw new Error('interna')
        })(),
      ).toThrow('interna')
    })()
    expect(db.prepare('SELECT name FROM t').all()).toEqual([{ name: 'afuera' }])
  })

  it('inicializa la base completa (migraciones y seed) a través del adaptador', () => {
    const db = wrapSyncSqlite(fakeExpoSqlite())
    const result = initDatabase(db)
    expect(result.seeded).toBe(true)
    expect(result.appliedMigrations.length).toBeGreaterThan(0)
    const row = db.prepare('SELECT COUNT(*) AS n FROM categories').get() as { n: number }
    expect(row.n).toBeGreaterThan(0)
  })
})
