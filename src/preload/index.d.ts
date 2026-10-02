import type { FinanzasApi } from '@shared/ipc/api'

declare global {
  interface Window {
    api: FinanzasApi
  }
}

export {}
