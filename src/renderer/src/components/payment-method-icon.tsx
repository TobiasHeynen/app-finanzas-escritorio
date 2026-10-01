import { Banknote, CreditCard, Landmark, Send } from 'lucide-react'
import type { PaymentMethod } from '@shared/types'
import { cn } from '@renderer/lib/utils'

const TYPE_ICONS = {
  efectivo: Banknote,
  debito: Landmark,
  transferencia: Send,
  tarjeta_credito: CreditCard,
}

export function PaymentMethodIcon({
  method,
  className,
}: {
  method: Pick<PaymentMethod, 'type' | 'color'>
  className?: string
}) {
  const Icon = TYPE_ICONS[method.type]
  const color = method.color ?? '#64748b'
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
        className,
      )}
      style={{ backgroundColor: `${color}22`, color }}
      aria-hidden
    >
      <Icon className="size-4.5" />
    </span>
  )
}
