import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatMoney } from '@shared/money'
import type { MonthSummary } from '@shared/types'
import { CategoryIcon } from '@renderer/components/category-icon'
import { Money } from '@renderer/components/money'
import { useCatalog } from '@renderer/lib/catalog'
import { cn, roundedPercentages } from '@renderer/lib/utils'

/** Dona de gastos por categoría. Clic en una porción (o en la leyenda) filtra la lista. */
export function CategoryDonut({
  summary,
  selected,
  onSelect,
}: {
  summary: MonthSummary
  selected: number | null
  onSelect: (categoryId: number | null) => void
}) {
  const { categoryById } = useCatalog()
  const data = summary.byCategory
    .filter((c) => c.amountCents > 0)
    .map((c) => {
      const cat = categoryById.get(c.categoryId)
      return {
        id: c.categoryId,
        name: cat?.name ?? '—',
        icon: cat?.icon ?? 'tag',
        color: cat?.color ?? '#64748b',
        value: c.amountCents,
      }
    })
    // Recharts toma el color de cada porción del campo `fill`.
    .map((d) => ({
      ...d,
      fill: selected === null || selected === d.id ? d.color : `${d.color}40`,
    }))
  const total = data.reduce((a, d) => a + d.value, 0)
  const percents = roundedPercentages(data.map((d) => d.value))

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Sin gastos con monto este mes.
      </p>
    )
  }

  const toggle = (id: number) => onSelect(selected === id ? null : id)

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive
              animationDuration={500}
              onClick={(_d, index) => {
                const item = data[index]
                if (item) toggle(item.id)
              }}
              className="cursor-pointer outline-none"
            />
            <Tooltip
              formatter={(v) => formatMoney(Number(v))}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--popover-foreground)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">
            {selected !== null ? categoryById.get(selected)?.name : 'Total'}
          </span>
          <Money
            cents={selected !== null ? (data.find((d) => d.id === selected)?.value ?? 0) : total}
            decimals="never"
            className="text-lg font-semibold"
          />
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {data.map((d, i) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => toggle(d.id)}
              aria-pressed={selected === d.id}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                selected !== null && selected !== d.id && 'opacity-50',
                selected === d.id && 'bg-accent',
              )}
            >
              <CategoryIcon icon={d.icon} color={d.color} size="sm" />
              <span className="flex-1 truncate text-left">{d.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {percents[i]}%
              </span>
              <Money cents={d.value} decimals="never" className="w-24 text-right" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
