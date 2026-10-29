// Arma la PWA (versión iPhone) sobre el export web: genera `sw.js` con la lista de archivos a guardar
// para que la app abra sin internet. La versión del caché es un hash de todos los archivos: si cambia
// algo, el service worker es otro y la app ofrece actualizar.
// Uso: node scripts/build-pwa.mjs <carpeta del export>
import { createHash } from 'node:crypto'
import { readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const root = process.argv[2]
if (!root) {
  console.error('Uso: node scripts/build-pwa.mjs <carpeta del export>')
  process.exit(1)
}

// Archivos que sólo lee el hosting (o que la app no pide).
const skip = new Set(['_headers', '_redirects', 'metadata.json', 'sw.js', 'index.html'])

// Cloudflare Pages (wrangler) no sube carpetas `node_modules`, y Expo deja ahí los assets de los paquetes
// (entre ellos el wasm de SQLite): se mueven a `assets/pkg` y se corrigen las rutas en los bundles. Los
// archivos que cambian llevan otro nombre, así ningún caché del navegador sirve la versión anterior.
async function moveNodeModulesAssets() {
  const from = join(root, 'assets', 'node_modules')
  try {
    await rename(from, join(root, 'assets', 'pkg'))
  } catch {
    return
  }
  const renamed = new Map()
  for (const file of await walk(join(root, '_expo'))) {
    if (!file.endsWith('.js') && !file.endsWith('.css')) continue
    const text = await readFile(file, 'utf8')
    if (!text.includes('/assets/node_modules/')) continue
    const next = file.replace(/(\.[a-z]+)$/, '-pwa$1')
    await writeFile(next, text.replaceAll('/assets/node_modules/', '/assets/pkg/'))
    await rename(file, file + '.old')
    renamed.set(
      relative(root, file).split(sep).join('/'),
      relative(root, next).split(sep).join('/'),
    )
  }
  // El worker de SQLite se referencia desde el entry: primero se renombra en todos los textos.
  for (const file of [...(await walk(root))].filter((f) => /\.(js|css|html)$/.test(f))) {
    let text = await readFile(file, 'utf8')
    let changed = false
    for (const [a, b] of renamed) {
      const name = a.split('/').pop()
      const nextName = b.split('/').pop()
      if (text.includes(name)) {
        text = text.replaceAll(name, nextName)
        changed = true
      }
    }
    if (changed) await writeFile(file, text)
  }
  const { rm } = await import('node:fs/promises')
  for (const a of renamed.keys()) await rm(join(root, a + '.old'))
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  )
  return files.flat()
}

await moveNodeModulesAssets()

const files = (await walk(root))
  .map((f) => relative(root, f).split(sep).join('/'))
  .filter((f) => !skip.has(f))
  .sort()

const hash = createHash('sha256')
for (const f of [...files, 'index.html']) {
  hash.update(f)
  hash.update(await readFile(join(root, f)))
}
const version = hash.digest('hex').slice(0, 12)

// El index se pide como "/" (Cloudflare redirige /index.html a /).
const urls = ['/', ...files.map((f) => '/' + f)]
const template = await readFile(new URL('../pwa/sw.template.js', import.meta.url), 'utf8')
const sw = template
  .replace("'__VERSION__'", JSON.stringify(version))
  .replace('[] /* __FILES__ */', JSON.stringify(urls))
await writeFile(join(root, 'sw.js'), sw)
console.log(`PWA: sw.js versión ${version}, ${urls.length} archivos`)
