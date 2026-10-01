// Corre Vitest con el binario de Electron en modo Node (ELECTRON_RUN_AS_NODE=1).
// Así los módulos nativos (better-sqlite3) se compilan una sola vez, para el ABI de Electron,
// y sirven tanto para la app como para los tests.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const electronPath = require('electron')
const vitestCli = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

const child = spawn(electronPath, [vitestCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)))
