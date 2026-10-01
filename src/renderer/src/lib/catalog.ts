import { useMemo } from 'react'
import type { Category, PaymentMethod, Subcategory } from '@shared/types'
import { keys, useApiQuery } from './hooks'

export function useCategories() {
  return useApiQuery('catalog:list', {}, keys.categories)
}

export function usePaymentMethods() {
  return useApiQuery('paymentMethods:list', {}, keys.paymentMethods)
}

export interface Catalog {
  categories: Category[]
  paymentMethods: PaymentMethod[]
  categoryById: Map<number, Category>
  subcategoryById: Map<number, Subcategory & { category: Category }>
  paymentMethodById: Map<number, PaymentMethod>
  ready: boolean
}

/** Catálogo con índices por id, para resolver nombres/íconos en listas. */
export function useCatalog(): Catalog {
  const categories = useCategories()
  const methods = usePaymentMethods()
  return useMemo(() => {
    const cats = categories.data ?? []
    const pms = methods.data ?? []
    const subcategoryById = new Map<number, Subcategory & { category: Category }>()
    for (const c of cats)
      for (const s of c.subcategories) subcategoryById.set(s.id, { ...s, category: c })
    return {
      categories: cats,
      paymentMethods: pms,
      categoryById: new Map(cats.map((c) => [c.id, c])),
      subcategoryById,
      paymentMethodById: new Map(pms.map((m) => [m.id, m])),
      ready: categories.isSuccess && methods.isSuccess,
    }
  }, [categories.data, methods.data, categories.isSuccess, methods.isSuccess])
}
