import Constants from 'expo-constants'
import { dispatch, type IpcHandler } from '@core/api/dispatch'
import { createCoreHandlers, type CoreHandlers, type PlatformChannel } from '@core/api/handlers'
import type { Services } from '@core/services'
import type { IpcChannel } from '@shared/ipc/channels'
import type { IpcInput, IpcOutput } from '@shared/ipc/contract'
import type { IpcError } from '@shared/ipc/result'
import { DB_NAME } from './db-name'

/** Error de la API, igual que en la PC: TanStack Query lo maneja como cualquier error. */
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

type PlatformHandlers = { [C in PlatformChannel]?: IpcHandler<C> }
type Handlers = CoreHandlers & PlatformHandlers

let handlers: Handlers | null = null

/** Los canales de la plataforma (backups, exportar) se suman desde cada feature con `addHandlers`. */
export function initApi(services: Services): void {
  handlers = {
    ...createCoreHandlers(services),
    'app:info': () => ({
      version: Constants.expoConfig?.version ?? '0.0.0',
      dataPath: DB_NAME,
      today: services.ctx.clock.today(),
    }),
  }
}

export function addHandlers(extra: PlatformHandlers): void {
  if (!handlers) throw new Error('initApi no se llamó')
  handlers = { ...handlers, ...extra }
}

/**
 * Mismo `call` que en la PC, sin IPC: valida con el contrato (zod), corre el handler de core y
 * devuelve los datos o tira ApiError.
 */
export async function call<C extends IpcChannel>(
  channel: C,
  input: IpcInput<C>,
): Promise<IpcOutput<C>> {
  if (!handlers) throw new Error('initApi no se llamó')
  const handler = (handlers as Partial<Record<IpcChannel, unknown>>)[channel] as
    IpcHandler<C> | undefined
  if (!handler) {
    throw new ApiError({ code: 'INTERNAL', message: 'Todavía no está disponible en el celu' })
  }
  const result = await dispatch(channel, handler, input)
  if (!result.ok) throw new ApiError(result.error)
  return result.data
}
