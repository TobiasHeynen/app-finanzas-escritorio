import * as React from 'react'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'

import { cn } from '@renderer/lib/utils'

function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn('inline-flex w-fit items-center rounded-md bg-muted p-[3px]', className)}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
