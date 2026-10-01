import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Expense } from '@shared/types'
import { call } from './api'
import { keys, movementKeys, useApiMutation, useApiQuery } from './hooks'

export function useMonthOverview(month: string) {
  return useApiQuery('month:overview', { month }, keys.month(month))
}

export function useInvalidateMovements() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(movementKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

/** Muestra un toast con "Deshacer" que ejecuta `undo` e invalida los movimientos. */
export function useUndoToast() {
  const invalidate = useInvalidateMovements()
  return (message: string, undo: () => Promise<unknown>) => {
    toast.success(message, {
      duration: 8000,
      action: {
        label: 'Deshacer',
        onClick: () => {
          void undo()
            .then(invalidate)
            .then(() => toast.success('Listo, lo recuperamos'))
            .catch((err: unknown) => toast.error(err instanceof Error ? err.message : String(err)))
        },
      },
    })
  }
}

export function useDeleteExpense() {
  const undoToast = useUndoToast()
  return useApiMutation('expenses:remove', {
    invalidate: movementKeys,
    onSuccess: ({ ids }) => undoToast('Gasto borrado', () => call('expenses:restore', { ids })),
  })
}

export function useDeletePlan() {
  const undoToast = useUndoToast()
  return useApiMutation('plans:remove', {
    invalidate: movementKeys,
    onSuccess: ({ ids }) => {
      if (ids.length === 0) {
        toast.info('No había cuotas para borrar')
        return
      }
      undoToast(ids.length === 1 ? 'Cuota borrada' : `${ids.length} cuotas borradas`, () =>
        call('expenses:restore', { ids }),
      )
    },
  })
}

export function useDuplicateExpense() {
  return useApiMutation('expenses:duplicate', {
    invalidate: movementKeys,
    success: 'Gasto duplicado con fecha de hoy',
  })
}

export function useSetExpenseAmount() {
  return useApiMutation('expenses:setAmount', {
    invalidate: movementKeys,
    success: 'Monto cargado',
  })
}

export const isPending = (e: Pick<Expense, 'amountCents'>): boolean => e.amountCents === null
