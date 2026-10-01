import { forwardRef, useEffect, useState } from 'react'
import { formatMoneyInput, parseMoney, type Currency } from '@shared/money'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'

interface MoneyInputProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'defaultValue'
> {
  value: number | null
  onValueChange: (cents: number | null, valid: boolean) => void
  currency?: Currency
}

/**
 * Input de montos en formato argentino ("1.234,56"). Mantiene el texto que escribe el usuario y
 * emite centavos enteros (vía money.ts). Al salir del campo se normaliza el formato.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, currency = 'ARS', className, onBlur, ...props },
  ref,
) {
  const [text, setText] = useState(() => formatMoneyInput(value))

  // Si el valor cambia desde afuera (reset del form), sincronizar el texto.
  useEffect(() => {
    setText((current) => {
      const parsed = current.trim() === '' ? null : parseMoney(current)
      return parsed === value ? current : formatMoneyInput(value)
    })
  }, [value])

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        {currency === 'USD' ? 'US$' : '$'}
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        className={cn('pl-9 text-right money', currency === 'USD' && 'pl-11', className)}
        value={text}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          if (next.trim() === '') onValueChange(null, true)
          else {
            const cents = parseMoney(next)
            onValueChange(cents, cents !== null)
          }
        }}
        onBlur={(e) => {
          const cents = text.trim() === '' ? null : parseMoney(text)
          if (cents !== null) setText(formatMoneyInput(cents))
          onBlur?.(e)
        }}
        {...props}
      />
    </div>
  )
})
