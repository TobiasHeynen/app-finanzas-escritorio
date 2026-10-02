// Genera los íconos de la app de Android (apps/mobile/assets) desde build/icon.svg y build/glyph.svg.
// Uso: npx electron scripts/make-mobile-icons.mjs (en Linux como root: xvfb-run -a ... --no-sandbox)
import { app, BrowserWindow, nativeImage } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const icon = readFileSync(join(root, 'build/icon.svg'), 'utf8')
const glyph = readFileSync(join(root, 'build/glyph.svg'), 'utf8')
const out = join(root, 'apps/mobile/assets')
const b64 = (s) => Buffer.from(s).toString('base64')
let win = null

async function render(svg, size, frac, background = 'transparent') {
  win ??= new BrowserWindow({
    width: size,
    height: size,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true },
  })
  win.setContentSize(size, size)
  const side = Math.round(size * frac)
  const html = `<html><body style="margin:0;overflow:hidden;width:${size}px;height:${size}px;background:${background};display:flex;align-items:center;justify-content:center"><img style="width:${side}px;height:${side}px" src="data:image/svg+xml;base64,${b64(svg)}"></body></html>`
  await win.loadURL(`data:text/html;base64,${b64(html)}`)
  await new Promise((r) => setTimeout(r, 300))
  return (await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size })).toPNG()
}

async function main() {
  const full = await render(icon, 1024, 1)
  writeFileSync(join(out, 'icon.png'), full)
  writeFileSync(join(out, 'splash-icon.png'), full)
  writeFileSync(
    join(out, 'favicon.png'),
    nativeImage.createFromBuffer(full).resize({ width: 48, height: 48, quality: 'best' }).toPNG(),
  )
  // Ícono adaptativo: el chanchito blanco dentro de la zona segura (66% central) sobre el verde.
  writeFileSync(join(out, 'adaptive-icon.png'), await render(glyph, 1024, 0.5))
  win?.destroy()
  console.log('apps/mobile/assets/*.png generados')
  app.quit()
}

app.disableHardwareAcceleration()
app.whenReady().then(main, (err) => {
  console.error(err)
  app.exit(1)
})
