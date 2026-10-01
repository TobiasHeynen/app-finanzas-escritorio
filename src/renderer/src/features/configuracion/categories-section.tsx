import { useState } from 'react'
import { Archive, ArchiveRestore, Check, ChevronRight, Pencil, Plus, X } from 'lucide-react'
import type { Category, Subcategory } from '@shared/types'
import { CategoryIcon } from '@renderer/components/category-icon'
import { EmptyState } from '@renderer/components/page'
import { ReorderButtons } from '@renderer/components/reorder-buttons'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@renderer/components/ui/collapsible'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { useCategories } from '@renderer/lib/catalog'
import { keys, useApiMutation } from '@renderer/lib/hooks'
import { cn, moveItem } from '@renderer/lib/utils'
import { CategoryDialog } from './category-dialog'

export function CategoriesSection() {
  const { data: categories = [], isLoading } = useCategories()
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const reorder = useApiMutation('catalog:reorderCategories', { invalidate: [keys.categories] })
  const archive = useApiMutation('catalog:archiveCategory', {
    invalidate: [keys.categories],
    success: (c) => (c.archived ? `"${c.name}" archivada` : `"${c.name}" restaurada`),
  })

  const visible = categories.filter((c) => showArchived || !c.archived)

  const move = (from: number, to: number) => {
    const ordered = moveItem(visible, from, to)
    // Los archivados ocultos mantienen su lugar relativo al final.
    const hidden = categories.filter((c) => !visible.includes(c))
    reorder.mutate({ ids: [...ordered, ...hidden].map((c) => c.id) })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Categorías</h2>
          <p className="text-sm text-muted-foreground">
            Archivar no borra el histórico: lo archivado no aparece al cargar gastos, pero sí en
            reportes.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="show-archived" className="font-normal text-muted-foreground">
              Ver archivadas
            </Label>
          </div>
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus /> Categoría
          </Button>
        </div>
      </div>

      {!isLoading && visible.length === 0 ? (
        <EmptyState
          title="No hay categorías"
          description="Creá la primera para empezar a cargar gastos."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((category, index) => (
            <CategoryRow
              key={category.id}
              category={category}
              index={index}
              count={visible.length}
              showArchived={showArchived}
              onMove={move}
              onEdit={() => {
                setEditing(category)
                setDialogOpen(true)
              }}
              onArchive={() => archive.mutate({ id: category.id, archived: !category.archived })}
            />
          ))}
        </div>
      )}

      <CategoryDialog open={dialogOpen} onOpenChange={setDialogOpen} category={editing} />
    </section>
  )
}

function CategoryRow({
  category,
  index,
  count,
  showArchived,
  onMove,
  onEdit,
  onArchive,
}: {
  category: Category
  index: number
  count: number
  showArchived: boolean
  onMove: (from: number, to: number) => void
  onEdit: () => void
  onArchive: () => void
}) {
  const [open, setOpen] = useState(false)
  const subs = category.subcategories.filter((s) => showArchived || !s.archived)
  const activeSubs = category.subcategories.filter((s) => !s.archived)

  return (
    <Card className={cn('gap-0 py-0', category.archived && 'opacity-60')}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3 px-4 py-3">
          <ReorderButtons index={index} count={count} onMove={onMove} label={category.name} />
          <CollapsibleTrigger className="flex flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ChevronRight
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                open && 'rotate-90',
              )}
            />
            <CategoryIcon icon={category.icon} color={category.color} muted={category.archived} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-2 font-medium">
                {category.name}
                {category.archived && <Badge variant="secondary">Archivada</Badge>}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {activeSubs.length === 0
                  ? 'Sin subcategorías'
                  : activeSubs.map((s) => s.name).join(' · ')}
              </span>
            </div>
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            aria-label={`Editar ${category.name}`}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onArchive}
            aria-label={
              category.archived ? `Restaurar ${category.name}` : `Archivar ${category.name}`
            }
          >
            {category.archived ? <ArchiveRestore /> : <Archive />}
          </Button>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-1 border-t px-4 py-3 pl-16">
            {subs.map((sub, i) => (
              <SubcategoryRow
                key={sub.id}
                sub={sub}
                index={i}
                list={subs}
                allSubs={category.subcategories}
                categoryId={category.id}
              />
            ))}
            <AddSubcategory categoryId={category.id} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

function SubcategoryRow({
  sub,
  index,
  list,
  allSubs,
  categoryId,
}: {
  sub: Subcategory
  index: number
  list: Subcategory[]
  allSubs: Subcategory[]
  categoryId: number
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(sub.name)
  const rename = useApiMutation('catalog:renameSubcategory', {
    invalidate: [keys.categories],
    onSuccess: () => setEditing(false),
  })
  const archive = useApiMutation('catalog:archiveSubcategory', {
    invalidate: [keys.categories],
    success: (s) => (s.archived ? `"${s.name}" archivada` : `"${s.name}" restaurada`),
  })
  const reorder = useApiMutation('catalog:reorderSubcategories', { invalidate: [keys.categories] })

  const move = (from: number, to: number) => {
    const ordered = moveItem(list, from, to)
    const hidden = allSubs.filter((s) => !list.includes(s))
    reorder.mutate({ categoryId, ids: [...ordered, ...hidden].map((s) => s.id) })
  }

  return (
    <div className={cn('flex items-center gap-2', sub.archived && 'opacity-60')}>
      <ReorderButtons index={index} count={list.length} onMove={move} label={sub.name} />
      {editing ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) rename.mutate({ id: sub.id, name: name.trim() })
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={60}
            className="h-8"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setEditing(false)
                setName(sub.name)
              }
            }}
          />
          <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label="Guardar">
            <Check />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label="Cancelar"
            onClick={() => {
              setEditing(false)
              setName(sub.name)
            }}
          >
            <X />
          </Button>
        </form>
      ) : (
        <>
          <span className="flex flex-1 items-center gap-2 text-sm">
            {sub.name}
            {sub.archived && <Badge variant="secondary">Archivada</Badge>}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setEditing(true)}
            aria-label={`Renombrar ${sub.name}`}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => archive.mutate({ id: sub.id, archived: !sub.archived })}
            aria-label={sub.archived ? `Restaurar ${sub.name}` : `Archivar ${sub.name}`}
          >
            {sub.archived ? <ArchiveRestore /> : <Archive />}
          </Button>
        </>
      )}
    </div>
  )
}

function AddSubcategory({ categoryId }: { categoryId: number }) {
  const [name, setName] = useState('')
  const create = useApiMutation('catalog:createSubcategory', {
    invalidate: [keys.categories],
    success: (s) => `Subcategoría "${s.name}" creada`,
    onSuccess: () => setName(''),
  })
  return (
    <form
      className="mt-1 flex items-center gap-2 pl-7"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) create.mutate({ categoryId, name: name.trim() })
      }}
    >
      <Input
        placeholder="Nueva subcategoría"
        value={name}
        maxLength={60}
        className="h-8"
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={!name.trim() || create.isPending}
      >
        <Plus /> Agregar
      </Button>
    </form>
  )
}
