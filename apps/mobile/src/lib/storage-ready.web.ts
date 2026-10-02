import { openDatabaseAsync } from 'expo-sqlite'
import { DB_NAME } from './db-name'

/**
 * En web (sólo la vista previa) SQLite corre en un worker que tarda en cargar el wasm, y la API
 * sincrónica falla por timeout si se usa antes. Abrir la base en modo async espera a que esté listo.
 */
export async function storageReady(): Promise<void> {
  await openDatabaseAsync(DB_NAME)
}
