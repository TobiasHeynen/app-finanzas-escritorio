import { toast } from 'sonner'
import type { ExportRequest } from '@shared/types'
import { call } from './api'
import { useApiMutation } from './hooks'

/** Exporta a xlsx/csv con el diálogo de guardar del sistema y ofrece abrir la carpeta. */
export function useExport() {
  return useApiMutation('export:run', {
    onSuccess: (result) => {
      if (!result.saved || !result.path) return
      const name = result.path.split(/[\\/]/).pop() ?? result.path
      toast.success(`Exportado: ${name}`, {
        action: { label: 'Mostrar', onClick: () => void call('export:reveal', {}) },
      })
    },
  })
}

export type { ExportRequest }
