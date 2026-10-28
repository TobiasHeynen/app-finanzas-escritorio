/**
 * Versión web: entrega un archivo al usuario. En el iPhone abre el menú de compartir (Guardar en Archivos,
 * Drive, WhatsApp...), que es lo único confiable instalada como app; si el navegador no puede, lo descarga.
 */
export async function deliverFile(name: string, mimeType: string, bytes: Uint8Array | string) {
  const part = typeof bytes === 'string' ? bytes : new Uint8Array(bytes)
  const file = new File([part], name, { type: mimeType })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      // Cerró el menú sin elegir: no es un error.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}
