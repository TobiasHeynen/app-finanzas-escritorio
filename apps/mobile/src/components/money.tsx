import { Text, type StyleProp, type TextStyle } from 'react-native'
import { formatMoney, type Currency } from '@shared/money'
import { useColors } from '@/lib/theme'

/** Monto con cifras tabulares. null = pendiente (no es $ 0). */
export function Money({
  cents,
  currency = 'ARS',
  decimals,
  showPlus,
  tone,
  style,
}: {
  cents: number | null
  currency?: Currency
  decimals?: 'auto' | 'always' | 'never'
  showPlus?: boolean
  tone?: 'positive' | 'negative' | 'muted'
  style?: StyleProp<TextStyle>
}) {
  const c = useColors()
  const color =
    cents === null
      ? c.pending
      : tone === 'positive'
        ? c.positive
        : tone === 'negative'
          ? c.negative
          : tone === 'muted'
            ? c.mutedForeground
            : c.foreground
  return (
    <Text style={[{ color, fontVariant: ['tabular-nums'] }, style]} numberOfLines={1}>
      {cents === null
        ? 'Pendiente'
        : formatMoney(cents, currency, {
            ...(decimals && { decimals }),
            ...(showPlus && { showPlus }),
          })}
    </Text>
  )
}
