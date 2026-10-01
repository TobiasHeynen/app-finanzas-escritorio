import { app, BrowserWindow, dialog, Menu } from 'electron'
import { bootstrapDatabase } from './db/bootstrap'
import { SchemaTooNewError } from './db/migrate'
import { createRepos } from './repositories'
import { createServices, type Services } from './services'
import { systemClock } from './services/context'
import { applySecurityPolicies } from './security'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc/register'
import { createHandlers } from './ipc/handlers'
import { dbPath } from './paths'

// Locale de Chromium en es-AR: inputs de fecha dd/mm/aaaa y textos nativos en español.
app.commandLine.appendSwitch('lang', 'es-AR')

let mainWindow: BrowserWindow | null = null
let services: Services | null = null

function startServices(): Services {
  const { db } = bootstrapDatabase(dbPath())
  const ctx = { db, repos: createRepos(db), clock: systemClock }
  const created = createServices(ctx)
  created.recurring.generateDue()
  return created
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  void app.whenReady().then(() => {
    app.setAppUserModelId('ar.tobiasheynen.misfinanzas')
    if (app.isPackaged) Menu.setApplicationMenu(null)

    try {
      services = startServices()
    } catch (err) {
      const detail =
        err instanceof SchemaTooNewError
          ? `${err.message}\nActualizá la app para abrir estos datos.`
          : String(err)
      dialog.showErrorBox('No se pudo abrir la base de datos', detail)
      app.exit(1)
      return
    }

    applySecurityPolicies()
    registerIpcHandlers(createHandlers(services))
    mainWindow = createMainWindow()
    mainWindow.on('closed', () => (mainWindow = null))

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    services?.ctx.db.close()
  })
}
