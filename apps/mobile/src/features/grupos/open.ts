import type { Group } from '@shared/types'
import { openWith, takePayload } from '@/lib/nav-payload'

export interface SettleDraft {
  group: Group
  fromMemberId: number
  toMemberId: number
  amountCents: number
}

export function openSettle(draft: SettleDraft): void {
  openWith<SettleDraft>('/saldar', draft)
}

export function takeSettle(): SettleDraft | null {
  return takePayload<SettleDraft | null>('/saldar', null)
}
