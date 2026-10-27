/** Sólo la versión web (PWA) tiene service worker: en Android no hay nada que hacer. */
export function startPwa(): () => void {
  return () => undefined
}
