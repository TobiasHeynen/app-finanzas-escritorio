// Parches a expo-sqlite (web). Sólo afectan a la vista previa web (la usan los e2e); en Android no se usa
// este código. Corre en postinstall y cada parche no hace nada si ya está aplicado o si expo-sqlite lo arregló.
//
// 1. Escribe el largo del resultado sincrónico con `Uint8Array.set(new Uint32Array([n]))`, que copia sólo el
//    byte bajo: cualquier resultado de más de 255 bytes llega cortado y falla el JSON.
// 2. Con `Atomics.pause` corta la espera sincrónica a las 1.000.000 vueltas (unos pocos ms): una escritura
//    a OPFS un poco lenta tira "Sync operation timeout". Se usa el mismo límite que sin `Atomics.pause`.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const file = fileURLToPath(
  new URL('../node_modules/expo-sqlite/web/WorkerChannel.ts', import.meta.url),
)
const patches = [
  {
    name: 'largo del resultado sincrónico',
    buggy: 'resultArray.set(new Uint32Array([length]), 0);',
    fixed: 'resultArray.set(new Uint8Array(new Uint32Array([length]).buffer), 0);',
  },
  {
    name: 'timeout de la espera sincrónica',
    buggy: 'if (i > 1_000_000) {',
    fixed: 'if (i > 1000_000_000) {',
  },
]

let source
try {
  source = readFileSync(file, 'utf8')
} catch {
  process.exit(0)
}
let changed = false
for (const { name, buggy, fixed } of patches) {
  if (source.includes(buggy)) {
    source = source.replace(buggy, fixed)
    changed = true
    console.log(`expo-sqlite web: corregido ${name}`)
  }
}
if (changed) writeFileSync(file, source)
