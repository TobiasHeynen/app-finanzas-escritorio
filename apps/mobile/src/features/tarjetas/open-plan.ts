import { openWith, takePayload } from '@/lib/nav-payload'

export function openPlan(planId: number) {
  openWith<number>('/cuotas', planId)
}

export function takePlanId(): number | null {
  return takePayload<number | null>('/cuotas', null)
}
