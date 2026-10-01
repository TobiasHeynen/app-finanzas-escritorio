import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
type Resolved = 'light' | 'dark'

const STORAGE_KEY = 'mis-finanzas:theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function resolve(pref: ThemePreference): Resolved {
  if (pref === 'system') return media.matches ? 'dark' : 'light'
  return pref
}

function apply(resolved: Resolved): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
}

// Aplicar antes del primer render para evitar el flash de tema.
apply(resolve(readPreference()))

interface ThemeContextValue {
  preference: ThemePreference
  resolved: Resolved
  setPreference: (pref: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState(media.matches)

  useEffect(() => {
    const onChange = (): void => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved: Resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => apply(resolved), [resolved])

  const setPreference = useCallback((pref: ThemePreference) => {
    setPref(pref)
    try {
      localStorage.setItem(STORAGE_KEY, pref)
    } catch {
      // sin storage: el tema dura sólo esta sesión
    }
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme fuera de ThemeProvider')
  return ctx
}
