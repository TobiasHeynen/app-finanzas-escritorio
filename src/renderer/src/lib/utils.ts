import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/**
 * Porcentajes enteros que siempre suman 100 (método del resto mayor), para que una leyenda no
 * muestre 101% por redondeo. Valores en cero o negativos dan 0.
 */
export function roundedPercentages(values: number[]): number[] {
  const total = values.reduce((a, v) => a + Math.max(0, v), 0)
  if (total === 0) return values.map(() => 0)
  const raw = values.map((v) => (Math.max(0, v) * 100) / total)
  const result = raw.map(Math.floor)
  let missing = 100 - result.reduce((a, v) => a + v, 0)
  const byRemainder = raw.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r)
  for (const { i } of byRemainder) {
    if (missing <= 0) break
    result[i] = (result[i] ?? 0) + 1
    missing--
  }
  return result
}
