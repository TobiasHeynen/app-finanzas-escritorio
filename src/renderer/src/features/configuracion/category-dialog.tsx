import { useState } from 'react'
import type { Category } from '@shared/types'
import { CategoryIcon } from '@renderer/components/category-icon'
import { ColorPicker } from '@renderer/components/color-picker'
import { IconPicker } from '@renderer/components/icon-picker'
import { FieldError } from '@renderer/components/page'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { keys, useApiMutation } from '@renderer/lib/hooks'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
}

export function CategoryDialog({ open, onOpenChange, category }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <CategoryForm category={category} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

// El form se monta cada vez que se abre el diálogo: el estado inicial sale de las props.
function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? 'tag')
  const [color, setColor] = useState(category?.color ?? '#6366f1')
  const [error, setError] = useState<string>()

  const options = {
    invalidate: [keys.categories],
    toastErrors: false,
    onSuccess: onClose,
  }
  const create = useApiMutation('catalog:createCategory', {
    ...options,
    success: 'Categoría creada',
  })
  const update = useApiMutation('catalog:updateCategory', {
    ...options,
    success: 'Categoría guardada',
  })
  const pending = create.isPending || update.isPending

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Poné un nombre')
      return
    }
    const input = { name: name.trim(), icon, color }
    const onError = (err: Error) => setError(err.message)
    if (category) update.mutate({ id: category.id, ...input }, { onError })
    else create.mutate(input, { onError })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        <DialogDescription>La categoría es qué compraste (no cómo lo pagaste).</DialogDescription>
      </DialogHeader>
      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} size="lg" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="category-name">Nombre</Label>
          <Input
            id="category-name"
            autoFocus
            value={name}
            maxLength={60}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setName(e.target.value)
              setError(undefined)
            }}
          />
          <FieldError message={error} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Color</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Ícono</Label>
        <IconPicker value={icon} color={color} onChange={setIcon} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}
