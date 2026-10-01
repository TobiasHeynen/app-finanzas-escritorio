import { useState } from 'react'
import {
  BriefcaseBusiness,
  Copy,
  Gift,
  Laptop,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react'
import { formatDateShort, type Month } from '@shared/months'
import type { Income } from '@shared/types'
import { INCOME_TYPE_LABELS } from '@shared/types'
import { Money } from '@renderer/components/money'
import { Button } from '@renderer/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { call } from '@renderer/lib/api'
import { keys, movementKeys, useApiMutation, useApiQuery } from '@renderer/lib/hooks'
import { useUndoToast } from '@renderer/lib/movements'
import { toast } from 'sonner'
import { IncomeDialog } from './income-dialog'

const ICONS = { sueldo: BriefcaseBusiness, aguinaldo: Gift, freelance: Laptop, otro: Wallet }

export function IncomesCard({ month }: { month: Month }) {
  const { data: incomes = [] } = useApiQuery('incomes:list', { month }, [...keys.incomes, month])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const undoToast = useUndoToast()
  const remove = useApiMutation('incomes:remove', {
    invalidate: movementKeys,
    onSuccess: (_d, { id }) => undoToast('Ingreso borrado', () => call('incomes:restore', { id })),
  })
  const copy = useApiMutation('incomes:copyPreviousSalary', {
    invalidate: movementKeys,
    onSuccess: (income) => {
      if (income) toast.success('Copiamos el sueldo del mes anterior')
      else toast.info('No hay un sueldo anterior para copiar')
    },
  })
  const hasSalary = incomes.some((i) => i.type === 'sueldo')

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Ingresos del mes</CardTitle>
        <CardAction className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(null)
              setOpen(true)
            }}
          >
            <Plus /> Ingreso
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {incomes.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">
            Todavía no cargaste ingresos este mes.
          </p>
        )}
        {incomes.map((income) => {
          const Icon = ICONS[income.type]
          return (
            <div key={income.id} className="group flex items-center gap-3 rounded-lg py-1.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-positive/15 text-positive">
                <Icon className="size-4" />
              </span>
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col text-left"
                onClick={() => {
                  setEditing(income)
                  setOpen(true)
                }}
              >
                <span className="truncate text-sm font-medium">
                  {income.description || INCOME_TYPE_LABELS[income.type]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {INCOME_TYPE_LABELS[income.type]} · {formatDateShort(income.date)}
                </span>
              </button>
              <Money cents={income.amountCents} className="font-semibold text-positive" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Acciones"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setEditing(income)
                      setOpen(true)
                    }}
                  >
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => remove.mutate({ id: income.id })}
                  >
                    <Trash2 /> Borrar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
        {!hasSalary && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 self-start"
            disabled={copy.isPending}
            onClick={() => copy.mutate({ month })}
          >
            <Copy /> Copiar sueldo del mes anterior
          </Button>
        )}
      </CardContent>
      <IncomeDialog open={open} onOpenChange={setOpen} income={editing} month={month} />
    </Card>
  )
}
