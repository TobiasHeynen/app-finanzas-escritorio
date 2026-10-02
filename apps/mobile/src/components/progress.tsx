import { View } from 'react-native'
import { useColors } from '@/lib/theme'

/** Barra de progreso (0 a 100). */
export function Progress({
  value,
  color,
  height = 6,
  label,
}: {
  value: number
  color?: string
  height?: number
  label?: string
}) {
  const c = useColors()
  const pct = Math.max(0, Math.min(100, value))
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{
        flexDirection: 'row',
        height,
        borderRadius: height,
        backgroundColor: c.muted,
        overflow: 'hidden',
      }}
    >
      <View style={{ flex: pct, borderRadius: height, backgroundColor: color ?? c.primary }} />
      <View style={{ flex: 100 - pct }} />
    </View>
  )
}
