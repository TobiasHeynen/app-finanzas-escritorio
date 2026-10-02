import { app, BrowserWindow, dialog, Menu } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { bootstrapDatabase } from './db/bootstrap'
import { SchemaTooNewError } from './db/migrate'
import { createRepos } from './repositories'
import { createServices, type Services } from './services'
import { systemClock } from './services/context'
import { applySecurityPolicies } from './security'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc/register'
import { createHandlers } from './ipc/handlers'
import { backupsDir, dbPath } from './paths'
import { backupBeforeMigrations } from './backups'
import { createBackup } from './db/backup'

// Locale de Chromium en es-AR: inputs de fecha dd/mm/aaaa y textos nativos en español.
app.commandLine.appendSwitch('lang', 'es-AR')

// La app antes se llamaba "Mis Finanzas" y sus datos quedaban en esa carpeta de userData. Si ya hay
// datos ahí y todavía no en la carpeta nueva, se sigue usando la vieja para no perder nada.
// Tiene que ir antes del lock de instancia única, que vive en userData.
if (!app.commandLine.hasSwitch('user-data-dir') && !existsSync(dbPath())) {
  const legacy = join(app.getPath('appData'), 'Mis Finanzas')
  if (existsSync(join(legacy, 'finanzas.db'))) app.setPath('userData', legacy)
}

let mainWindow: BrowserWindow | null = null
let services: Services | null = null

async function startServices(): Promise<Services> {
  await backupBeforeMigrations()
  const { db, seeded } = bootstrapDatabase(dbPath())
  const ctx = { db, repos: createRepos(db), clock: systemClock }
  const created = createServices(ctx)
  created.recurring.generateDue()
  // Backup de cada inicio (no bloquea la ventana). Una base recién creada no hace falta.
  if (!seeded) {
    createBackup(db, backupsDir(), 'inicio').catch((err: unknown) => {
      console.error('No se pudo hacer el backup de inicio', err)
    })
  }
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

  void app.whenReady().then(async () => {
    // En el paquete de la Store el AppUserModelID lo define el manifiesto.
    if (!process.windowsStore) app.setAppUserModelId('ar.tobiasheynen.chanchito')
    if (app.isPackaged) Menu.setApplicationMenu(null)

    try {
      services = await startServices()
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
