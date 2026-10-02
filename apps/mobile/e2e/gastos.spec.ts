import { expect, test } from '@playwright/test'
import { openApp, pickCategory } from './helpers'

test('cargar un gasto, borrarlo y deshacer', async ({ page }) => {
  await openApp(page)
  await expect(page.getByText('Todavía no cargaste gastos este mes.')).toBeVisible()

  await page.getByRole('button', { name: 'Gasto' }).click()
  await page.keyboard.type('12500,50')
  await pickCategory(page, 'verdu', 'Verdulería')
  await page.getByPlaceholder('Opcional').first().fill('Compra del mes')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  const row = page.getByTestId('expense-row')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Compra del mes')
  await expect(row).toContainText('$ 12.500,50')
  await expect(page.getByTestId('tile-disponible')).toContainText('-$ 12.500,50')

  await row.click()
  await page.getByRole('button', { name: 'Borrar gasto' }).click()
  await expect(page.getByTestId('expense-row')).toHaveCount(0)
  await page.getByText('Deshacer').click()
  await expect(page.getByTestId('expense-row')).toHaveCount(1)
})

test('un gasto sin monto queda pendiente', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Gasto' }).click()
  await pickCategory(page, 'luz', 'Luz')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByTestId('expense-row')).toContainText('Pendiente')
  await expect(page.getByTestId('tile-pendientes')).toContainText('1 gasto pendiente de cargar')
})

test('compra en cuotas con tarjeta: se reparte y cae el mes que viene', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Gasto' }).click()
  await page.keyboard.type('100000')
  await pickCategory(page, 'electro', 'Electrodomésticos')
  await page.getByRole('radio', { name: 'VISA' }).click()
  await page.getByLabel('En cuotas').click()
  await expect(page.getByText(/1 cuota de \$\s33\.333,34 y 2 de \$\s33\.333,33/)).toBeVisible()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Compra en 3 cuotas guardada')).toBeVisible()

  // Con la tarjeta, la primera cuota cae en un mes posterior: buscarla avanzando.
  for (let i = 0; i < 2; i++) {
    if ((await page.getByTestId('expense-row').count()) > 0) break
    await page.getByRole('button', { name: 'Mes siguiente' }).click()
  }
  await expect(page.getByTestId('expense-row').first()).toContainText('1/3')
})
