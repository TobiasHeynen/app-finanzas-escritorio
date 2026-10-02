import type { BackupStore, StoredBackup } from './backup-store.types'

/** Vista previa web (sólo desarrollo y e2e): los backups viven en memoria mientras dure la página. */
const files = new Map<string, { bytes: Uint8Array; modifiedAt: string }>()

export const backupStore: BackupStore = {
  list: (): StoredBackup[] =>
    [...files].map(([name, f]) => ({
      name,
      sizeBytes: f.bytes.length,
      modifiedAt: f.modifiedAt,
    })),
  write(name, bytes) {
    files.set(name, { bytes: new Uint8Array(bytes), modifiedAt: new Date().toISOString() })
  },
  read(name) {
    const f = files.get(name)
    if (!f) throw new Error(`No existe ${name}`)
    return f.bytes
  },
  remove(name) {
    files.delete(name)
  },
  share(name) {
    const f = files.get(name)
    if (!f) return Promise.resolve(false)
    const url = URL.createObjectURL(new Blob([new Uint8Array(f.bytes)]))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)
    return Promise.resolve(true)
  },
}
