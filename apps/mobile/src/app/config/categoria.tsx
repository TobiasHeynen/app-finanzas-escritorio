import { useState } from 'react'
import type { Category } from '@shared/types'
import { CategoryForm } from '@/features/configuracion/category-form'
import { takePayload } from '@/lib/nav-payload'

export default function CategoriaScreen() {
  const [category] = useState(() => takePayload<Category | null>('/config/categoria', null))
  return <CategoryForm category={category} />
}
