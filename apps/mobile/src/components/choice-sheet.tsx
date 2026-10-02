import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { radius, space, useColors } from '@/lib/theme'
import { Button } from './ui'

export type Choice = {
  label: string
  onPress: () => void
  variant?: 'primary' | 'outline' | 'destructive'
  disabled?: boolean
}

/**
 * Pregunta con varias opciones (p. ej. "¿qué cuotas?"). Hace lo mismo que `Alert.alert`, pero también
 * anda en la vista previa web (donde `Alert` no hace nada) y respeta el tema.
 */
export function ChoiceSheet({
  open,
  title,
  description,
  choices,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  choices: Choice[]
  onClose: () => void
}) {
  const c = useColors()
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar">
        <Pressable
          accessibilityRole="alert"
          style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => undefined}
        >
          <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
          {description ? (
            <Text style={{ color: c.mutedForeground, fontSize: 14 }}>{description}</Text>
          ) : null}
          <View style={styles.actions}>
            {choices.map((choice) => (
              <Button
                key={choice.label}
                label={choice.label}
                variant={choice.variant ?? 'outline'}
                disabled={choice.disabled}
                onPress={() => {
                  onClose()
                  choice.onPress()
                }}
              />
            ))}
            <Button label="Cancelar" variant="ghost" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: space(6),
  },
  sheet: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space(5),
    gap: space(3),
  },
  title: { fontSize: 18, fontWeight: '700' },
  actions: { gap: space(2), marginTop: space(1) },
})
