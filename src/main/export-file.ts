import { BrowserWindow, app, dialog, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ExportRequest, ExportResult } from '@shared/types'
import type { ExportService } from './services/export'

let lastExportPath: string | null = null

/** Pide dónde guardar con el diálogo del sistema y escribe el archivo. Cancelar no es error. */
export async function exportToFile(
  exporter: ExportService,
  req: ExportRequest,
): Promise<ExportResult> {
  const { filename, content } = await exporter.build(req)
  const options: Electron.SaveDialogOptions = {
    title: 'Exportar',
    defaultPath: join(app.getPath('documents'), filename),
    filters:
      req.format === 'xlsx'
        ? [{ name: 'Excel', extensions: ['xlsx'] }]
        : [{ name: 'CSV', extensions: ['csv'] }],
  }
  const win = BrowserWindow.getFocusedWindow()
  const result = win
    ? await dialog.showSaveDialog(win, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return { saved: false, path: null }
  await writeFile(result.filePath, content)
  lastExportPath = result.filePath
  return { saved: true, path: result.filePath }
}

/** Muestra en el explorador el último archivo exportado (sin recibir rutas del renderer). */
export function revealLastExport(): void {
  if (lastExportPath) shell.showItemInFolder(lastExportPath)
}
