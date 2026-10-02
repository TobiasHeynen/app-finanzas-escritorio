import type { Services } from '@core/services'
import { buildExportFile } from '@core/services/export-file'
import type { ExportRequest } from '@shared/types'
import { addHandlers } from './api'
import { useApiMutation } from './hooks'
import { shareFile } from './share-file'
import { toast } from './toast'

/** `export:run` en el celu: arma el archivo con core y lo comparte (no hay "Guardar como"). */
export function registerExportHandlers(services: Services): void {
  addHandlers({
    'export:run': async (req: ExportRequest) => {
      const file = buildExportFile(services.exportData, req)
      const shared = await shareFile(file.filename, file.mimeType, file.content, 'Exportar')
      return { saved: shared, path: null }
    },
  })
}

export function useExport() {
  return useApiMutation('export:run', {
    onSuccess: (result) => {
      if (!result.saved) toast.error('No hay ninguna app para compartir el archivo')
    },
  })
}
