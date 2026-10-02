import { View } from 'react-native'
import { Banknote, CreditCard, Landmark, Send, Tag } from 'lucide-react-native'
import type { PaymentMethod } from '@shared/types'
import { CATEGORY_ICONS } from '@/lib/category-icons'

/** Ícono de categoría en un círculo con el color de la categoría suavizado (como en la PC). */
export function CategoryIcon({
  icon,
  color,
  size = 'md',
  muted,
}: {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  muted?: boolean
}) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag
  const box = { sm: 28, md: 38, lg: 46 }[size]
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: box / 2,
        backgroundColor: `${color}22`,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: muted ? 0.5 : 1,
      }}
    >
      <Icon color={color} size={box * 0.48} />
    </View>
  )
}

const TYPE_ICONS = {
  efectivo: Banknote,
  debito: Landmark,
  transferencia: Send,
  tarjeta_credito: CreditCard,
}

export function PaymentMethodIcon({
  method,
  size = 18,
}: {
  method: Pick<PaymentMethod, 'type' | 'color'>
  size?: number
}) {
  const Icon = TYPE_ICONS[method.type]
  return <Icon color={method.color ?? '#64748b'} size={size} />
}
