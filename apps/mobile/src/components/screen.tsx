import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { space, useColors } from '@/lib/theme'

/** Contenedor de cada pestaña: área segura, título y contenido con scroll. */
export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  const colors = useColors()
  return (
    <SafeAreaView edges={['top']} style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {title ? <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text> : null}
        {children}
      </ScrollView>
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
  title: { fontSize: 26, fontWeight: '700' },
  soon: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: space(4),
    gap: space(1),
  },
  soonTitle: { fontSize: 16, fontWeight: '600' },
})
