import { useState } from 'react'
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { formatMonthLong } from '@shared/months'
import type { RecurringTemplate } from '@shared/types'
import { CategoryIcon } from '@renderer/components/category-icon'
import { Money } from '@renderer/components/money'
import { EmptyState } from '@renderer/components/page'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { useCatalog } from '@renderer/lib/catalog'
import { keys, movementKeys, useApiMutation, useApiQuery } from '@renderer/lib/hooks'
import { cn } from '@renderer/lib/utils'
import { RecurringDialog } from './recurring-dialog'

export function RecurringSection() {
  const { data: templates = [], isLoading } = useApiQuery('recurring:list', {}, keys.recurring)
  const { subcategoryById, paymentMethodById } = useCatalog()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RecurringTemplate | null>(null)
  const [deleting, setDeleting] = useState<RecurringTemplate | null>(null)
  const remove = useApiMutation('recurring:remove', {
    invalidate: [keys.recurring, ...movementKeys],
    success: 'Recurrente borrado',
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Gastos recurrentes</h2>
          <p className="text-sm text-muted-foreground">
            Gastos fijos que se cargan solos cada mes. En los meses futuros se ven como proyectados.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setOpen(true)
          }}
        >
          <Plus /> Recurrente
        </Button>
      </div>
      {!isLoading && templates.length === 0 ? (
        <EmptyState
          icon={<Repeat className="size-5" />}
          title="Todavía no tenés gastos recurrentes"
          description="Cargá el alquiler, las expensas o los servicios una vez y se generan solos."
        />
      ) : (
        <div className="grid gap-2">
          {templates.map((t) => {
            const sub = subcategoryById.get(t.subcategoryId)
            return (
              <Card
                key={t.id}
                className={cn('flex-row items-center gap-3 px-4 py-3', !t.active && 'opacity-60')}
              >
                {sub && <CategoryIcon icon={sub.category.icon} color={sub.category.color} />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    {t.description}
                    {!t.active && <Badge variant="secondary">Pausado</Badge>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Día {t.dayOfMonth} · desde {formatMonthLong(t.startMonth)}
                    {t.endMonth ? ` hasta ${formatMonthLong(t.endMonth)}` : ''} ·{' '}
                    {paymentMethodById.get(t.paymentMethodId)?.name}
                  </span>
                </div>
                <Money cents={t.defaultAmountCents} className="font-semibold" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar ${t.description}`}
                  onClick={() => {
                    setEditing(t)
                    setOpen(true)
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Borrar ${t.description}`}
                  onClick={() => setDeleting(t)}
                >
                  <Trash2 />
                </Button>
              </Card>
            )
          })}
        </div>
      )}
      <RecurringDialog open={open} onOpenChange={setOpen} template={editing} />
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar "{deleting?.description}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de generarse. Los gastos que ya se cargaron quedan como están. Si sólo querés
              pausarlo, editalo y desactivalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleting && remove.mutate({ id: deleting.id })}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
