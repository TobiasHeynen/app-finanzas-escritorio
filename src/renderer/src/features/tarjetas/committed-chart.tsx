import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatMoney } from '@shared/money'
import { formatMonthShort } from '@shared/months'
import type { CardsOverview, PaymentMethod } from '@shared/types'

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
}

/** Barras apiladas: cuánto hay comprometido por tarjeta en cada uno de los próximos meses. */
export function CommittedChart({
  overview,
  methods,
}: {
  overview: CardsOverview
  methods: PaymentMethod[]
}) {
  const data = overview.committedByMonth.map((m) => {
    const row: Record<string, number | string> = { month: formatMonthShort(m.month) }
    for (const c of m.byCard) row[`c${String(c.paymentMethodId)}`] = c.totalCents
    return row
  })

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={80}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            tickFormatter={(v) => formatMoney(Number(v), 'ARS', { decimals: 'never' })}
          />
          <Tooltip
            cursor={{ fill: 'var(--accent)' }}
            contentStyle={tooltipStyle}
            formatter={(v, name) => [formatMoney(Number(v)), name]}
          />
          {methods.map((m, i) => (
            <Bar
              key={m.id}
              dataKey={`c${String(m.id)}`}
              name={m.name}
              stackId="cards"
              fill={m.color ?? '#64748b'}
              radius={i === methods.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
