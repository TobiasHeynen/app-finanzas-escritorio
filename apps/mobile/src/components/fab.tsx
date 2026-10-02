import { Pressable, StyleSheet, Text } from 'react-native'
import { Plus } from 'lucide-react-native'
import { space, useColors } from '@/lib/theme'

/** Botón flotante abajo a la derecha ("+ Gasto"). */
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Plus color={c.primaryForeground} size={22} />
      <Text style={[styles.text, { color: c.primaryForeground }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: space(4),
    bottom: space(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    height: 56,
    paddingHorizontal: space(5),
    borderRadius: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  text: { fontSize: 16, fontWeight: '700' },
})
