import { ipcMain, type WebFrameMain } from 'electron'
import { IPC_CHANNELS, type IpcChannel } from '@shared/ipc/channels'
import { dispatch, type IpcHandler, type IpcHandlers } from './dispatch'
import { isTrustedRendererUrl } from '../security'

export function registerIpcHandlers(handlers: IpcHandlers): void {
  for (const channel of IPC_CHANNELS) {
    register(channel, handlers[channel])
  }
}

function register<C extends IpcChannel>(channel: C, handler: IpcHandler<C>): void {
  ipcMain.handle(channel, (event, rawInput: unknown) => {
    if (!isTrustedFrame(event.senderFrame)) {
      return { ok: false, error: { code: 'FORBIDDEN', message: 'Origen no permitido' } }
    }
    return dispatch(channel, handler, rawInput)
  })
}

function isTrustedFrame(frame: WebFrameMain | null): boolean {
  return frame !== null && frame.parent === null && isTrustedRendererUrl(frame.url)
}
