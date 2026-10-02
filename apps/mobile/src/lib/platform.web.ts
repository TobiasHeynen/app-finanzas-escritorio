import { getDocumentAsync } from 'expo-document-picker'

export function reloadApp(): void {
  // Como en el celu, se vuelve a arrancar desde Inicio.
  window.location.assign('/')
}

export async function pickFile(): Promise<{ name: string; bytes: Uint8Array } | null> {
  const result = await getDocumentAsync({ type: '*/*' })
  const asset = result.canceled ? undefined : result.assets[0]
  if (!asset) return null
  const blob = asset.file ?? (await (await fetch(asset.uri)).blob())
  return { name: asset.name, bytes: new Uint8Array(await blob.arrayBuffer()) }
}
