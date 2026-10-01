import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { CategoryIcon } from '@renderer/components/category-icon'
import { Button } from '@renderer/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useCatalog } from '@renderer/lib/catalog'
import { cn } from '@renderer/lib/utils'

/**
 * Combobox categoría → subcategoría con búsqueda. Sólo muestra lo activo, salvo la opción ya elegida
 * (para poder editar gastos viejos de subcategorías archivadas).
 */
export function SubcategoryPicker({
  value,
  onChange,
  id,
  invalid,
}: {
  value: number | null
  onChange: (subcategoryId: number) => void
  id?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const { categories, subcategoryById } = useCatalog()
  const selected = value !== null ? subcategoryById.get(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <CategoryIcon
                icon={selected.category.icon}
                color={selected.category.color}
                size="sm"
              />
              <span className="truncate">
                <span className="text-muted-foreground">{selected.category.name} › </span>
                {selected.name}
              </span>
            </span>
          ) : (
            'Elegí una categoría'
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue
              .normalize('NFD')
              .replace(/\p{Diacritic}/gu, '')
              .toLowerCase()
              .includes(
                search
                  .normalize('NFD')
                  .replace(/\p{Diacritic}/gu, '')
                  .toLowerCase(),
              )
              ? 1
              : 0
          }
        >
          <CommandInput placeholder="Buscar…" />
          <CommandList>
            <CommandEmpty>No hay coincidencias.</CommandEmpty>
            {categories
              .filter((c) => !c.archived || c.subcategories.some((s) => s.id === value))
              .map((c) => {
                const subs = c.subcategories.filter(
                  (s) => (!s.archived && !c.archived) || s.id === value,
                )
                if (subs.length === 0) return null
                return (
                  <CommandGroup key={c.id} heading={c.name}>
                    {subs.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={`${c.name} ${s.name} #${s.id}`}
                        onSelect={() => {
                          onChange(s.id)
                          setOpen(false)
                        }}
                      >
                        <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                        {s.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
