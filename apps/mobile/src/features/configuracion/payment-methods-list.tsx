import { useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'
import { Archive, ArchiveRestore, Plus } from 'lucide-react-native'
import type { PaymentMethod } from '@shared/types'
import { PAYMENT_METHOD_TYPE_LABELS } from '@shared/types'
import { PaymentMethodIcon } from '@/components/icons'
import { ListItem, moveItem, ReorderButtons } from '@/components/list-item'
import { Screen } from '@/components/screen'
import { Button, Muted } from '@/components/ui'
import { usePaymentMethods } from '@/lib/catalog'
import { keys, useApiMutation } from '@/lib/hooks'
import { openWith } from '@/lib/nav-payload'
import { space, useColors } from '@/lib/theme'

export function openPaymentMethod(method: PaymentMethod | null): void {
  openWith<PaymentMethod | null>('/config/medio', method)
}

export function PaymentMethodsList() {
  const c = useColors()
  const { data: methods = [] } = usePaymentMethods()
  const [showArchived, setShowArchived] = useState(false)
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
    <Screen
      back
      title="Medios de pago"
      right={
        <Button
          label="Nuevo"
          size="sm"
          icon={<Plus color={c.primaryForeground} size={16} />}
          onPress={() => openPaymentMethod(null)}
        />
      }
    >
      <Muted>
        Las tarjetas no son categorías: el medio de pago es cómo pagaste. Con tarjeta de crédito, el
        gasto cuenta en el mes en que pagás el resumen.
      </Muted>
      <View style={styles.switchRow}>
        <Text style={{ color: c.mutedForeground }}>Ver archivados</Text>
        <Switch
          accessibilityLabel="Ver archivados"
          value={showArchived}
          onValueChange={setShowArchived}
          trackColor={{ true: c.primary, false: c.border }}
          thumbColor="#ffffff"
        />
      </View>
      <View style={{ gap: space(2) }}>
        {visible.map((m, index) => (
          <ListItem
            key={m.id}
            muted={m.archived}
            chevron={false}
            icon={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
                <ReorderButtons index={index} count={visible.length} onMove={move} label={m.name} />
                <PaymentMethodIcon method={m} size={22} />
              </View>
            }
            title={m.archived ? `${m.name} (archivado)` : m.name}
            subtitle={`${PAYMENT_METHOD_TYPE_LABELS[m.type]}${
              m.type === 'tarjeta_credito'
                ? ` · cierra el ${String(m.closingDay ?? '?')}${m.dueDay ? ` · vence el ${String(m.dueDay)}` : ''}`
                : ''
            }`}
            onPress={() => openPaymentMethod(m)}
            right={
              <Button
                variant="ghost"
                size="sm"
                icon={
                  m.archived ? (
                    <ArchiveRestore color={c.mutedForeground} size={16} />
                  ) : (
                    <Archive color={c.mutedForeground} size={16} />
                  )
                }
                accessibilityLabel={m.archived ? `Restaurar ${m.name}` : `Archivar ${m.name}`}
                onPress={() => archive.mutate({ id: m.id, archived: !m.archived })}
              />
            }
          />
        ))}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
