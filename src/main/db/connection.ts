import Database from 'better-sqlite3'

export type Db = Database.Database

/** Abre la base con los PRAGMAs del proyecto. `:memory:` para tests. */
export function openDatabase(filename: string): Db {
  const db = new Database(filename)
  if (filename !== ':memory:') db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  return db
}
