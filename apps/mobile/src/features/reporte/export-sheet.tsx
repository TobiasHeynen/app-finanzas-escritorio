import { ChoiceSheet } from '@/components/choice-sheet'
import { useExport } from '@/lib/export'

/** Elegir Excel o CSV para un mes ('YYYY-MM') o un año ('YYYY') y compartirlo. */
export function ExportSheet({
  open,
  onClose,
  scope,
  period,
}: {
  open: boolean
  onClose: () => void
  scope: 'month' | 'year'
  period: string
}) {
  const run = useExport()
  return (
    <ChoiceSheet
      open={open}
      onClose={onClose}
      title={scope === 'month' ? 'Exportar el mes' : `Exportar ${period}`}
      description="Se abre el menú de compartir: guardalo en Drive, mandalo por mail o a la PC."
      choices={[
        {
          label: 'Excel (.xlsx)',
          variant: 'primary',
          onPress: () => run.mutate({ scope, period, format: 'xlsx' }),
        },
        { label: 'CSV (gastos)', onPress: () => run.mutate({ scope, period, format: 'csv' }) },
      ]}
    />
  )
}
