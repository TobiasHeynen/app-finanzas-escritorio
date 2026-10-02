import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

/**
 * Escribe el archivo en la caché y abre el menú de compartir de Android (Drive, mail, WhatsApp,
 * "Guardar en el dispositivo"...). Devuelve false si el celu no tiene a dónde compartir.
 */
export async function shareFile(
  filename: string,
  mimeType: string,
  content: Uint8Array | string,
  dialogTitle: string,
): Promise<boolean> {
  const file = new File(Paths.cache, filename)
  if (file.exists) file.delete()
  file.create()
  file.write(content)
  if (!(await Sharing.isAvailableAsync())) return false
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle })
  return true
}
