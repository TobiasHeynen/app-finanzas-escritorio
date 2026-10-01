import { CATEGORY_ICONS } from '@renderer/lib/category-icons'
import { cn } from '@renderer/lib/utils'

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string
  color: string
  onChange: (icon: string) => void
}) {
  return (
    <div className="grid grid-cols-10 gap-1.5" role="radiogroup" aria-label="Ícono">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === name}
          aria-label={name}
          onClick={() => onChange(name)}
          className={cn(
            'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
            value === name && 'text-white',
          )}
          style={value === name ? { backgroundColor: color } : undefined}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
