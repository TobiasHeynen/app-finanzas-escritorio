import { getAppServices } from './services'

/** Preferencias chicas del celu, en la tabla settings de la base (viajan con los backups). */
const LAST_METHOD_KEY = 'mobile:last-payment-method'

export function readLastMethod(): number | null {
  const v = Number(getAppServices().services.ctx.repos.settings.get(LAST_METHOD_KEY))
  return Number.isInteger(v) && v > 0 ? v : null
}

export function rememberMethod(id: number): void {
  getAppServices().services.ctx.repos.settings.set(LAST_METHOD_KEY, String(id))
}
