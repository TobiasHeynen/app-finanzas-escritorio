import type { ExpenseGroup } from '@shared/types'
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

const lastPayerKey = (groupId: number) => `mobile:last-payer:${String(groupId)}`

/** Quién pagó por última vez en cada grupo, para proponerlo la próxima. */
export function readLastPayer(groupId: number): number | null {
  const v = Number(getAppServices().services.ctx.repos.settings.get(lastPayerKey(groupId)))
  return Number.isInteger(v) && v > 0 ? v : null
}

export function rememberPayer(group: ExpenseGroup | null): void {
  if (!group) return
  getAppServices().services.ctx.repos.settings.set(
    lastPayerKey(group.groupId),
    String(group.paidByMemberId),
  )
}
