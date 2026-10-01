import { Tag } from 'lucide-react'
import { CATEGORY_ICONS } from '@renderer/lib/category-icons'
import { cn } from '@renderer/lib/utils'

interface CategoryIconProps {
  icon: string
  color: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  muted?: boolean
}

/** Ícono de categoría dentro de un círculo con el color de la categoría suavizado. */
export function CategoryIcon({ icon, color, size = 'md', className, muted }: CategoryIconProps) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag
  const box = { sm: 'size-7', md: 'size-9', lg: 'size-11' }[size]
  const glyph = { sm: 'size-3.5', md: 'size-4.5', lg: 'size-5.5' }[size]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        box,
        muted && 'opacity-50 grayscale',
        className,
      )}
      style={{ backgroundColor: `${color}22`, color }}
      aria-hidden
    >
      <Icon className={glyph} />
    </span>
  )
}
