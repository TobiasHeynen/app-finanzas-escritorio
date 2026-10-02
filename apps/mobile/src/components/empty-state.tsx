import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { space, useColors } from '@/lib/theme'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  const c = useColors()
  return (
    <View style={styles.wrap}>
      {icon ? <View style={[styles.icon, { backgroundColor: c.muted }]}>{icon}</View> : null}
      <Text style={[styles.title, { color: c.foreground }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: c.mutedForeground }]}>{description}</Text>
      ) : null}
      {action}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space(2), paddingVertical: space(8) },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  description: { fontSize: 14, textAlign: 'center' },
})
