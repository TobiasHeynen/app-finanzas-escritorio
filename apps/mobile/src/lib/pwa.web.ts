import { toast } from './toast'

/**
 * Registra el service worker (que guarda la app para abrirla sin internet) y avisa cuando hay una
 * versión nueva. En la vista previa y los e2e no hay `sw.js` y el registro falla sin hacer nada.
 */
export function startPwa(): () => void {
  if (!('serviceWorker' in navigator)) return () => undefined
  const sw = navigator.serviceWorker
  // La primera instalación también cambia el controller: sólo se recarga si ya había uno.
  const hadController = sw.controller !== null
  let reloading = false
  const onControllerChange = () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  }
  sw.addEventListener('controllerchange', onControllerChange)

  let registration: ServiceWorkerRegistration | null = null
  const offerUpdate = (worker: ServiceWorker) => {
    toast.info('Hay una versión nueva de Chanchito', {
      duration: 60_000,
      action: {
        label: 'Actualizar',
        onPress: () => {
          worker.postMessage('skipWaiting')
        },
      },
    })
  }
  sw.register('/sw.js').then(
    (reg) => {
      registration = reg
      if (reg.waiting && sw.controller) offerUpdate(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const next = reg.installing
        next?.addEventListener('statechange', () => {
          if (next.state === 'installed' && sw.controller) offerUpdate(next)
        })
      })
    },
    () => undefined,
  )

  // Instalada en el iPhone la app casi nunca se recarga: al volver a abrirla se busca versión nueva.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void registration?.update().catch(() => undefined)
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    sw.removeEventListener('controllerchange', onControllerChange)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
