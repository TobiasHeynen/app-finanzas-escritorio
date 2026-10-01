import type { IpcChannel } from './channels'
import type { IpcInput, IpcOutput } from './contract'
import type { IpcResult } from './result'

/** API que el preload expone en `window.api`. */
export interface FinanzasApi {
  invoke<C extends IpcChannel>(channel: C, input: IpcInput<C>): Promise<IpcResult<IpcOutput<C>>>
}
