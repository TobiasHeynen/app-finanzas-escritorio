// Lista blanca de canales IPC. Este archivo NO importa zod: lo usa el preload (sandbox),
// que sólo puede bundlear código chico y sin dependencias pesadas.
// Un test verifica que coincida con las claves de `ipcContract`.
export const IPC_CHANNELS = ['app:ping'] as const

export type IpcChannel = (typeof IPC_CHANNELS)[number]

export function isIpcChannel(value: unknown): value is IpcChannel {
  return typeof value === 'string' && (IPC_CHANNELS as readonly string[]).includes(value)
}
