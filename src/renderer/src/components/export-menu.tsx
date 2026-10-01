import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useExport } from '@renderer/lib/export'

/** Botón "Exportar" con Excel y CSV para un mes ('YYYY-MM') o un año ('YYYY'). */
export function ExportMenu({ scope, period }: { scope: 'month' | 'year'; period: string }) {
  const run = useExport()
  const label = scope === 'month' ? 'Exportar el mes' : `Exportar ${period}`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={run.isPending}>
          <Download /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => run.mutate({ scope, period, format: 'xlsx' })}>
          <FileSpreadsheet /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run.mutate({ scope, period, format: 'csv' })}>
          <FileText /> CSV (gastos)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
