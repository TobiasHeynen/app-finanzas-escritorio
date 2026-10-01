import { AppError } from '@shared/errors'
import { ceilDiv, formatMoney, impliedRate, usdToArs } from '@shared/money'
import { monthDiff, monthOf, type Month } from '@shared/months'
import type {
  GoalProgress,
  SavingsGoal,
  SavingsGoalInput,
  SavingsMovement,
  SavingsMovementInput,
  SavingsOverview,
} from '@shared/types'
import type { MovementWrite } from '../repositories/savings'
import { currentMonthOf, type ServiceContext } from './context'

/** Progreso de una meta: cuánto falta y cuánto aportar por mes para llegar a la fecha. */
export function goalProgress(goal: SavingsGoal, current: Month): GoalProgress {
  const remainingMinor = Math.max(0, goal.targetMinor - goal.savedMinor)
  if (goal.targetDate === null) {
    return { ...goal, remainingMinor, monthsLeft: null, perMonthMinor: null, overdue: false }
  }
  // Se cuenta el mes actual: con fecha en diciembre y hoy en octubre quedan oct, nov y dic.
  const monthsLeft = monthDiff(current, monthOf(goal.targetDate)) + 1
  const overdue = monthsLeft < 1 && remainingMinor > 0
  const perMonthMinor =
    remainingMinor > 0 && monthsLeft >= 1 ? ceilDiv(remainingMinor, monthsLeft) : null
  return { ...goal, remainingMinor, monthsLeft: Math.max(0, monthsLeft), perMonthMinor, overdue }
}

export type SavingsService = ReturnType<typeof createSavingsService>

export function createSavingsService({ db, repos, clock }: ServiceContext) {
  const savings = repos.savings

  /** Convierte el input de la UI (aporte/retiro + ARS) a la fila de la DB (monto con signo + cotización). */
  function toWrite(input: SavingsMovementInput): MovementWrite {
    const sign = input.kind === 'aporte' ? 1 : -1
    const ars = input.currency === 'USD' ? input.arsCents : null
    return {
      date: input.date,
      month: input.month,
      currency: input.currency,
      amountMinor: sign * input.amountMinor,
      arsCostCents: ars,
      rateCentsPerUsd: ars !== null && ars > 0 ? impliedRate(ars, input.amountMinor) : null,
      goalId: input.goalId,
      note: input.note,
    }
  }

  function validateGoal(write: MovementWrite) {
    if (write.goalId === null) return
    const goal = savings.getGoal(write.goalId)
    if (goal.currency !== write.currency) {
      throw new AppError('VALIDATION', `La meta "${goal.name}" es en ${goal.currency}`, {
        goalId: 'La moneda de la meta no coincide',
      })
    }
  }

  /**
   * Corre la mutación en una transacción y la revierte si deja algún saldo en negativo
   * (un retiro mayor a lo ahorrado, o borrar un aporte que ya se retiró).
   */
  function guarded<T>(mutate: () => T): T {
    return db.transaction(() => {
      const before = savings.balances()
      const result = mutate()
      const after = savings.balances()
      for (const currency of ['ARS', 'USD'] as const) {
        if (after[currency] < 0 && after[currency] < before[currency]) {
          throw new AppError(
            'VALIDATION',
            `No alcanza el ahorro: en ${currency} tenés ${formatMoney(Math.max(0, before[currency]), currency)}`,
            { amountMinor: 'Supera el saldo disponible' },
          )
        }
      }
      return result
    })()
  }

  return {
    overview(): SavingsOverview {
      const current = currentMonthOf(clock)
      const balances = savings.balances()
      const lastRate = savings.lastRate()
      return {
        balances,
        lastRate,
        usdInArsCents: lastRate ? usdToArs(balances.USD, lastRate.rateCentsPerUsd) : null,
        movements: savings.listMovements(),
        goals: savings.listGoals().map((g) => goalProgress(g, current)),
      }
    },

    createMovement: (input: SavingsMovementInput): SavingsMovement =>
      guarded(() => {
        const write = toWrite(input)
        validateGoal(write)
        return savings.insertMovement(write)
      }),

    updateMovement: (id: number, input: SavingsMovementInput): SavingsMovement =>
      guarded(() => {
        const write = toWrite(input)
        validateGoal(write)
        return savings.updateMovement(id, write)
      }),

    updateGoal(id: number, input: SavingsGoalInput): SavingsGoal {
      const mismatched = db
        .prepare<[number, string], { n: number }>(
          'SELECT COUNT(*) AS n FROM savings_movements WHERE goal_id = ? AND currency <> ? AND deleted_at IS NULL',
        )
        .get(id, input.currency)
      if (mismatched && mismatched.n > 0) {
        throw new AppError('VALIDATION', 'La meta tiene movimientos en otra moneda', {
          currency: 'No se puede cambiar la moneda',
        })
      }
      return savings.updateGoal(id, input)
    },

    removeMovement: (id: number): void => guarded(() => savings.softDeleteMovement(id)),
    restoreMovement: (id: number): void => guarded(() => savings.restoreMovement(id)),
  }
}
