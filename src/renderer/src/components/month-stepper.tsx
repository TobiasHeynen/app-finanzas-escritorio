import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, formatMonthTitle, type Month } from '@shared/months'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

/** Selector de mes "← Noviembre 2026 →". */
export function MonthStepper({
  value,
  onChange,
  size = 'default',
  className,
  min,
}: {
  value: Month
  onChange: (m: Month) => void
  size?: 'sm' | 'default' | 'lg'
  className?: string
  min?: Month
}) {
  const prev = addMonths(value, -1)
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={size === 'sm' ? 'size-7' : undefined}
        disabled={min !== undefined && prev < min}
        onClick={() => onChange(prev)}
        aria-label="Mes anterior"
      >
        <ChevronLeft />
      </Button>
      <span
        className={cn(
          'min-w-36 text-center font-semibold capitalize tabular-nums',
          size === 'sm' && 'min-w-28 text-sm font-medium',
          size === 'lg' && 'min-w-48 text-xl',
        )}
        aria-live="polite"
      >
        {formatMonthTitle(value)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={size === 'sm' ? 'size-7' : undefined}
        onClick={() => onChange(addMonths(value, 1))}
        aria-label="Mes siguiente"
      >
        <ChevronRight />
      </Button>
    </div>
  )
}
