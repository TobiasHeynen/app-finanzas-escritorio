export interface StoredBackup {
  name: string
  sizeBytes: number
  modifiedAt: string
}

/** Dónde viven los archivos de backup (en el celu, una carpeta de la app; en la web, memoria). */
export interface BackupStore {
  list(): StoredBackup[]
  write(name: string, bytes: Uint8Array): void
  read(name: string): Uint8Array
  remove(name: string): void
  /** Abre el menú de compartir con el archivo. false si no hay a dónde. */
  share(name: string): Promise<boolean>
}
