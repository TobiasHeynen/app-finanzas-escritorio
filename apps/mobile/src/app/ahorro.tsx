import { useState } from 'react'
import { MovementForm } from '@/features/ahorros/movement-form'
import { takeMovementTarget } from '@/features/ahorros/open'
import { keys, useApiQuery } from '@/lib/hooks'

export default function AhorroScreen() {
  const [target] = useState(takeMovementTarget)
  const { data } = useApiQuery('savings:overview', {}, keys.savings)
  return <MovementForm target={target} goals={data?.goals ?? []} />
}
