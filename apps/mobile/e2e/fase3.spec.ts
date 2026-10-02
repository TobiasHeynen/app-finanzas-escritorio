import { expect, test } from '@playwright/test'
import { openApp, pickCategory } from './helpers'

test('cargar un sueldo y copiarlo al mes siguiente', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Ingreso', exact: true }).click()
  await page.getByText('Nuevo ingreso').waitFor()
  await page.keyboard.type('850000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByTestId('income-row')).toHaveCount(1)
  await expect(page.getByTestId('tile-disponible')).toContainText('$ 850.000')

  await page.getByRole('button', { name: 'Mes siguiente' }).click()
  await expect(page.getByTestId('income-row')).toHaveCount(0)
  await page.getByRole('button', { name: 'Copiar sueldo del mes anterior' }).click()
  await expect(page.getByTestId('income-row')).toHaveCount(1)
  await expect(page.getByTestId('income-row')).toContainText('$ 850.000')
})

test('buscar en movimientos', async ({ page }) => {
  await openApp(page)
  for (const [monto, busqueda, cat, detalle] of [
    ['3200', 'verdu', 'Verdulería', 'Feria del sábado'],
    ['15000', 'uber', 'Uber', 'Vuelta a casa'],
  ] as const) {
    await page.getByRole('button', { name: 'Gasto' }).click()
    await page.keyboard.type(monto)
    await pickCategory(page, busqueda, cat)
    await page.getByPlaceholder('Opcional').first().fill(detalle)
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText(detalle)).toBeVisible()
  }

  await page.getByRole('tab', { name: /Movimientos/ }).click()
  // Inicio sigue montado detrás: contar sólo las filas de Movimientos.
  const rows = page.getByTestId('movimientos-mes').getByTestId('expense-row')
  await expect(rows).toHaveCount(2)
  await page.getByPlaceholder('Detalle, nota o subcategoría').fill('feria')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Feria del sábado')
})

test('crear un gasto fijo y una tarjeta desde Más', async ({ page }) => {
  await openApp(page)
  await page.getByRole('tab', { name: /Más/ }).click()

  await page.getByText('Medios de pago y tarjetas').click()
  await page.getByRole('button', { name: 'Nuevo' }).click()
  await page
    .getByPlaceholder('Nombre')
    .or(page.getByRole('textbox').first())
    .first()
    .fill('Naranja X')
  await page.getByRole('radio', { name: 'Tarjeta de crédito' }).click()
  await page.getByPlaceholder('25').fill('20')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Naranja X')).toBeVisible()
  await page.getByRole('button', { name: 'Volver' }).click()

  await page.getByText('Gastos fijos').click()
  await page.getByRole('button', { name: 'Nuevo' }).click()
  await page.getByPlaceholder('Alquiler').fill('Internet')
  await pickCategory(page, 'internet', 'Internet')
  await page.getByPlaceholder('Vacío = pendiente').fill('25000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Internet Día 1/ })).toBeVisible()

  // El gasto fijo se genera en el mes actual.
  await page.getByRole('button', { name: 'Volver' }).click()
  await page.getByRole('tab', { name: /Inicio/ }).click()
  await expect(page.getByTestId('expense-row')).toContainText('Internet')
})
