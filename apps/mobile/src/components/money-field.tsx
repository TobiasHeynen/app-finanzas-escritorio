import { useState, type Ref } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { formatMoneyInput, parseMoney, type Currency } from '@shared/money'
import { radius, space, useColors } from '@/lib/theme'

/**
 * Monto en formato argentino ("1.234,56") con el teclado numérico del celu. Emite centavos enteros
 * vía money.ts; vacío = null (pendiente). Al salir del campo se normaliza el formato.
 */
export function MoneyField({
  value,
  onValueChange,
  currency = 'ARS',
  placeholder,
  invalid,
  large,
  autoFocus,
  inputRef,
  accessibilityLabel,
}: {
  value: number | null
  onValueChange: (cents: number | null, valid: boolean) => void
  currency?: Currency
  placeholder?: string
  invalid?: boolean
  large?: boolean
  autoFocus?: boolean
  inputRef?: Ref<TextInput>
  accessibilityLabel?: string
}) {
  const c = useColors()
  const [text, setText] = useState(() => formatMoneyInput(value))

  // Si el valor cambia desde afuera (reset del form), se sincroniza el texto durante el render.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    const parsed = text.trim() === '' ? null : parseMoney(text)
    if (parsed !== value) setText(formatMoneyInput(value))
  }

  return (
    <View
      style={[
        styles.box,
        { borderColor: invalid ? c.negative : c.border, backgroundColor: c.card },
        large && { height: 64 },
      ]}
    >
      <Text style={[styles.symbol, { color: c.mutedForeground }, large && { fontSize: 22 }]}>
        {currency === 'USD' ? 'US$' : '$'}
      </Text>
      <TextInput
        ref={inputRef}
        accessibilityLabel={accessibilityLabel}
        autoFocus={autoFocus}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        value={text}
        onChangeText={(next) => {
          setText(next)
          if (next.trim() === '') onValueChange(null, true)
          else {
            const cents = parseMoney(next)
            onValueChange(cents, cents !== null)
          }
        }}
        onBlur={() => {
          const cents = text.trim() === '' ? null : parseMoney(text)
          if (cents !== null) setText(formatMoneyInput(cents))
        }}
        style={[
          styles.input,
          { color: c.foreground },
          large && { fontSize: 30, fontWeight: '700' },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    height: 48,
    gap: space(2),
  },
  symbol: { fontSize: 16, fontWeight: '600' },
  input: { flex: 1, minWidth: 0, fontSize: 18, textAlign: 'right', fontVariant: ['tabular-nums'] },
})
