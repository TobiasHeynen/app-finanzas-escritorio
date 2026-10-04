import { useState } from 'react'
import { CheckCircle2, Circle, Trash2 } from 'lucide-react'
import { formatMoney } from '@shared/money'
import { compareMonths, formatMonthShort, monthOf, todayIso } from '@shared/months'
import type { ExpenseGroup, InstallmentPlan, PlanScope } from '@shared/types'
import { GroupFields } from '@renderer/components/group-fields'
import { Money } from '@renderer/components/money'
import { MoneyInput } from '@renderer/components/money-input'
import { FieldError } from '@renderer/components/page'
import { PaymentMethodSelect } from '@renderer/components/payment-method-select'
import { SubcategoryPicker } from '@renderer/components/subcategory-picker'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
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
import { Progress } from '@renderer/components/ui/progress'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { useCatalog } from '@renderer/lib/catalog'
import { keys, movementKeys, useApiMutation, useApiQuery } from '@renderer/lib/hooks'
import { useDeletePlan } from '@renderer/lib/movements'
import { cn } from '@renderer/lib/utils'

/** Detalle y edición de una compra en cuotas. */
export function PlanDialog({ planId, onClose }: { planId: number | null; onClose: () => void }) {
  const open = planId !== null
  const plan = useApiQuery('plans:get', { id: planId ?? 1 }, [...keys.plans, planId], {
    enabled: open,
  })
  const data = plan.data

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compra en cuotas</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.description || 'Sin detalle'} · ${formatMoney(data.totalCents)} en ${data.installmentsCount} cuotas`
              : 'Cargando…'}
          </DialogDescription>
        </DialogHeader>
        {data && data.id === planId ? (
          <PlanForm key={data.id} plan={data} onClose={onClose} />
        ) : (
          <Skeleton className="h-64" />
        )}
      </DialogContent>
    </Dialog>
  )
}

type Confirm = 'save' | 'delete' | null

function PlanForm({ plan, onClose }: { plan: InstallmentPlan; onClose: () => void }) {
  const { paymentMethods } = useCatalog()
  const [subcategoryId, setSubcategoryId] = useState<number | null>(plan.subcategoryId)
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(plan.paymentMethodId)
  const [description, setDescription] = useState(plan.description)
  const [total, setTotal] = useState<number | null>(plan.totalCents)
  const [totalValid, setTotalValid] = useState(true)
  const [count, setCount] = useState(String(plan.installmentsCount))
  const [group, setGroup] = useState<ExpenseGroup | null>(plan.group)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<Confirm>(null)

  const update = useApiMutation('plans:update', {
    invalidate: movementKeys,
    success: 'Cuotas actualizadas',
    toastErrors: false,
    onSuccess: onClose,
  })
  const remove = useDeletePlan()

  const current = monthOf(todayIso())
  const paid = plan.installments.filter((i) => compareMonths(i.month, current) <= 0)
  const future = plan.installments.filter((i) => compareMonths(i.month, current) > 0)
  const countNum = /^\d+$/.test(count) ? Number(count) : NaN
  const firstNumber = plan.installments[0]?.number ?? 1
  const paidCount = paid.at(-1)?.number ?? firstNumber - 1

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!totalValid || total === null || total <= 0) next['totalCents'] = 'Total inválido'
    if (!(countNum >= 2 && countNum <= 120)) next['installmentsCount'] = 'Entre 2 y 120'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = (scope: PlanScope) => {
    if (subcategoryId === null || paymentMethodId === null || total === null) return
    update.mutate(
      {
        id: plan.id,
        scope,
        data: {
          subcategoryId,
          paymentMethodId,
          description: description.trim(),
          totalCents: total,
          installmentsCount: countNum,
          notes: null,
          group,
        },
      },
      {
        onError: (err) => {
          setConfirm(null)
          setErrors({ _: err.message, ...err.fields })
        },
      },
    )
  }

  const del = (scope: PlanScope) => {
    remove.mutate({ id: plan.id, scope }, { onSuccess: onClose })
    setConfirm(null)
  }

  return (
    <>
      <form
        className="grid gap-6 md:grid-cols-[1fr_15rem]"
        onSubmit={(e) => {
          e.preventDefault()
          if (validate()) setConfirm('save')
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-category">Categoría</Label>
            <SubcategoryPicker
              id="plan-category"
              value={subcategoryId}
              onChange={setSubcategoryId}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-method">Medio de pago</Label>
            <PaymentMethodSelect
              id="plan-method"
              methods={paymentMethods}
              value={paymentMethodId}
              onChange={setPaymentMethodId}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-description">Detalle</Label>
            <Input
              id="plan-description"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-total">Total</Label>
              <MoneyInput
                id="plan-total"
                value={total}
                aria-invalid={Boolean(errors['totalCents'])}
                onValueChange={(c, v) => {
                  setTotal(c)
                  setTotalValid(v)
                }}
              />
              <FieldError message={errors['totalCents']} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-count">Cuotas</Label>
              <Input
                id="plan-count"
                inputMode="numeric"
                value={count}
                aria-invalid={Boolean(errors['installmentsCount'])}
                onChange={(e) => setCount(e.target.value)}
              />
              <FieldError message={errors['installmentsCount']} />
            </div>
            <GroupFields
              idPrefix="plan"
              value={group}
              onChange={setGroup}
              error={errors['group']}
            />
          </div>
          <FieldError message={errors['_']} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pagadas</span>
              <span className="font-medium tabular-nums">
                {paidCount} de {plan.installmentsCount}
              </span>
            </div>
            <Progress value={(paidCount / plan.installmentsCount) * 100} />
          </div>
          <ul className="flex max-h-64 flex-col gap-0.5 overflow-y-auto pr-1 text-sm">
            {plan.installments.map((i) => {
              const isPaid = compareMonths(i.month, current) <= 0
              return (
                <li
                  key={i.expenseId}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1',
                    i.month === current && 'bg-accent',
                  )}
                >
                  {isPaid ? (
                    <CheckCircle2 className="size-3.5 text-positive" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground" />
                  )}
                  <span className="w-10 tabular-nums">
                    {i.number}/{plan.installmentsCount}
                  </span>
                  <span className="flex-1 text-muted-foreground capitalize">
                    {formatMonthShort(i.month)}
                  </span>
                  <Money cents={i.amountCents} />
                </li>
              )
            })}
            {plan.installments.length === 0 && (
              <li className="text-muted-foreground">No quedan cuotas.</li>
            )}
          </ul>
        </div>

        <DialogFooter className="sm:justify-between md:col-span-2">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirm('delete')}
            disabled={plan.installments.length === 0}
          >
            <Trash2 /> Borrar
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending}>
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </form>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'delete'
                ? '¿Qué cuotas querés borrar?'
                : '¿A qué cuotas aplicás el cambio?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'delete'
                ? `Las futuras son las que vencen después de este mes (${future.length}). Si cancelaste la compra, borrá sólo las futuras.`
                : `Sólo las futuras: las ${paid.length} cuotas ya pagadas quedan igual y el resto del total se reparte entre las que faltan, hasta completar ${countNum} cuotas.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={confirm === 'delete' && future.length === 0}
              onClick={() => (confirm === 'delete' ? del('future') : save('future'))}
            >
              Sólo las futuras
            </Button>
            <Button
              variant={confirm === 'delete' ? 'destructive' : 'default'}
              onClick={() => (confirm === 'delete' ? del('all') : save('all'))}
            >
              Todas
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
