import { deliverFile } from './web-file'

/** En web (PWA del iPhone): menú de compartir o, si no hay, descarga. */
export async function shareFile(
  filename: string,
  mimeType: string,
  content: Uint8Array | string,
): Promise<boolean> {
  await deliverFile(filename, mimeType, content)
  return true
}
