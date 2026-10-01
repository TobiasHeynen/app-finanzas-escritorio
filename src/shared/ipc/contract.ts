import { z } from 'zod'
import type { IpcChannel } from './channels'

/**
 * Contrato IPC: fuente de verdad de cada canal (input y output).
 * - main valida el input con `input.parse` antes de llamar al handler.
 * - preload y renderer sólo usan los tipos inferidos (import type), nunca zod en runtime.
 */
export const ipcContract = {
  'app:ping': {
    input: z.object({ message: z.string().trim().min(1).max(200) }).strict(),
    output: z.object({
      reply: z.string(),
      receivedAt: z.iso.datetime(),
      versions: z.object({ app: z.string(), electron: z.string(), node: z.string() }),
    }),
  },
} as const satisfies Record<IpcChannel, { input: z.ZodType; output: z.ZodType }>

export type IpcContract = typeof ipcContract
export type IpcInput<C extends IpcChannel> = z.input<IpcContract[C]['input']>
export type IpcParsedInput<C extends IpcChannel> = z.output<IpcContract[C]['input']>
export type IpcOutput<C extends IpcChannel> = z.output<IpcContract[C]['output']>
