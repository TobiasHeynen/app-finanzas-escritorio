import type { IpcChannel } from '@shared/ipc/channels'
import type { IpcInput, IpcOutput } from '@shared/ipc/contract'
import type { IpcError } from '@shared/ipc/result'

/** Error de la API de IPC, para que TanStack Query lo maneje como cualquier error. */
export class ApiError extends Error {
  readonly code: IpcError['code']
  readonly fields: Record<string, string> | undefined

  constructor(error: IpcError) {
    super(error.message)
    this.name = 'ApiError'
    this.code = error.code
    this.fields = error.fields
  }
}

/** Llama a un canal IPC y devuelve los datos, o tira ApiError. */
export async function call<C extends IpcChannel>(
  channel: C,
  input: IpcInput<C>,
): Promise<IpcOutput<C>> {
  const result = await window.api.invoke(channel, input)
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}
