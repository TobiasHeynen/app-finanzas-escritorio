export type BootAction = { title?: string; label: string; run: () => void }

/** En Android/iOS SQLite está listo al toque: no hay nada que esperar. */
export function storageReady(): Promise<void> {
  return Promise.resolve()
}

/** En el celu no hay acciones para la pantalla de error de la base. */
export function bootAction(_err: unknown): BootAction | null {
  return null
}
