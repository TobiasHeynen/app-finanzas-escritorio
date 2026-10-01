import { Check } from 'lucide-react'
import { PALETTE } from '@renderer/lib/category-icons'
import { cn } from '@renderer/lib/utils'

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={cn(
            'flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring',
            value === color && 'ring-2 ring-foreground/60',
          )}
          style={{ backgroundColor: color }}
        >
          {value === color && <Check className="size-4 text-white" />}
        </button>
      ))}
    </div>
  )
}
