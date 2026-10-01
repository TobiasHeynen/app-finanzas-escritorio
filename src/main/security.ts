import { app, session, shell } from 'electron'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'

const devServerUrl = process.env['ELECTRON_RENDERER_URL']
const prodIndexUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href

/** ¿La URL pertenece a nuestro renderer (dev server en desarrollo, index.html empaquetado en prod)? */
export function isTrustedRendererUrl(url: string): boolean {
  if (!app.isPackaged && devServerUrl) {
    return new URL(url).origin === new URL(devServerUrl).origin
  }
  return url.split(/[?#]/)[0] === prodIndexUrl
}

/** Hardening global: se llama una vez, antes de crear ventanas. */
export function applySecurityPolicies(): void {
  // Ningún permiso del navegador (cámara, notificaciones, geolocalización, etc.).
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  )
  session.defaultSession.setPermissionCheckHandler(() => false)

  app.on('web-contents-created', (_event, contents) => {
    // Sin ventanas nuevas: los links https se abren en el navegador del sistema.
    contents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url)
      return { action: 'deny' }
    })
    contents.on('will-navigate', (event, url) => {
      if (!isTrustedRendererUrl(url)) event.preventDefault()
    })
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })
}
