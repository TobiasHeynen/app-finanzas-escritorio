import { createContext, use } from 'react'
import type { Services } from '@core/services'

export const ServicesContext = createContext<Services | null>(null)

/** Los services de core (los mismos que usa la PC), ya conectados a la base del celu. */
export function useServices(): Services {
  const services = use(ServicesContext)
  if (!services) throw new Error('useServices fuera de ServicesContext')
  return services
}
