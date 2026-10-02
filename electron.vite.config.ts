import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve(__dirname, 'src/shared')

/**
 * Content-Security-Policy del renderer, como <meta> (funciona también con file:// en prod).
 * En dev se habilita lo mínimo que necesita Vite: el preámbulo inline de React Refresh y el websocket de HMR.
 * 'unsafe-inline' en style-src lo necesitan Radix (posicionamiento) y Recharts (estilos inline).
 */
function cspPlugin(): Plugin {
  return {
    name: 'chanchito:csp',
    transformIndexHtml(html, ctx) {
      const isDev = Boolean(ctx.server)
      const csp = [
        "default-src 'self'",
        isDev ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        isDev ? "connect-src 'self' ws://localhost:*" : "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; ')
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      )
    },
  }
}

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared, '@main': resolve(__dirname, 'src/main') } },
  },
  preload: {
    resolve: { alias: { '@shared': shared } },
    // Con sandbox: true el preload sólo puede hacer require('electron'): todo lo demás va bundleado.
    build: { externalizeDeps: false, rollupOptions: { output: { format: 'cjs' } } },
  },
  renderer: {
    resolve: {
      alias: { '@shared': shared, '@renderer': resolve(__dirname, 'src/renderer/src') },
    },
    plugins: [cspPlugin(), react(), tailwindcss()],
  },
})
