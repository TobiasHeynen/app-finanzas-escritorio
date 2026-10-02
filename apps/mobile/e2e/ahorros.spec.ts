import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

test('aporte en pesos, compra de dólares y borrar con deshacer', async ({ page }) => {
  await openApp(page)
  await page.getByRole('tab', { name: /Ahorros/ }).click()

  await page.getByRole('button', { name: 'Movimiento' }).click()
  await page.keyboard.type('50000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Aporte guardado')).toBeVisible()
  await expect(page.getByTestId('savings-ars')).toContainText('$ 50.000')

  await page.getByTestId('savings-usd').click()
  await page.keyboard.type('100')
  await page.getByPlaceholder('1.250').fill('1250')
  await expect(page.getByText(/\$\s125\.000 a \$\s1\.250 por dólar/)).toBeVisible()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByTestId('savings-usd')).toContainText('USD 100')
  await expect(page.getByText(/Última cotización \$\s1\.250/)).toBeVisible()
  await expect(page.getByTestId('savings-row')).toHaveCount(2)

  await page.getByTestId('savings-row').filter({ hasText: 'Compra de dólares' }).click()
  await page.getByRole('button', { name: 'Borrar movimiento' }).click()
  await expect(page.getByTestId('savings-row')).toHaveCount(1)
  await page.getByText('Deshacer').click()
  await expect(page.getByTestId('savings-row')).toHaveCount(2)

  // Lo ahorrado sale del disponible del mes.
  await page.getByRole('tab', { name: /Inicio/ }).click()
  await expect(page.getByTestId('tile-disponible')).toContainText('-$ 175.000')
})

test('crear una meta y aportarle', async ({ page }) => {
  await openApp(page)
  await page.getByRole('tab', { name: /Ahorros/ }).click()
  await page.getByRole('button', { name: 'Nueva meta' }).first().click()
  await page.getByPlaceholder('Vacaciones, fondo de emergencia…').fill('Vacaciones')
  await page.getByRole('textbox').nth(1).fill('200000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Meta creada')).toBeVisible()

  const goal = page.getByTestId('goal-card')
  await expect(goal).toContainText('Vacaciones')
  await goal.click()
  await page.getByRole('button', { name: 'Aportar' }).click()
  await page.keyboard.type('50000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(goal).toContainText('$ 50.000')
  await expect(goal).toContainText('Faltan $ 150.000')
  await expect(page.getByTestId('savings-row')).toContainText('Vacaciones')
})
