/**
 * La base vive en el almacenamiento privado del navegador (OPFS) y el worker de SQLite toma los archivos
 * en exclusiva: si otra pestaña, ventana o una copia vieja de la página (la que el navegador guarda para
 * "volver atrás") todavía los tiene, abrirla falla con NoModificationAllowedError. Acá se ordena eso:
 * - una sola página por vez usa la base (Web Lock). La que se abre después le pide a la otra que la
 *   suelte, y la otra pasa a la pantalla "abierta en otra ventana" (gana la última).
 * - al salir de la página se corta el worker, así suelta los archivos al toque. Si el navegador la trae
 *   de vuelta desde su caché, se recarga.
 * - si igual choca (el worker anterior todavía se está cerrando), se recarga sola un par de veces.
 */

const LOCK = 'chanchito-db'
const PAUSED_PARAM = 'en-otra-ventana'
const RETRIES_KEY = 'chanchito:reintentos-base'
const MAX_RETRIES = 3

export class DbBusyError extends Error {
  constructor(readonly paused: boolean) {
    super(
      paused
        ? 'Chanchito se abrió en otra pestaña o ventana. Para que no se pisen los datos, se usa en una sola por vez.'
        : 'Chanchito está abierta en otra pestaña o ventana. Cerrala y volvé a intentar.',
    )
  }
}

const workers: Worker[] = []

/** Anota los workers que se creen (el de SQLite lo crea expo-sqlite por adentro) para poder cortarlos. */
function trackWorkers(): void {
  const Original = window.Worker
  window.Worker = class extends Original {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options)
      workers.push(this)
    }
  }
  window.addEventListener('pagehide', () => {
    for (const worker of workers.splice(0)) worker.terminate()
  })
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload()
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Pide el lock y lo retiene mientras la página viva. Devuelve false si no llegó a tiempo. */
async function holdLock(timeoutMs: number): Promise<boolean> {
  const locks = (navigator as Partial<Navigator>).locks
  if (!locks) return true
  return new Promise<boolean>((resolve) => {
    locks
      .request(LOCK, { signal: AbortSignal.timeout(timeoutMs) }, () => {
        resolve(true)
        return new Promise<never>(() => undefined)
      })
      .catch(() => {
        resolve(false)
      })
  })
}

function isBusyError(err: unknown): boolean {
  return err instanceof Error && err.name === 'NoModificationAllowedError'
}

function readRetries(): number {
  try {
    return Number(sessionStorage.getItem(RETRIES_KEY) ?? 0)
  } catch {
    return MAX_RETRIES
  }
}

function writeRetries(value: number | null): void {
  try {
    if (value === null) sessionStorage.removeItem(RETRIES_KEY)
    else sessionStorage.setItem(RETRIES_KEY, String(value))
  } catch {
    // Sin sessionStorage no se reintenta.
  }
}

/** La URL de la pantalla "abierta en otra ventana": tocando "Usar acá" se vuelve a la app. */
export function resumeUrl(): string {
  const url = new URL(window.location.href)
  url.searchParams.delete(PAUSED_PARAM)
  return url.pathname + url.search
}

/**
 * Abre la base con `open` cuidando que ninguna otra página la tenga. `beforeLeave` se espera antes de
 * dejarle la base a otra ventana (p. ej. que terminen de guardarse los backups).
 */
export async function openExclusive(
  open: () => Promise<void>,
  beforeLeave: () => Promise<void>,
): Promise<void> {
  const url = new URL(window.location.href)
  if (url.searchParams.has(PAUSED_PARAM)) throw new DbBusyError(true)

  trackWorkers()
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(LOCK) : null
  channel?.postMessage('take-over')

  // Las que todavía están abriendo no tienen la base: sólo la suelta la que ya la abrió.
  let opened = false
  channel?.addEventListener('message', (event) => {
    if (event.data !== 'take-over' || !opened) return
    opened = false
    void beforeLeave().finally(() => {
      url.searchParams.set(PAUSED_PARAM, '1')
      window.location.replace(url.pathname + url.search)
    })
  })

  if (!(await holdLock(10_000))) throw new DbBusyError(false)
  try {
    await open()
  } catch (err) {
    if (!isBusyError(err)) throw err
    // El worker de la página anterior todavía no soltó los archivos. En este worker ya no se puede
    // reintentar (expo-sqlite queda a medio iniciar): se recarga la página.
    const retries = readRetries()
    if (retries >= MAX_RETRIES) {
      writeRetries(null)
      throw new DbBusyError(false)
    }
    writeRetries(retries + 1)
    await wait(500 * (retries + 1))
    window.location.reload()
    return new Promise<void>(() => undefined)
  }
  writeRetries(null)
  opened = true
}
