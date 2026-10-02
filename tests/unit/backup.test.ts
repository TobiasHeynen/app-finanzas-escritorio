import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BACKUPS_TO_KEEP,
  createBackup,
  isBackupName,
  listBackups,
  validateBackupFile,
} from '@main/db/backup'
import { openDatabase } from '@main/db/connection'
import { migrate } from '@core/db/migrate'
import { seed } from '@core/db/seed'
import { AppError } from '@shared/errors'
import Database from 'better-sqlite3'
import {
  backupsToPrune,
  looksLikeSqlite,
  validateBackupDb,
  withoutWal,
} from '@core/db/backup-rules'

const dirs: string[] = []
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'mf-backup-'))
  dirs.push(dir)
  return dir
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function fileDb(dir: string) {
  const db = openDatabase(join(dir, 'finanzas.db'))
  migrate(db)
  seed(db)
  return db
}

describe('backups', () => {
  it('crea un backup válido con la API de SQLite y lo lista', async () => {
    const dir = tempDir()
    const db = fileDb(dir)
    const info = await createBackup(
      db,
      join(dir, 'backups'),
      'manual',
      new Date(2026, 9, 1, 9, 5, 7),
    )
    expect(info.name).toBe('finanzas-20261001-090507-manual.db')
    expect(info.sizeBytes).toBeGreaterThan(0)
    expect(validateBackupFile(join(dir, 'backups', info.name)).schemaVersion).toBeGreaterThan(0)
    // Dos en el mismo segundo no se pisan.
    const again = await createBackup(
      db,
      join(dir, 'backups'),
      'manual',
      new Date(2026, 9, 1, 9, 5, 7),
    )
    expect(again.name).not.toBe(info.name)
    db.close()
  })

  it(`conserva los últimos ${String(BACKUPS_TO_KEEP)} de cada tipo`, async () => {
    const dir = tempDir()
    const db = fileDb(dir)
    const backups = join(dir, 'backups')
    for (let i = 0; i < BACKUPS_TO_KEEP + 3; i++) {
      await createBackup(db, backups, 'inicio', new Date(2026, 0, 1 + i, 10))
    }
    await createBackup(db, backups, 'manual', new Date(2025, 0, 1))
    const list = listBackups(backups)
    expect(list.filter((b) => b.reason === 'inicio')).toHaveLength(BACKUPS_TO_KEEP)
    // El manual más viejo no se borra por los automáticos.
    expect(list.some((b) => b.reason === 'manual')).toBe(true)
    // Se borraron los más viejos.
    expect(list.some((b) => b.name.startsWith('finanzas-20260101'))).toBe(false)
    expect(list[0]?.name.startsWith('finanzas-20260118')).toBe(true)
    db.close()
  })

  it('rechaza archivos que no son una base de Chanchito o de una versión más nueva', () => {
    const dir = tempDir()
    const garbage = join(dir, 'basura.db')
    writeFileSync(garbage, 'esto no es sqlite')
    expect(() => validateBackupFile(garbage)).toThrow(AppError)

    const other = openDatabase(join(dir, 'otra.db'))
    other.exec('CREATE TABLE cosas (id INTEGER)')
    other.close()
    expect(() => validateBackupFile(join(dir, 'otra.db'))).toThrow(/no es un backup válido/)

    const db = fileDb(dir)
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (999, ?, ?)').run(
      'futuro',
      new Date().toISOString(),
    )
    db.close()
    expect(() => validateBackupFile(join(dir, 'finanzas.db'))).toThrow(/más nueva/)
  })

  it('sólo acepta nombres de backup con el formato propio (sin rutas)', () => {
    expect(isBackupName('finanzas-20261001-090507-manual.db')).toBe(true)
    expect(isBackupName('../finanzas-20261001-090507-manual.db')).toBe(false)
    expect(isBackupName('finanzas.db')).toBe(false)
  })
})

describe('backups entre PC y celu', () => {
  it('un backup como los del celu (imagen serializada, sin WAL) se restaura en la PC', () => {
    const dir = tempDir()
    const db = fileDb(dir)
    db.prepare(
      "INSERT INTO incomes (month, type, description, amount_cents, date) VALUES ('2026-10', 'sueldo', '', 100, '2026-10-01')",
    ).run()
    const image = new Uint8Array(db.serialize())
    db.close()
    expect(image[18]).toBe(2) // la base está en WAL
    const mobile = withoutWal(image)
    expect([mobile[18], mobile[19]]).toEqual([1, 1])
    expect(looksLikeSqlite(mobile)).toBe(true)

    const file = join(dir, 'finanzas-20261002-101010-manual.db')
    writeFileSync(file, mobile)
    expect(validateBackupFile(file).schemaVersion).toBeGreaterThan(0)
    const restored = new Database(file, { readonly: true })
    expect(restored.prepare('SELECT COUNT(*) AS n FROM incomes').get()).toEqual({ n: 1 })
    restored.close()

    // Y en memoria, como valida el celu antes de restaurar.
    const memory = new Database(Buffer.from(mobile))
    expect(validateBackupDb(memory, 'x.db').schemaVersion).toBeGreaterThan(0)
    memory.close()
  })

  it('no confunde cualquier archivo con una base', () => {
    expect(looksLikeSqlite(new Uint8Array(500).fill(7))).toBe(false)
    expect(looksLikeSqlite(new TextEncoder().encode('SQLite format 3'))).toBe(false)
  })

  it('la rotación es la misma en las dos apps', () => {
    const names = Array.from(
      { length: 17 },
      (_, i) => `finanzas-202601${String(i + 1).padStart(2, '0')}-100000-inicio.db`,
    )
    names.push('finanzas-20250101-000000-manual.db', 'otra-cosa.db')
    expect(backupsToPrune(names)).toEqual([
      'finanzas-20260102-100000-inicio.db',
      'finanzas-20260101-100000-inicio.db',
    ])
  })
})
