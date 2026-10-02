import { QueryClient } from '@tanstack/react-query'

/** Todo es local y sincrónico: sin reintentos ni datos "viejos" que refrescar solos. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})
