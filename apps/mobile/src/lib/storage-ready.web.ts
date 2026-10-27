import { openDatabaseAsync } from 'expo-sqlite'
import { loadBackups } from './backup-store.web'
import { DB_NAME } from './db-name'

export const UNSUPPORTED_MESSAGE =
  'Este navegador no puede guardar los datos de Chanchito. En el iPhone necesitás iOS 16.4 o más ' +
  'nuevo y abrirla desde Safari.'

/**
 * Versión web: SQLite corre en un worker (wasm + almacenamiento privado del navegador) y necesita
 * SharedArrayBuffer. Se pide que el navegador no borre los datos, se cargan los backups y se abre la base
 * en modo async, que espera a que el worker esté listo (la API sincrónica falla si se usa antes).
 */
export async function storageReady(): Promise<void> {
  // Navegadores viejos no tienen alguna de estas cosas, aunque los tipos digan que sí.
  const storage = navigator.storage as Partial<StorageManager> | undefined
  if (
    typeof SharedArrayBuffer === 'undefined' ||
    !crossOriginIsolated ||
    typeof storage?.getDirectory !== 'function'
  ) {
    throw new Error(UNSUPPORTED_MESSAGE)
  }
  await storage.persist?.().catch(() => false)
  await loadBackups()
  await openDatabaseAsync(DB_NAME)
}
