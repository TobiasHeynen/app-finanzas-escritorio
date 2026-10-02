import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { space, useColors } from '@/lib/theme'

/**
 * Contenedor de cada pantalla: área segura, título y contenido con scroll. `overlay` va fuera del
 * scroll (botón flotante); `bottomSpace` deja lugar para que no tape el final de la lista.
 */
export function Screen({
  title,
  right,
  children,
  overlay,
  bottomSpace,
}: {
  title?: string
  right?: ReactNode
  children: ReactNode
  overlay?: ReactNode
  bottomSpace?: boolean
}) {
  const colors = useColors()
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, bottomSpace && { paddingBottom: 96 }]}
      >
        {title ? (
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            {right}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {overlay}
    </SafeAreaView>
  )
}

/** Pestaña que todavía no está: dice en qué fase llega. */
export function ComingSoon({ title, phase, what }: { title: string; phase: number; what: string }) {
  const colors = useColors()
  return (
    <Screen title={title}>
      <View style={[styles.soon, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.soonTitle, { color: colors.foreground }]}>Próximamente</Text>
        <Text style={{ color: colors.mutedForeground }}>
          {what} llega en la fase {phase} de la versión para celular.
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space(4), gap: space(4) },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '700' },
  soon: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: space(4),
    gap: space(1),
  },
  soonTitle: { fontSize: 16, fontWeight: '600' },
})
