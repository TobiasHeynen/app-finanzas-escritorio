import { View } from 'react-native'
import { Plus, Repeat } from 'lucide-react-native'
import { formatMonthLong } from '@shared/months'
import type { RecurringTemplate } from '@shared/types'
import { EmptyState } from '@/components/empty-state'
import { CategoryIcon } from '@/components/icons'
import { ListItem } from '@/components/list-item'
import { Money } from '@/components/money'
import { Screen } from '@/components/screen'
import { Button, Muted } from '@/components/ui'
import { useCatalog } from '@/lib/catalog'
import { keys, useApiQuery } from '@/lib/hooks'
import { openWith } from '@/lib/nav-payload'
import { space, useColors } from '@/lib/theme'

export function openRecurring(template: RecurringTemplate | null): void {
  openWith<RecurringTemplate | null>('/config/recurrente', template)
}

export function RecurringList() {
  const c = useColors()
  const { data: templates = [], isLoading } = useApiQuery('recurring:list', {}, keys.recurring)
  const { subcategoryById, paymentMethodById } = useCatalog()
  return (
    <Screen
      back
      title="Gastos fijos"
      right={
        <Button
          label="Nuevo"
          size="sm"
          icon={<Plus color={c.primaryForeground} size={16} />}
          onPress={() => openRecurring(null)}
        />
      }
    >
      <Muted>
        Se cargan solos cada mes. En los meses futuros se ven como proyectados. Sin monto, quedan
        pendientes para que los completes.
      </Muted>
      {!isLoading && templates.length === 0 ? (
        <EmptyState
          icon={<Repeat color={c.mutedForeground} size={22} />}
          title="Todavía no tenés gastos fijos"
          description="Cargá el alquiler, las expensas o los servicios una vez y se generan solos."
        />
      ) : (
        <View style={{ gap: space(2) }}>
          {templates.map((t) => {
            const sub = subcategoryById.get(t.subcategoryId)
            return (
              <ListItem
                key={t.id}
                muted={!t.active}
                icon={
                  sub ? <CategoryIcon icon={sub.category.icon} color={sub.category.color} /> : null
                }
                title={t.active ? t.description : `${t.description} (pausado)`}
                subtitle={`Día ${String(t.dayOfMonth)} · desde ${formatMonthLong(t.startMonth)}${
                  t.endMonth ? ` hasta ${formatMonthLong(t.endMonth)}` : ''
                } · ${paymentMethodById.get(t.paymentMethodId)?.name ?? ''}`}
                right={<Money cents={t.defaultAmountCents} style={{ fontWeight: '700' }} />}
                onPress={() => openRecurring(t)}
              />
            )
          })}
        </View>
      )}
    </Screen>
  )
}
