import type { BackupStore, StoredBackup } from './backup-store.types'
import { deliverFile } from './web-file'

/**
 * Versión web (PWA): los backups se guardan en IndexedDB. La interfaz es sincrónica (como en el celu), así
 * que se trabaja sobre una copia en memoria que se carga al arrancar (`loadBackups`) y cada cambio se escribe
 * en IndexedDB atrás; `backupsSaved` espera a que terminen (antes de recargar la app).
 */
interface Entry {
  bytes: Uint8Array
  modifiedAt: string
}

const DB = 'chanchito-backups'
const STORE = 'files'
const files = new Map<string, Entry>()
let pending: Promise<void> = Promise.resolve()

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => {
      resolve(req.result)
    }
    req.onerror = () => {
      reject(req.error ?? new Error('No se pudo abrir IndexedDB'))
    }
  })
}

function tx(mode: IDBTransactionMode, run: (store: IDBObjectStore) => void): Promise<void> {
  return openIdb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        run(t.objectStore(STORE))
        t.oncomplete = () => {
          db.close()
          resolve()
        }
        t.onerror = t.onabort = () => {
          db.close()
          reject(t.error ?? new Error('Falló IndexedDB'))
        }
      }),
  )
}

function persist(run: (store: IDBObjectStore) => void): void {
  pending = pending
    .then(() => tx('readwrite', run))
    .catch((err: unknown) => {
      console.error('No se pudo guardar el backup', err)
    })
}

/** Carga los backups guardados. Se llama una vez al arrancar, antes de abrir la base. */
export async function loadBackups(): Promise<void> {
  await tx('readonly', (store) => {
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return
      const value = cursor.value as Entry
      files.set(cursor.key as string, { bytes: value.bytes, modifiedAt: value.modifiedAt })
      cursor.continue()
    }
  })
}

/** Espera a que los backups pendientes queden escritos. */
export function backupsSaved(): Promise<void> {
  return pending
}

export const backupStore: BackupStore = {
  list: (): StoredBackup[] =>
    [...files].map(([name, f]) => ({
      name,
      sizeBytes: f.bytes.length,
      modifiedAt: f.modifiedAt,
    })),
  write(name, bytes) {
    const entry = { bytes: new Uint8Array(bytes), modifiedAt: new Date().toISOString() }
    files.set(name, entry)
    persist((store) => store.put(entry, name))
  },
  read(name) {
    const f = files.get(name)
    if (!f) throw new Error(`No existe ${name}`)
    return f.bytes
  },
  remove(name) {
    files.delete(name)
    persist((store) => store.delete(name))
  },
  async share(name) {
    const f = files.get(name)
    if (!f) return false
    await deliverFile(name, 'application/x-sqlite3', f.bytes)
    return true
  },
}
