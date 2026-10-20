interface ImportMetaEnv {
  /** Cliente OAuth "App de escritorio" de Google Cloud (backup en Drive). Vacío = función oculta. */
  readonly MAIN_VITE_GOOGLE_CLIENT_ID?: string
  readonly MAIN_VITE_GOOGLE_CLIENT_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
