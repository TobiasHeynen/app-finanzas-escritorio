// expo-sqlite (web) escribe el largo del resultado sincrónico con `Uint8Array.set(new Uint32Array([n]))`,
// que copia sólo el byte bajo: cualquier resultado de más de 255 bytes llega cortado y falla el JSON.
// Sólo afecta a la vista previa web (la usan los e2e); en Android no se usa este código.
// Corre en postinstall y no hace nada si ya está corregido o si expo-sqlite lo arregló.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = fileURLToPath(
  new URL('../node_modules/expo-sqlite/web/WorkerChannel.ts', import.meta.url),
)
const buggy = 'resultArray.set(new Uint32Array([length]), 0);'
const fixed = 'resultArray.set(new Uint8Array(new Uint32Array([length]).buffer), 0);'

let source
try {
  source = readFileSync(file, 'utf8')
} catch {
  process.exit(0)
}
if (source.includes(buggy)) {
  writeFileSync(file, source.replace(buggy, fixed))
  console.log('expo-sqlite web: corregido el largo del resultado sincrónico')
}
