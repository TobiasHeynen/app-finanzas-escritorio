import { useState } from 'react'
import type { Group } from '@shared/types'
import { GroupForm } from '@/features/configuracion/group-form'
import { takePayload } from '@/lib/nav-payload'

export default function GrupoScreen() {
  const [group] = useState(() => takePayload<Group | null>('/config/grupo', null))
  return <GroupForm group={group} />
}
