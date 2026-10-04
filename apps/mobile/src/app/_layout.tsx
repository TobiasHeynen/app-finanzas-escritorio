import { useEffect, useState } from 'react'
import { AppState, Platform, StyleSheet, Text, View } from 'react-native'
import { QueryClientProvider } from '@tanstack/react-query'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { getAppServices, type AppServices } from '@/lib/services'
import { storageReady } from '@/lib/storage-ready'
import { queryClient } from '@/lib/query'
import { Toaster } from '@/components/toaster'
import { useColors, useIsDark, type Colors } from '@/lib/theme'

/** Formularios: se abren desde abajo, como hojas. */
const MODALS = [
  'gasto',
  'ingreso',
  'cuotas',
  'config/recurrente',
  'config/categoria',
  'config/medio',
  'config/grupo',
]

type Boot = { ok: true; app: AppServices } | { ok: false; message: string } | null

function boot(): Boot {
  try {
    return { ok: true, app: getAppServices() }
  } catch (err) {
    console.error('No se pudo abrir la base', err)
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

export default function RootLayout() {
  const colors = useColors()
  const dark = useIsDark()
  // En el celu se abre la base en el primer render; en web hay que esperar al worker de SQLite.
  const [state, setState] = useState<Boot>(() => (Platform.OS === 'web' ? null : boot()))

  useEffect(() => {
    if (state !== null) return
    void storageReady().then(
      () => {
        setState(boot())
      },
      (err: unknown) => {
        setState({ ok: false, message: err instanceof Error ? err.message : String(err) })
      },
    )
  }, [state])

  // En el celu la app casi nunca se cierra: al volver a primer plano se generan los recurrentes
  // del mes nuevo, si cambió.
  useEffect(() => {
    if (!state?.ok) return
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return
      if (state.app.services.recurring.generateDue() > 0) void queryClient.invalidateQueries()
    })
    return () => sub.remove()
  }, [state])

  const base = dark ? DarkTheme : DefaultTheme
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.foreground,
      border: colors.border,
    },
  }

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {state === null ? null : state.ok ? (
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            {MODALS.map((name) => (
              <Stack.Screen
                key={name}
                name={name}
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
            ))}
          </Stack>
          <Toaster bottomOffset={64} />
        </QueryClientProvider>
      ) : (
        <BootError message={state.message} colors={colors} />
      )}
    </ThemeProvider>
  )
}

function BootError({ message, colors }: { message: string; colors: Colors }) {
  return (
    <View style={[styles.error, { backgroundColor: colors.background }]}>
      <Text style={[styles.errorTitle, { color: colors.foreground }]}>
        No se pudo abrir la base de datos
      </Text>
      <Text style={{ color: colors.mutedForeground }}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: 24, gap: 8 },
  errorTitle: { fontSize: 18, fontWeight: '600' },
})
