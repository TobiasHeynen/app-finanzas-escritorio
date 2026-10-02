import { reloadAppAsync } from 'expo'
import { getDocumentAsync } from 'expo-document-picker'
import { File } from 'expo-file-system'

/** Reinicia la app (por ejemplo, después de restaurar un backup). */
export function reloadApp(): void {
  void reloadAppAsync('Backup restaurado')
}

/** Elegir un archivo del celu (Descargas, Drive, WhatsApp...). null si se cancela. */
export async function pickFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const result = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true })
  const asset = result.canceled ? undefined : result.assets[0]
  if (!asset) return null
  const file = new File(asset.uri)
  try {
    return { name: asset.name, bytes: await file.bytes() }
  } finally {
    if (file.exists) file.delete()
  }
}
