import { app, BrowserWindow, Menu } from 'electron'
import { applySecurityPolicies } from './security'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc/register'
import { createHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

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

    applySecurityPolicies()
    registerIpcHandlers(createHandlers())
    mainWindow = createMainWindow()
    mainWindow.on('closed', () => (mainWindow = null))

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
