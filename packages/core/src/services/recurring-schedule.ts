import { compareMonths, monthRange, type Month } from '@shared/months'

export interface TemplateWindow {
  startMonth: Month
  endMonth: Month | null
  active: boolean
}

/** ¿La plantilla corresponde a ese mes? */
export function templateAppliesTo(template: TemplateWindow, month: Month): boolean {
  if (!template.active) return false
  if (compareMonths(month, template.startMonth) < 0) return false
  if (template.endMonth !== null && compareMonths(month, template.endMonth) > 0) return false
  return true
}

/**
 * Meses que hay que generar (persistir) para una plantilla: desde start_month hasta el mes actual
 * (o end_month si es anterior), salteando los que ya fueron generados. Así, si no abriste la app un
 * mes, se completa ese mes también. Es idempotente: con los mismos `generated` devuelve lo mismo, y
 * después de generar devuelve vacío.
 */
export function monthsToGenerate(
  template: TemplateWindow,
  generated: ReadonlySet<Month>,
  currentMonth: Month,
): Month[] {
  if (!template.active) return []
  const end =
    template.endMonth !== null && compareMonths(template.endMonth, currentMonth) < 0
      ? template.endMonth
      : currentMonth
  return monthRange(template.startMonth, end).filter((m) => !generated.has(m))
}
