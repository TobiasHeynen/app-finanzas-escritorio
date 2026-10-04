import { useState } from 'react'
import { Copy, MoreHorizontal, Pencil, Repeat, Trash2, Users } from 'lucide-react'
import type { Expense, ProjectedExpense } from '@shared/types'
import { CategoryIcon } from '@renderer/components/category-icon'
import { Money } from '@renderer/components/money'
import { MoneyInput } from '@renderer/components/money-input'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useCatalog } from '@renderer/lib/catalog'
import { groupLabel, useGroupsIndex } from '@renderer/lib/groups'
import { useDeleteExpense, useDuplicateExpense, useSetExpenseAmount } from '@renderer/lib/movements'
import { cn } from '@renderer/lib/utils'
import { useExpenseDialog } from './expense-dialog-provider'

export function ExpenseRow({
  expense,
  showChargeMonth,
}: {
  expense: Expense
  showChargeMonth?: boolean
}) {
  const { subcategoryById, paymentMethodById } = useCatalog()
  const { openEdit } = useExpenseDialog()
  const groups = useGroupsIndex()
  const inGroup = groupLabel(groups, expense.group)
  const remove = useDeleteExpense()
  const duplicate = useDuplicateExpense()
  const sub = subcategoryById.get(expense.subcategoryId)
  const method = paymentMethodById.get(expense.paymentMethodId)
  const pending = expense.amountCents === null

  return (
    <div
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50"
      data-testid="expense-row"
    >
      {sub && <CategoryIcon icon={sub.category.icon} color={sub.category.color} />}
      <button
        type="button"
        className="flex min-w-0 flex-1 flex-col text-left outline-none focus-visible:underline"
        onClick={() => openEdit(expense)}
      >
        <span className="flex items-center gap-2 truncate font-medium">
          <span className="truncate">{expense.description || sub?.name || 'Gasto'}</span>
          {expense.installment && (
            <Badge variant="secondary" className="tabular-nums">
              {expense.installment.number}/{expense.installment.count}
            </Badge>
          )}
          {expense.recurringTemplateId !== null && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Repeat className="size-3.5 text-muted-foreground" aria-label="Recurrente" />
              </TooltipTrigger>
              <TooltipContent>Gasto recurrente</TooltipContent>
            </Tooltip>
          )}
          {inGroup && (
            <Badge variant="outline" className="max-w-56 truncate font-normal">
              <Users /> {inGroup}
            </Badge>
          )}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {sub ? `${sub.category.name} › ${sub.name}` : ''}
          {method ? ` · ${method.name}` : ''}
          {showChargeMonth && expense.chargeMonthLocked && expense.recurringTemplateId === null
            ? ' · mes fijado a mano'
            : ''}
        </span>
      </button>
      {pending ? (
        <CompletePending expense={expense} />
      ) : (
        <Money cents={expense.amountCents} className="font-semibold" />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            aria-label="Acciones"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openEdit(expense)}>
            <Pencil /> {expense.installment ? 'Ver cuotas' : 'Editar'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => duplicate.mutate({ id: expense.id })}>
            <Copy /> Duplicar
          </DropdownMenuItem>
          {!expense.installment && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => remove.mutate({ id: expense.id })}
              >
                <Trash2 /> Borrar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** "Pendiente" → clic → input de monto y Enter. */
function CompletePending({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<number | null>(null)
  const [valid, setValid] = useState(true)
  const setAmount = useSetExpenseAmount()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-pending/40 text-pending hover:text-pending"
        >
          Pendiente · cargar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid || value === null) return
            setAmount.mutate(
              { id: expense.id, amountCents: value },
              { onSuccess: () => setOpen(false) },
            )
          }}
        >
          <p className="text-sm font-medium">¿Cuánto fue {expense.description || 'este gasto'}?</p>
          <MoneyInput
            autoFocus
            value={value}
            onValueChange={(c, v) => {
              setValue(c)
              setValid(v)
            }}
            aria-label="Monto"
          />
          <Button
            type="submit"
            size="sm"
            disabled={value === null || !valid || setAmount.isPending}
          >
            Guardar
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function ProjectedRow({ item }: { item: ProjectedExpense }) {
  const { subcategoryById, paymentMethodById } = useCatalog()
  const sub = subcategoryById.get(item.subcategoryId)
  const method = paymentMethodById.get(item.paymentMethodId)
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 opacity-60"
      data-testid="projected-row"
    >
      {sub && <CategoryIcon icon={sub.category.icon} color={sub.category.color} muted />}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 truncate font-medium">
          {item.description}
          <Badge variant="outline">Proyectado</Badge>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {sub ? `${sub.category.name} › ${sub.name}` : ''}
          {method ? ` · ${method.name}` : ''}
        </span>
      </div>
      <Money
        cents={item.amountCents}
        className={cn('font-semibold', item.amountCents === null && 'text-sm')}
      />
    </div>
  )
}
