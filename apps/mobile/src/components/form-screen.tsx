import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Trash2, X } from 'lucide-react-native'
import { space, useColors } from '@/lib/theme'
import { Button, FieldError } from './ui'

/** Pantalla de formulario: cerrar arriba, título, borrar (opcional), cuerpo con scroll y Guardar abajo. */
export function FormScreen({
  title,
  description,
  children,
  onSave,
  saving,
  onDelete,
  deleteLabel = 'Borrar',
  error,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  onSave: () => void
  saving?: boolean
  onDelete?: (() => void) | undefined
  deleteLabel?: string
  error?: string | undefined
  footer?: ReactNode
}) {
  const c = useColors()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Button
            variant="ghost"
            icon={<X color={c.foreground} size={22} />}
            accessibilityLabel="Cerrar"
            onPress={() => router.back()}
          />
          <Text style={[styles.title, { color: c.foreground }]} numberOfLines={1}>
            {title}
          </Text>
          {onDelete ? (
            <Button
              variant="ghost"
              icon={<Trash2 color={c.negative} size={20} />}
              accessibilityLabel={deleteLabel}
              onPress={onDelete}
            />
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
          {description ? (
            <Text style={{ color: c.mutedForeground, fontSize: 14 }}>{description}</Text>
          ) : null}
          {children}
          <FieldError message={error} />
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.card }]}>
          {footer}
          <Button label="Guardar" loading={saving} style={{ flex: 1 }} onPress={onSave} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | undefined
  children: ReactNode
}) {
  const c = useColors()
  return (
    <View style={{ gap: space(1.5) }}>
      <Text style={{ color: c.mutedForeground, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      {children}
      <FieldError message={error} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(2),
    paddingVertical: space(1),
  },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  body: { padding: space(4), gap: space(4), paddingBottom: space(8) },
  footer: {
    flexDirection: 'row',
    gap: space(3),
    padding: space(3),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
