import { formatDayHeading, monthOf, type Month } from '@shared/months'
import type { Expense, ProjectedExpense } from '@shared/types'
import { sumCents } from '@shared/money'
import { Money } from '@renderer/components/money'
import { ExpenseRow, ProjectedRow } from './expense-row'

type Item =
  | { kind: 'expense'; date: string; expense: Expense }
  | { kind: 'projected'; date: string; item: ProjectedExpense }

const EARLIER = 'anteriores'

/**
 * Movimientos agrupados por día (más reciente primero), con subtotal por día.
 * Si se pasa `month`, lo comprado en meses anteriores que impacta en este (resúmenes de tarjeta y
 * cuotas) va en un grupo aparte al final.
 */
export function ExpenseList({
  expenses,
  projected = [],
  showChargeMonth,
  month,
}: {
  expenses: Expense[]
  projected?: ProjectedExpense[]
  showChargeMonth?: boolean
  month?: Month
}) {
  const items: Item[] = [
    ...expenses.map((expense) => ({
      kind: 'expense' as const,
      date: expense.purchaseDate,
      expense,
    })),
    ...projected.map((item) => ({ kind: 'projected' as const, date: item.date, item })),
  ]
  const groups = new Map<string, Item[]>()
  for (const item of items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))) {
    const key = month !== undefined && monthOf(item.date) < month ? EARLIER : item.date
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  // El grupo de meses anteriores va al final.
  const earlier = groups.get(EARLIER)
  if (earlier) {
    groups.delete(EARLIER)
    groups.set(EARLIER, earlier)
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([date, list]) => {
        const amounts = list.map((i) =>
          i.kind === 'expense' ? i.expense.amountCents : i.item.amountCents,
        )
        return (
          <section key={date} className="flex flex-col gap-1">
            <header className="flex items-center justify-between px-3 text-xs font-medium text-muted-foreground uppercase">
              <span>
                {date === EARLIER ? 'Comprado antes · tarjeta y cuotas' : formatDayHeading(date)}
              </span>
              {/* Sin subtotal si todo el grupo está pendiente: "$ 0" confunde. */}
              {amounts.some((a) => a !== null) && <Money cents={sumCents(amounts)} />}
            </header>
            {list.map((i) =>
              i.kind === 'expense' ? (
                <ExpenseRow
                  key={`e${i.expense.id}`}
                  expense={i.expense}
                  showChargeMonth={showChargeMonth}
                />
              ) : (
                <ProjectedRow key={`p${i.item.templateId}`} item={i.item} />
              ),
            )}
          </section>
        )
      })}
    </div>
  )
}
