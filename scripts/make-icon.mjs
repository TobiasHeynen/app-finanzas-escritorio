// Genera build/icon.png (512) y build/icon.ico (16-256) desde build/icon.svg usando Chromium.
// Uso: npx electron scripts/make-icon.mjs
import { app, BrowserWindow, nativeImage } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const svg = readFileSync(join(root, 'build/icon.svg'), 'utf8')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

async function render(size) {
  const win = new BrowserWindow({
    width: size,
    height: size,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  })
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">
    <img style="width:${size}px;height:${size}px;display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await new Promise((r) => setTimeout(r, 300))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })
  win.destroy()
  return image.toPNG()
}

/** ICO con entradas PNG (soportado desde Windows Vista). */
function toIco(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  const entries = []
  let offset = 6 + 16 * pngs.length
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

async function main() {
  // Se renderiza una vez grande y se achica (las ventanas muy chicas no cargan bien).
  const big = await render(512)
  const image = nativeImage.createFromBuffer(big)
  const pngs = SIZES.map((size) => ({
    size,
    data: image.resize({ width: size, height: size, quality: 'best' }).toPNG(),
  }))
  writeFileSync(join(root, 'build/icon.ico'), toIco(pngs))
  writeFileSync(join(root, 'build/icon.png'), big)
  console.log('build/icon.ico y build/icon.png generados')
  app.quit()
}

// Sin top-level await: en el main ESM de Electron bloquea el evento ready.
app.disableHardwareAcceleration()
app.whenReady().then(main, (err) => {
  console.error(err)
  app.exit(1)
})
