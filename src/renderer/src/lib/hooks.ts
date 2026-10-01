import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { IpcChannel } from '@shared/ipc/channels'
import type { IpcInput, IpcOutput } from '@shared/ipc/contract'
import { ApiError, call } from './api'

/**
 * Query keys por dominio. Las mutaciones invalidan por prefijo: invalidar ['expenses'] refresca
 * todas las listas de gastos de todos los meses.
 */
export const keys = {
  categories: ['categories'] as const,
  paymentMethods: ['paymentMethods'] as const,
  month: (month: string) => ['month', month] as const,
  monthAll: ['month'] as const,
  expenses: ['expenses'] as const,
  plans: ['plans'] as const,
  recurring: ['recurring'] as const,
  incomes: ['incomes'] as const,
  savings: ['savings'] as const,
  cards: ['cards'] as const,
  report: ['report'] as const,
  backups: ['backups'] as const,
  appInfo: ['appInfo'] as const,
}

/** Todo lo que depende de los movimientos (para invalidar después de cargar/borrar). */
export const movementKeys: QueryKey[] = [
  keys.monthAll,
  keys.expenses,
  keys.plans,
  keys.cards,
  keys.report,
  keys.incomes,
  keys.savings,
]

export function useApiQuery<C extends IpcChannel>(
  channel: C,
  input: IpcInput<C>,
  queryKey: QueryKey,
  options: { enabled?: boolean } = {},
) {
  return useQuery<IpcOutput<C>, ApiError>({
    queryKey,
    queryFn: () => call(channel, input),
    enabled: options.enabled ?? true,
  })
}

interface MutationOptions<C extends IpcChannel> {
  invalidate?: QueryKey[]
  success?: string | ((data: IpcOutput<C>, input: IpcInput<C>) => string | null)
  onSuccess?: (data: IpcOutput<C>, input: IpcInput<C>) => void
  /** Si es false, el error no se muestra en un toast (el form lo muestra en los campos). */
  toastErrors?: boolean
}

export function useApiMutation<C extends IpcChannel>(channel: C, options: MutationOptions<C> = {}) {
  const queryClient = useQueryClient()
  return useMutation<IpcOutput<C>, ApiError, IpcInput<C>>({
    mutationFn: (input) => call(channel, input),
    onSuccess: async (data, input) => {
      await Promise.all(
        (options.invalidate ?? []).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      const message =
        typeof options.success === 'function' ? options.success(data, input) : options.success
      if (message) toast.success(message)
      options.onSuccess?.(data, input)
    },
    onError: (error) => {
      if (options.toastErrors !== false) toast.error(error.message)
    },
  })
}
