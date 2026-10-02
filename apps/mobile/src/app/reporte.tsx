import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { ChartColumn, Download } from 'lucide-react-native'
import { currentMonth, parseMonth } from '@shared/months'
import type { YearReport } from '@shared/types'
import { EmptyState } from '@/components/empty-state'
import { Money } from '@/components/money'
import { Screen } from '@/components/screen'
import { Button, Card, Muted, SectionTitle } from '@/components/ui'
import { YearStepper } from '@/components/year-stepper'
import { CategoryList } from '@/features/reporte/category-list'
import { ExportSheet } from '@/features/reporte/export-sheet'
import { YearChart } from '@/features/reporte/year-chart'
import { keys, useApiQuery } from '@/lib/hooks'
import { radius, space, useColors } from '@/lib/theme'

export default function ReporteScreen() {
  const c = useColors()
  const [year, setYear] = useState(() => parseMonth(currentMonth()).year)
  const [exporting, setExporting] = useState(false)
  const { data, isLoading } = useApiQuery('report:year', { year }, [...keys.report, year])

  return (
    <Screen
      back
      title="Reporte anual"
      right={
        <Button
          variant="ghost"
          icon={<Download color={c.foreground} size={20} />}
          accessibilityLabel="Exportar"
          onPress={() => setExporting(true)}
        />
      }
    >
      <View style={styles.center}>
        <YearStepper value={year} onChange={setYear} />
      </View>
      {isLoading || !data ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: space(8) }} />
      ) : data.spent.totalCents === 0 && data.income.totalCents === 0 ? (
        <EmptyState
          icon={<ChartColumn color={c.mutedForeground} size={22} />}
          title={`No hay movimientos en ${String(year)}`}
          description={
            data.availableYears.length > 0
              ? `Tenés datos en ${data.availableYears.join(', ')}.`
              : undefined
          }
        />
      ) : (
        <>
          <Totals report={data} />
          <Card style={{ gap: space(3) }}>
            <Text style={[styles.cardTitle, { color: c.foreground }]}>
              Gastos por categoría e ingresos
            </Text>
            <YearChart report={data} />
          </Card>
          <View style={{ gap: space(2) }}>
            <SectionTitle>Por categoría</SectionTitle>
            <Card style={{ paddingHorizontal: space(2) }}>
              <CategoryList report={data} />
            </Card>
            {data.pendingCount > 0 ? (
              <Text style={{ color: c.pending, fontSize: 12 }}>
                {data.pendingCount}{' '}
                {data.pendingCount === 1
                  ? 'gasto pendiente de cargar no suma'
                  : 'gastos pendientes de cargar no suman'}{' '}
                en el reporte.
              </Text>
            ) : null}
          </View>
        </>
      )}
      <ExportSheet
        open={exporting}
        onClose={() => setExporting(false)}
        scope="year"
        period={String(year)}
      />
    </Screen>
  )
}

function Totals({ report }: { report: YearReport }) {
  const c = useColors()
  const tiles: { label: string; cents: number; color?: string; hint?: string; id: string }[] = [
    { id: 'ingresos', label: 'Ingresos', cents: report.income.totalCents, color: c.positive },
    { id: 'gastado', label: 'Gastado', cents: report.spent.totalCents, color: c.negative },
    { id: 'ahorrado', label: 'Ahorrado (neto)', cents: report.saved.totalCents },
    {
      id: 'disponible',
      label: 'Disponible acumulado',
      cents: report.available.totalCents,
      color: report.available.totalCents < 0 ? c.negative : c.positive,
    },
  ]
  return (
    <View style={{ gap: space(3) }}>
      <View style={styles.grid}>
        {tiles.map((t) => (
          <View
            key={t.id}
            testID={`report-${t.id}`}
            style={[styles.tile, { backgroundColor: c.card, borderColor: c.border }]}
          >
            <Muted style={{ fontSize: 13 }}>{t.label}</Muted>
            <Money
              cents={t.cents}
              decimals="never"
              style={[styles.amount, t.color ? { color: t.color } : null]}
            />
          </View>
        ))}
      </View>
      <View style={[styles.wide, { backgroundColor: c.card, borderColor: c.border }]}>
        <Muted style={{ fontSize: 13 }}>Gasto promedio por mes</Muted>
        <Money cents={report.spent.averageCents} decimals="never" style={styles.amount} />
        <Muted style={{ fontSize: 12 }}>
          Sobre {report.monthsWithData} {report.monthsWithData === 1 ? 'mes' : 'meses'} con
          movimientos
        </Muted>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space(3.5),
    gap: space(1),
  },
  wide: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space(3.5),
    gap: space(1),
  },
  amount: { fontSize: 19, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700' },
})
