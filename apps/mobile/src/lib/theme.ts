import { useColorScheme } from 'react-native'

/** Los mismos tokens de color que la app de PC (globals.css), pasados a hex. */
const light = {
  background: '#f9fafb',
  foreground: '#141822',
  card: '#ffffff',
  primary: '#008d4d',
  primaryForeground: '#fafafa',
  muted: '#eff2f6',
  mutedForeground: '#6b727e',
  accent: '#e4f3ea',
  accentForeground: '#0a3723',
  border: '#e1e5e8',
  positive: '#009956',
  negative: '#de3b3d',
  pending: '#e49e22',
}

export type Colors = typeof light

const dark: Colors = {
  background: '#0d0f15',
  foreground: '#eceff2',
  card: '#15181f',
  primary: '#23ba7d',
  primaryForeground: '#05160d',
  muted: '#23262d',
  mutedForeground: '#999fa8',
  accent: '#1b3427',
  accentForeground: '#cfeddc',
  border: '#ffffff1a',
  positive: '#43c07a',
  negative: '#fa6863',
  pending: '#f2af48',
}

export const radius = { sm: 10, md: 12, lg: 14, xl: 18 }
export const space = (n: number) => n * 4

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark'
}
