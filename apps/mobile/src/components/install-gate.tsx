import type { ReactNode } from 'react'

/** Sólo la versión web pide instalarla: en Android la app ya está instalada. */
export function InstallGate({ children }: { children: ReactNode }) {
  return children
}
