import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { CreditCard, Info } from 'lucide-react-native'
import { EmptyState } from '@/components/empty-state'
import { Money } from '@/components/money'
import { Screen } from '@/components/screen'
import { Button, Card, Muted } from '@/components/ui'
import { CardPanel } from '@/features/tarjetas/card-panel'
import { CommittedBars } from '@/features/tarjetas/committed-bars'
import { useCatalog } from '@/lib/catalog'
import { keys, useApiQuery } from '@/lib/hooks'
import { radius, space, useColors } from '@/lib/theme'

export default function TarjetasScreen() {
  const c = useColors()
  const { data, isLoading } = useApiQuery('cards:overview', {}, keys.cards)
  const { paymentMethodById } = useCatalog()

  const cards = (data?.cards ?? []).flatMap((card) => {
    const method = paymentMethodById.get(card.paymentMethodId)
    return method ? [{ overview: card, method }] : []
  })

  return (
    <Screen title="Tarjetas">
      <View
        style={[
          styles.notice,
          { backgroundColor: `${c.pending}1a`, borderColor: `${c.pending}4d` },
        ]}
      >
        <Info color={c.pending} size={16} />
        <Text style={{ color: c.foreground, flex: 1, fontSize: 14 }}>
          Los resúmenes suelen vencer los primeros días del mes:{' '}
          <Text style={{ fontWeight: '700' }}>pagalos antes del 5</Text> para no pagar intereses.
        </Text>
      </View>

      {isLoading || !data ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: space(8) }} />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<CreditCard color={c.mutedForeground} size={22} />}
          title="No tenés tarjetas de crédito cargadas"
          description="Agregalas en Más → Medios de pago y tarjetas, con su día de cierre."
          action={
            <Button
              label="Ir a medios de pago"
              variant="outline"
              onPress={() => router.push('/config/medios')}
            />
          }
        />
      ) : (
        <>
          {cards.map(({ overview, method }) => (
            <CardPanel key={method.id} overview={overview} method={method} />
          ))}
          <Card style={{ gap: space(3) }}>
            <View style={styles.between}>
              <View style={{ flex: 1, gap: space(1) }}>
                <Text style={[styles.title, { color: c.foreground }]}>Comprometido a futuro</Text>
                <Muted>
                  Cuotas y gastos ya cargados de los próximos 12 meses (sin contar este).
                </Muted>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Muted style={{ fontSize: 12 }}>Total</Muted>
                <Money cents={data.committedTotalCents} style={styles.total} />
              </View>
            </View>
            {data.committedTotalCents === 0 ? (
              <Muted style={{ textAlign: 'center', paddingVertical: space(4) }}>
                No hay nada comprometido para los próximos meses.
              </Muted>
            ) : (
              <CommittedBars overview={data} methods={cards.map((x) => x.method)} />
            )}
          </Card>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    gap: space(2),
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space(3),
  },
  between: { flexDirection: 'row', gap: space(3), alignItems: 'flex-end' },
  title: { fontSize: 16, fontWeight: '700' },
  total: { fontSize: 19, fontWeight: '700' },
})
