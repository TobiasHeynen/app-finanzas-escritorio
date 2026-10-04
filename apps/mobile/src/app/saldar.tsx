import { useState } from 'react'
import { Redirect } from 'expo-router'
import { SettleForm } from '@/features/grupos/settle-form'
import { takeSettle } from '@/features/grupos/open'

export default function SaldarScreen() {
  const [draft] = useState(takeSettle)
  if (!draft) return <Redirect href="/grupos" />
  return <SettleForm draft={draft} />
}
