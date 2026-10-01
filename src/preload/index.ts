import { contextBridge, ipcRenderer } from 'electron'
import { isIpcChannel } from '@shared/ipc/channels'
import type { FinanzasApi } from '@shared/ipc/api'

const api: FinanzasApi = {
  invoke(channel, input) {
    if (!isIpcChannel(channel)) {
      return Promise.reject(new Error(`Canal IPC no permitido: ${String(channel)}`))
    }
    return ipcRenderer.invoke(channel, input)
  },
}

contextBridge.exposeInMainWorld('api', api)
