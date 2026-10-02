import type { Currency } from '@shared/money'
import type { SavingsGoal, SavingsMovement } from '@shared/types'
import { openWith, takePayload } from '@/lib/nav-payload'

export type MovementKind = 'aporte' | 'retiro'

export interface MovementTarget {
  movement: SavingsMovement | null
  defaults?: { currency?: Currency; kind?: MovementKind; goalId?: number }
}

export function openMovement(target: MovementTarget) {
  openWith<MovementTarget>('/ahorro', target)
}

export function takeMovementTarget(): MovementTarget {
  return takePayload<MovementTarget>('/ahorro', { movement: null })
}

export function openGoal(goal: SavingsGoal | null) {
  openWith<SavingsGoal | null>('/meta', goal)
}

export function takeGoal(): SavingsGoal | null {
  return takePayload<SavingsGoal | null>('/meta', null)
}
