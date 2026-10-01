import { z } from 'zod'
import { AppError } from '@shared/errors'
import { ipcContract, type IpcOutput, type IpcParsedInput } from '@shared/ipc/contract'
import type { IpcChannel } from '@shared/ipc/channels'
import type { IpcResult } from '@shared/ipc/result'

// Mensajes de validación en español.
z.config(z.locales.es())

export type IpcHandler<C extends IpcChannel> = (
  input: IpcParsedInput<C>,
) => IpcOutput<C> | Promise<IpcOutput<C>>

export type IpcHandlers = { [C in IpcChannel]: IpcHandler<C> }

/**
 * Valida el payload con el schema del contrato, ejecuta el handler y envuelve el resultado.
 * Nunca deja salir un stack trace al renderer: los errores inesperados se loguean acá
 * y viajan como INTERNAL con un mensaje genérico.
 */
export async function dispatch<C extends IpcChannel>(
  channel: C,
  handler: IpcHandler<C>,
  rawInput: unknown,
  log: (msg: string, err: unknown) => void = console.error,
): Promise<IpcResult<IpcOutput<C>>> {
  const parsed = ipcContract[channel].input.safeParse(rawInput)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION', message: 'Datos inválidos', fields: flatten(parsed.error) },
    }
  }
  try {
    const data = await handler(parsed.data as IpcParsedInput<C>)
    return { ok: true, data }
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        error: { code: err.code, message: err.message, ...(err.fields && { fields: err.fields }) },
      }
    }
    log(`[ipc] ${channel} falló`, err)
    return { ok: false, error: { code: 'INTERNAL', message: 'Ocurrió un error inesperado' } }
  }
}

function flatten(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  return fields
}
