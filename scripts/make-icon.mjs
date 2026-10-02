// Genera build/icon.png (512), build/icon.ico (16-256) y los logos de la Store (build/appx/) desde
// build/icon.svg y build/glyph.svg usando Chromium.
// Uso: npx electron scripts/make-icon.mjs
import { app, BrowserWindow, nativeImage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const svg = readFileSync(join(root, 'build/icon.svg'), 'utf8')
const glyph = readFileSync(join(root, 'build/glyph.svg'), 'utf8')
const SIZES = [16, 24, 32, 48, 64, 128, 256]

let win = null

/** Renderiza un svg a PNG de width × height; `scale` = fracción del alto que ocupa el svg. */
async function render(source, width, height = width, scale = 1) {
  // Una sola ventana para todo: crear y destruir varias seguidas hace fallar la carga.
  win ??= new BrowserWindow({
    width: 1240,
    height: 600,
    show: false,
    transparent: true,
    frame: false,
    useContentSize: true,
    webPreferences: { offscreen: true },
  })
  win.setContentSize(width, height)
  const side = Math.round(height * scale)
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden;width:${width}px;height:${height}px;display:flex;align-items:center;justify-content:center">
    <img style="width:${side}px;height:${side}px;display:block" src="data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}"></body></html>`
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`)
  await new Promise((r) => setTimeout(r, 300))
  const image = await win.webContents.capturePage({ x: 0, y: 0, width, height })
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

// Se renderiza grande y se achica (las ventanas muy chicas no cargan bien).
const shrink = (png, width, height = width) =>
  nativeImage.createFromBuffer(png).resize({ width, height, quality: 'best' }).toPNG()

async function main() {
  const big = await render(svg, 512)
  const pngs = SIZES.map((size) => ({ size, data: shrink(big, size) }))
  writeFileSync(join(root, 'build/icon.ico'), toIco(pngs))
  writeFileSync(join(root, 'build/icon.png'), big)

  // Logos del paquete de la Store (electron-builder los toma de build/appx/). Los tiles llevan el
  // chanchito blanco sobre el backgroundColor del manifiesto.
  const appx = join(root, 'build/appx')
  mkdirSync(appx, { recursive: true })
  const tile = await render(glyph, 600, 600, 0.6)
  const wide = await render(glyph, 1240, 600, 0.6)
  const files = {
    'StoreLogo.png': shrink(big, 50),
    'Square44x44Logo.png': shrink(big, 44),
    'Square150x150Logo.png': shrink(tile, 150),
    'Wide310x150Logo.png': shrink(wide, 310, 150),
    'LargeTile.png': shrink(tile, 310),
    'SmallTile.png': shrink(tile, 71),
  }
  for (const [name, data] of Object.entries(files)) writeFileSync(join(appx, name), data)
  win?.destroy()
  console.log('build/icon.ico, build/icon.png y build/appx/*.png generados')
  app.quit()
}

// Sin top-level await: en el main ESM de Electron bloquea el evento ready.
app.disableHardwareAcceleration()
app.whenReady().then(main, (err) => {
  console.error(err)
  app.exit(1)
})
