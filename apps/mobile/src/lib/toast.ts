import { useSyncExternalStore } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onPress: () => void
}

export interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: ToastAction | undefined
  duration: number
}

/** Un toast a la vez (como el snackbar de Android): el nuevo reemplaza al anterior. */
let current: Toast | null = null
let nextId = 1
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function show(
  kind: ToastKind,
  message: string,
  options: { action?: ToastAction; duration?: number } = {},
) {
  const duration = options.duration ?? (options.action ? 8000 : 3500)
  current = { id: nextId++, kind, message, action: options.action, duration }
  if (timer) clearTimeout(timer)
  timer = setTimeout(dismiss, duration)
  emit()
}

export function dismiss(): void {
  if (timer) clearTimeout(timer)
  timer = null
  current = null
  emit()
}

export const toast = {
  success: (message: string, options?: { action?: ToastAction; duration?: number }) =>
    show('success', message, options),
  error: (message: string, options?: { action?: ToastAction; duration?: number }) =>
    show('error', message, options),
  info: (message: string, options?: { action?: ToastAction; duration?: number }) =>
    show('info', message, options),
}

export function useCurrentToast(): Toast | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
