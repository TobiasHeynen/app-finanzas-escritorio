import { formatMoney, type Currency } from '@shared/money'
import { cn } from '@renderer/lib/utils'

interface MoneyProps {
  cents: number | null
  currency?: Currency
  className?: string
  decimals?: 'auto' | 'always' | 'never'
  showPlus?: boolean
  /** Colorea verde/rojo según el signo. */
  signColor?: boolean
}

/** Monto formateado es-AR con cifras tabulares. null = pendiente. */
export function Money({
  cents,
  currency = 'ARS',
  className,
  decimals,
  showPlus,
  signColor,
}: MoneyProps) {
  if (cents === null) {
    return <span className={cn('font-medium text-pending', className)}>Pendiente</span>
  }
  return (
    <span
      className={cn(
        'whitespace-nowrap money',
        signColor && cents > 0 && 'text-positive',
        signColor && cents < 0 && 'text-negative',
        className,
      )}
    >
      {formatMoney(cents, currency, { decimals, showPlus })}
    </span>
  )
}
