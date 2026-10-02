import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { space, useColors } from '@/lib/theme'

export function YearStepper({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const c = useColors()
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Año anterior"
        hitSlop={10}
        onPress={() => onChange(value - 1)}
        style={({ pressed }) => pressed && { opacity: 0.5 }}
      >
        <ChevronLeft color={c.foreground} size={22} />
      </Pressable>
      <Text style={[styles.text, { color: c.foreground }]}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Año siguiente"
        hitSlop={10}
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => pressed && { opacity: 0.5 }}
      >
        <ChevronRight color={c.foreground} size={22} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  text: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
})
