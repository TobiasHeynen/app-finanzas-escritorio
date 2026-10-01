/** Sigue el tema del sistema. El switch manual llega en la Fase 2. */
export function followSystemTheme(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = (): void => {
    document.documentElement.classList.toggle('dark', media.matches)
  }
  apply()
  media.addEventListener('change', apply)
}
