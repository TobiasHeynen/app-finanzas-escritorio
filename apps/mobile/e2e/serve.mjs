// Sirve el export web con los headers que necesita expo-sqlite (SharedArrayBuffer).
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist-web/', import.meta.url))
const port = Number(process.env.PORT ?? 8781)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
}

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname))
  const send = (body, file) => {
    res.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    })
    res.end(body)
  }
  const file = join(root, path)
  readFile(file)
    .then((body) => send(body, file))
    .catch(() => readFile(join(root, 'index.html')).then((body) => send(body, 'index.html')))
}).listen(port, '127.0.0.1')
