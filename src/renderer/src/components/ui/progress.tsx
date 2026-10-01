import * as React from 'react'
import { Progress as ProgressPrimitive } from 'radix-ui'

import { cn } from '@renderer/lib/utils'

function Progress({
  className,
  value,
  indicatorClassName,
  indicatorStyle,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string
  indicatorStyle?: React.CSSProperties
}) {
  const clamped = Math.min(100, Math.max(0, value ?? 0))
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/15', className)}
      value={clamped}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full w-full flex-1 bg-primary transition-all duration-500',
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - clamped}%)`, ...indicatorStyle }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
