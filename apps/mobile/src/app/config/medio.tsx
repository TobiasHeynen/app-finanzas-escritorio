import { useState } from 'react'
import type { PaymentMethod } from '@shared/types'
import { PaymentMethodForm } from '@/features/configuracion/payment-method-form'
import { takePayload } from '@/lib/nav-payload'

export default function MedioScreen() {
  const [method] = useState(() => takePayload<PaymentMethod | null>('/config/medio', null))
  return <PaymentMethodForm method={method} />
}
