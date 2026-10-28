// Arma la PWA (versión iPhone) sobre el export web: genera `sw.js` con la lista de archivos a guardar
// para que la app abra sin internet. La versión del caché es un hash de todos los archivos: si cambia
// algo, el service worker es otro y la app ofrece actualizar.
// Uso: node scripts/build-pwa.mjs <carpeta del export>
import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const root = process.argv[2]
if (!root) {
  console.error('Uso: node scripts/build-pwa.mjs <carpeta del export>')
  process.exit(1)
}

// Archivos que sólo lee el hosting (o que la app no pide).
const skip = new Set(['_headers', '_redirects', 'metadata.json', 'sw.js', 'index.html'])

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  )
  return files.flat()
}

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
