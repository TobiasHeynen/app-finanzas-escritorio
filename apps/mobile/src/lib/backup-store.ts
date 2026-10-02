import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import type { BackupStore, StoredBackup } from './backup-store.types'

/** Backups en `<documentos de la app>/backups`: entran en el Auto Backup de Android. */
const dir = () => new Directory(Paths.document, 'backups')

export const backupStore: BackupStore = {
  list(): StoredBackup[] {
    const d = dir()
    if (!d.exists) return []
    return d.list().flatMap((entry) =>
      entry instanceof File
        ? [
            {
              name: entry.name,
              sizeBytes: entry.size,
              modifiedAt: new Date(entry.lastModified ?? Date.now()).toISOString(),
            },
          ]
        : [],
    )
  },
  write(name, bytes) {
    const d = dir()
    if (!d.exists) d.create({ intermediates: true })
    const file = new File(d, name)
    if (file.exists) file.delete()
    file.create()
    file.write(bytes)
  },
  read: (name) => new File(dir(), name).bytesSync(),
  remove(name) {
    const file = new File(dir(), name)
    if (file.exists) file.delete()
  },
  async share(name) {
    if (!(await Sharing.isAvailableAsync())) return false
    await Sharing.shareAsync(new File(dir(), name).uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Compartir backup',
    })
    return true
  },
}
