/** En la vista previa web no hay menú de compartir: se descarga el archivo. */
export function shareFile(
  filename: string,
  mimeType: string,
  content: Uint8Array | string,
): Promise<boolean> {
  const part = typeof content === 'string' ? content : new Uint8Array(content)
  const url = URL.createObjectURL(new Blob([part], { type: mimeType }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
  return Promise.resolve(true)
}
