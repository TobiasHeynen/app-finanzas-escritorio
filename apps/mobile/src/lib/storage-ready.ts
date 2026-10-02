/** En Android/iOS SQLite está listo al toque: no hay nada que esperar. */
export function storageReady(): Promise<void> {
  return Promise.resolve()
}
