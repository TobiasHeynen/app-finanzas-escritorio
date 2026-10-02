import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { dismiss, useCurrentToast } from '@/lib/toast'
import { radius, space, useColors } from '@/lib/theme'

/** Snackbar abajo de todo, con acción opcional ("Deshacer"). */
export function Toaster({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const t = useCurrentToast()
  const c = useColors()
  const insets = useSafeAreaInsets()
  if (!t) return null
  const accent = t.kind === 'error' ? c.negative : c.primary
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + bottomOffset + space(3) }]}
    >
      <View
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: c.foreground, borderLeftColor: accent }]}
      >
        <Text style={[styles.text, { color: c.background }]}>{t.message}</Text>
        {t.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              const action = t.action
              dismiss()
              action?.onPress()
            }}
          >
            <Text style={[styles.action, { color: c.accent }]}>{t.action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space(3), right: space(3) },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    borderRadius: radius.md,
    borderLeftWidth: 4,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  text: { flex: 1, fontSize: 15 },
  action: { fontSize: 15, fontWeight: '700', textTransform: 'uppercase' },
})
