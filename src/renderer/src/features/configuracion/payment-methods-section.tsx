import { useState } from 'react'
import { Archive, ArchiveRestore, Pencil, Plus } from 'lucide-react'
import { PaymentMethodIcon } from '@renderer/components/payment-method-icon'
import type { PaymentMethod } from '@shared/types'
import { PAYMENT_METHOD_TYPE_LABELS } from '@shared/types'
import { ReorderButtons } from '@renderer/components/reorder-buttons'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { Card } from '@renderer/components/ui/card'
import { Label } from '@renderer/components/ui/label'
import { Switch } from '@renderer/components/ui/switch'
import { usePaymentMethods } from '@renderer/lib/catalog'
import { keys, useApiMutation } from '@renderer/lib/hooks'
import { cn, moveItem } from '@renderer/lib/utils'
import { PaymentMethodDialog } from './payment-method-dialog'

export function PaymentMethodsSection() {
  const { data: methods = [] } = usePaymentMethods()
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<PaymentMethod | null>(null)
  const [open, setOpen] = useState(false)
  const reorder = useApiMutation('paymentMethods:reorder', { invalidate: [keys.paymentMethods] })
  const archive = useApiMutation('paymentMethods:archive', {
    invalidate: [keys.paymentMethods, keys.cards],
    success: (m) => (m.archived ? `"${m.name}" archivado` : `"${m.name}" restaurado`),
  })

  const visible = methods.filter((m) => showArchived || !m.archived)
  const move = (from: number, to: number) => {
    const ordered = moveItem(visible, from, to)
    const hidden = methods.filter((m) => !visible.includes(m))
    reorder.mutate({ ids: [...ordered, ...hidden].map((m) => m.id) })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Medios de pago</h2>
          <p className="text-sm text-muted-foreground">
            Las tarjetas no son categorías: el medio de pago es cómo pagaste.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="pm-archived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="pm-archived" className="font-normal text-muted-foreground">
              Ver archivados
            </Label>
          </div>
          <Button
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus /> Medio de pago
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        {visible.map((m, index) => (
          <Card
            key={m.id}
            className={cn('flex-row items-center gap-3 px-4 py-3', m.archived && 'opacity-60')}
          >
            <ReorderButtons index={index} count={visible.length} onMove={move} label={m.name} />
            <PaymentMethodIcon method={m} />
            <div className="flex flex-1 flex-col">
              <span className="flex items-center gap-2 font-medium">
                {m.name}
                {m.archived && <Badge variant="secondary">Archivado</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">
                {PAYMENT_METHOD_TYPE_LABELS[m.type]}
                {m.type === 'tarjeta_credito' &&
                  ` · cierra el ${m.closingDay ?? '?'}${m.dueDay ? ` · vence el ${m.dueDay}` : ''}`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${m.name}`}
              onClick={() => {
                setEditing(m)
                setOpen(true)
              }}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={m.archived ? `Restaurar ${m.name}` : `Archivar ${m.name}`}
              onClick={() => archive.mutate({ id: m.id, archived: !m.archived })}
            >
              {m.archived ? <ArchiveRestore /> : <Archive />}
            </Button>
          </Card>
        ))}
      </div>
      <PaymentMethodDialog open={open} onOpenChange={setOpen} method={editing} />
    </section>
  )
}
