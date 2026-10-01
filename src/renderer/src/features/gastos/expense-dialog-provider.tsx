import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Expense } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { ExpenseDialog, type ExpenseDefaults } from './expense-dialog'
import { PlanDialog } from './plan-dialog'

interface ExpenseDialogApi {
  /** Abre el diálogo de carga rápida. */
  openNew: (defaults?: ExpenseDefaults) => void
  /** Edita un gasto; si es una cuota, abre la edición del plan. */
  openEdit: (expense: Expense) => void
  /** Abre la edición de un plan de cuotas. */
  openPlan: (planId: number) => void
}

const Ctx = createContext<ExpenseDialogApi | null>(null)

export function ExpenseDialogProvider({ children }: { children: React.ReactNode }) {
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [defaults, setDefaults] = useState<ExpenseDefaults | undefined>()
  const [planId, setPlanId] = useState<number | null>(null)

  const openNew = useCallback((d?: ExpenseDefaults) => {
    setEditing(null)
    setDefaults(d)
    setExpenseOpen(true)
  }, [])

  const openEdit = useCallback((expense: Expense) => {
    if (expense.installment) {
      setPlanId(expense.installment.planId)
      return
    }
    setEditing(expense)
    setDefaults(undefined)
    setExpenseOpen(true)
  }, [])

  // Atajo global Ctrl+N
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openNew()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openNew])

  const api = useMemo(() => ({ openNew, openEdit, openPlan: setPlanId }), [openNew, openEdit])

  return (
    <Ctx.Provider value={api}>
      {children}
      <ExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        expense={editing}
        defaults={defaults}
      />
      <PlanDialog planId={planId} onClose={() => setPlanId(null)} />
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useExpenseDialog(): ExpenseDialogApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useExpenseDialog fuera de ExpenseDialogProvider')
  return ctx
}

export function QuickAddButton() {
  const { openNew } = useExpenseDialog()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="lg" className="w-full justify-start shadow-sm" onClick={() => openNew()}>
          <Plus /> Gasto
          <kbd className="ml-auto rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-medium">
            Ctrl N
          </kbd>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">Cargar un gasto (Ctrl+N)</TooltipContent>
    </Tooltip>
  )
}
