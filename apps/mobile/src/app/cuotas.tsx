import { useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { PlanForm } from '@/features/tarjetas/plan-form'
import { takePlanId } from '@/features/tarjetas/open-plan'
import { keys, useApiQuery } from '@/lib/hooks'
import { useColors } from '@/lib/theme'

export default function CuotasScreen() {
  const c = useColors()
  const [planId] = useState(takePlanId)
  const plan = useApiQuery('plans:get', { id: planId ?? 1 }, [...keys.plans, planId], {
    enabled: planId !== null,
  })
  if (planId === null) return <Redirect href="/" />
  if (!plan.data || plan.data.id !== planId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    )
  }
  return <PlanForm key={plan.data.id} plan={plan.data} />
}
