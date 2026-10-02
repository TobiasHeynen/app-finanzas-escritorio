import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react-native'
import { radius, space, useColors } from '@/lib/theme'

/** Fila tocable de una lista (menú "Más", configuración). */
export function ListItem({
  icon,
  title,
  subtitle,
  right,
  onPress,
  muted,
  chevron = true,
}: {
  icon?: ReactNode
  title: string
  subtitle?: string | undefined
  right?: ReactNode
  onPress?: () => void
  muted?: boolean
  chevron?: boolean
}) {
  const c = useColors()
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: c.card,
          borderColor: c.border,
          opacity: muted ? 0.6 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={[styles.title, { color: c.foreground }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={{ color: c.mutedForeground, fontSize: 12 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress && chevron ? <ChevronRight color={c.mutedForeground} size={18} /> : null}
    </Pressable>
  )
}

/** Subir / bajar un elemento de una lista ordenable. */
export function ReorderButtons({
  index,
  count,
  label,
  onMove,
}: {
  index: number
  count: number
  label: string
  onMove: (from: number, to: number) => void
}) {
  const c = useColors()
  return (
    <View style={{ gap: 2 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Subir ${label}`}
        disabled={index === 0}
        hitSlop={6}
        onPress={() => onMove(index, index - 1)}
        style={{ opacity: index === 0 ? 0.25 : 1 }}
      >
        <ChevronUp color={c.mutedForeground} size={18} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Bajar ${label}`}
        disabled={index === count - 1}
        hitSlop={6}
        onPress={() => onMove(index, index + 1)}
        style={{ opacity: index === count - 1 ? 0.25 : 1 }}
      >
        <ChevronDown color={c.mutedForeground} size={18} />
      </Pressable>
    </View>
  )
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 15, fontWeight: '600' },
})
