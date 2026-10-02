import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { radius, space, useColors } from '@/lib/theme'

type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'destructive' | 'secondary'

/** Botón con las mismas variantes que shadcn en la PC. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  size = 'md',
  accessibilityLabel,
}: {
  label?: string
  onPress: () => void
  variant?: ButtonVariant
  icon?: ReactNode
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
  size?: 'sm' | 'md' | 'lg'
  accessibilityLabel?: string
}) {
  const c = useColors()
  const bg = {
    primary: c.primary,
    destructive: c.negative,
    secondary: c.muted,
    outline: 'transparent',
    ghost: 'transparent',
  }[variant]
  const fg = {
    primary: c.primaryForeground,
    destructive: '#ffffff',
    secondary: c.foreground,
    outline: c.foreground,
    ghost: c.foreground,
  }[variant]
  const height = { sm: 36, md: 44, lg: 52 }[size]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          height,
          borderColor: variant === 'outline' ? c.border : 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
          paddingHorizontal: label ? space(4) : 0,
          width: label ? undefined : height,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      {label ? (
        <Text style={[styles.buttonText, { color: fg }, size === 'sm' && { fontSize: 14 }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  )
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}) {
  const c = useColors()
  const base = [styles.card, { backgroundColor: c.card, borderColor: c.border }, style]
  if (!onPress) return <View style={base}>{children}</View>
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.8 }]}>
      {children}
    </Pressable>
  )
}

/** Opción seleccionable (medios de pago, filtros, cantidad de cuotas...). */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string
  selected: boolean
  onPress: () => void
  icon?: ReactNode
  color?: string
}) {
  const c = useColors()
  const accent = color ?? c.primary
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? accent : c.border,
          backgroundColor: selected ? `${accent}1f` : c.card,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {icon}
      <Text
        numberOfLines={1}
        style={[styles.chipText, { color: selected ? c.foreground : c.mutedForeground }]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export function Label({ children }: { children: ReactNode }) {
  const c = useColors()
  return <Text style={[styles.label, { color: c.mutedForeground }]}>{children}</Text>
}

export function FieldError({ message }: { message: string | undefined }) {
  const c = useColors()
  if (!message) return null
  return <Text style={{ color: c.negative, fontSize: 13 }}>{message}</Text>
}

export function TextField({
  invalid,
  style,
  ...props
}: TextInputProps & { invalid?: boolean; style?: StyleProp<TextStyle> }) {
  const c = useColors()
  return (
    <TextInput
      placeholderTextColor={c.mutedForeground}
      {...props}
      style={[
        styles.input,
        {
          color: c.foreground,
          borderColor: invalid ? c.negative : c.border,
          backgroundColor: c.card,
        },
        style,
      ]}
    />
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const c = useColors()
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionTitleText, { color: c.foreground }]}>{children}</Text>
      {right}
    </View>
  )
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors()
  return <Text style={[{ color: c.mutedForeground, fontSize: 14 }, style]}>{children}</Text>
}

export function Separator() {
  const c = useColors()
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    borderRadius: radius.md,
    borderWidth: 1,
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space(4) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space(3),
    height: 36,
    maxWidth: 220,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    height: 46,
    fontSize: 16,
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleText: { fontSize: 17, fontWeight: '700' },
})
