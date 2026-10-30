import { openDatabaseAsync } from 'expo-sqlite'
import { backupsSaved, loadBackups } from './backup-store.web'
import { completeGoogleRedirect } from './cloud-auth.web'
import { DB_NAME } from './db-name'
import { DbBusyError, openExclusive, resumeUrl } from './db-lock.web'
import type { BootAction } from './storage-ready'

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
  // Volviendo de Google se recarga la app: no hace falta abrir nada.
  if (await completeGoogleRedirect()) return new Promise<void>(() => undefined)
  await storage.persist?.().catch(() => false)
  await loadBackups()
  await openExclusive(async () => {
    await openDatabaseAsync(DB_NAME)
  }, backupsSaved)
}

/** Botón de la pantalla de error: retomar la app en esta ventana o reintentar. */
export function bootAction(err: unknown): BootAction | null {
  if (!(err instanceof DbBusyError)) return null
  return {
    title: 'Chanchito está abierta en otra ventana',
    label: err.paused ? 'Usar acá' : 'Reintentar',
    run: () => {
      window.location.assign(resumeUrl())
    },
  }
}
