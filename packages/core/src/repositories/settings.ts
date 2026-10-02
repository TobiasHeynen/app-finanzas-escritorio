import type { SqlDb as Db } from '../db/sql'

export type SettingsRepo = ReturnType<typeof createSettingsRepo>

export function createSettingsRepo(db: Db) {
  const get = db.prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
  const set = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
  )
  const del = db.prepare('DELETE FROM settings WHERE key = ?')
  return {
    get: (key: string): string | null => get.get(key)?.value ?? null,
    set: (key: string, value: string): void => void set.run(key, value),
    delete: (key: string): void => void del.run(key),
  }
}
