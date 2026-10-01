import { QueryClient } from '@tanstack/react-query'

// App local: los datos sólo cambian por nuestras mutaciones, no hace falta refetch automático.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
    mutations: { retry: false },
  },
})
