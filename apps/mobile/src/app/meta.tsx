import { useState } from 'react'
import { GoalForm } from '@/features/ahorros/goal-form'
import { takeGoal } from '@/features/ahorros/open'

export default function MetaScreen() {
  const [goal] = useState(takeGoal)
  return <GoalForm goal={goal} />
}
