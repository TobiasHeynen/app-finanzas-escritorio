import { useState } from 'react'
import type { RecurringTemplate } from '@shared/types'
import { RecurringForm } from '@/features/configuracion/recurring-form'
import { useCatalog } from '@/lib/catalog'
import { takePayload } from '@/lib/nav-payload'

export default function RecurrenteScreen() {
  const [template] = useState(() =>
    takePayload<RecurringTemplate | null>('/config/recurrente', null),
  )
  const { ready } = useCatalog()
  if (!ready) return null
  return <RecurringForm template={template} />
}
