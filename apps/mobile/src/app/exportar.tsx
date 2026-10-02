import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { FileSpreadsheet, FileText } from 'lucide-react-native'
import { currentMonth, parseMonth, type Month } from '@shared/months'
import { MonthStepper } from '@/components/month-stepper'
import { Screen } from '@/components/screen'
import { Button, Card, Chip, Muted } from '@/components/ui'
import { YearStepper } from '@/components/year-stepper'
import { useExport } from '@/lib/export'
import { space, useColors } from '@/lib/theme'

export default function ExportarScreen() {
  const c = useColors()
  const [scope, setScope] = useState<'month' | 'year'>('month')
  const [month, setMonth] = useState<Month>(currentMonth)
  const [year, setYear] = useState(() => parseMonth(currentMonth()).year)
  const run = useExport()
  const period = scope === 'month' ? month : String(year)

  return (
    <Screen back title="Exportar">
      <Muted>
        Armá un Excel (resumen, gastos, ingresos y ahorros) o un CSV de gastos y compartilo: Drive,
        mail, WhatsApp o "Guardar en el dispositivo".
      </Muted>
      <Card style={{ gap: space(3) }}>
        <View style={styles.row}>
          <Chip label="Un mes" selected={scope === 'month'} onPress={() => setScope('month')} />
          <Chip label="Un año" selected={scope === 'year'} onPress={() => setScope('year')} />
        </View>
        <View style={{ alignItems: 'center' }}>
          {scope === 'month' ? (
            <MonthStepper value={month} onChange={setMonth} />
          ) : (
            <YearStepper value={year} onChange={setYear} />
          )}
        </View>
      </Card>
      <View style={{ gap: space(3) }}>
        <Button
          label="Excel (.xlsx)"
          icon={<FileSpreadsheet color={c.primaryForeground} size={18} />}
          loading={run.isPending && run.variables.format === 'xlsx'}
          disabled={run.isPending}
          onPress={() => run.mutate({ scope, period, format: 'xlsx' })}
        />
        <Button
          label="CSV de gastos"
          variant="outline"
          icon={<FileText color={c.foreground} size={18} />}
          loading={run.isPending && run.variables.format === 'csv'}
          disabled={run.isPending}
          onPress={() => run.mutate({ scope, period, format: 'csv' })}
        />
        <Text style={{ color: c.mutedForeground, fontSize: 12 }}>
          Los gastos pendientes de cargar no suman. El CSV usa ";" y coma decimal, para Excel en
          español.
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space(2) },
})
