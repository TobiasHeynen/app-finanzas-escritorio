import { router, type Href } from 'expo-router'

/**
 * Los formularios son pantallas aparte. El objeto a editar (o los valores por defecto) se pasa por acá y
 * no por la URL: son objetos y la URL sólo lleva strings.
 */
const payloads = new Map<string, unknown>()

// T se pasa explícito en cada llamada para chequear el payload contra lo que espera la pantalla.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function openWith<T>(href: Href & string, payload: T): void {
  payloads.set(href, payload)
  router.push(href)
}

export function takePayload<T>(href: string, fallback: T): T {
  const value = payloads.has(href) ? (payloads.get(href) as T) : fallback
  payloads.delete(href)
  return value
}
