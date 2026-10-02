import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { addMonths, formatMonthTitle, type Month } from '@shared/months'
import { space, useColors } from '@/lib/theme'

export function MonthStepper({
  value,
  onChange,
  size = 'lg',
}: {
  value: Month
  onChange: (month: Month) => void
  size?: 'sm' | 'lg'
}) {
  const c = useColors()
  const icon = size === 'lg' ? 24 : 18
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mes anterior"
        hitSlop={10}
        onPress={() => onChange(addMonths(value, -1))}
        style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.5 }]}
      >
        <ChevronLeft color={c.foreground} size={icon} />
      </Pressable>
      <Text
        style={[
          styles.text,
          { color: c.foreground, fontSize: size === 'lg' ? 20 : 15 },
          size === 'lg' && { minWidth: 170 },
        ]}
      >
        {formatMonthTitle(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mes siguiente"
        hitSlop={10}
        onPress={() => onChange(addMonths(value, 1))}
        style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.5 }]}
      >
        <ChevronRight color={c.foreground} size={icon} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  arrow: { padding: space(1.5) },
  text: { fontWeight: '700', textAlign: 'center' },
})
