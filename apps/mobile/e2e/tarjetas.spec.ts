import { expect, test, type Page } from '@playwright/test'
import { openApp, pickCategory } from './helpers'

async function buyInInstallments(page: Page) {
  await page.getByRole('button', { name: 'Gasto' }).click()
  await page.keyboard.type('120000')
  await pickCategory(page, 'electro', 'Electrodomésticos')
  await page.getByPlaceholder('Opcional').first().fill('Heladera')
  await page.getByRole('radio', { name: 'VISA' }).click()
  await page.getByLabel('En cuotas').click()
  await page.getByRole('radio', { name: '6', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Compra en 6 cuotas guardada')).toBeVisible()
}

test('la compra en cuotas aparece en Tarjetas y se edita', async ({ page }) => {
  await openApp(page)
  await buyInInstallments(page)

  await page.getByRole('tab', { name: /Tarjetas/ }).click()
  const plan = page.getByTestId('plan-row')
  await expect(plan).toHaveCount(1)
  await expect(plan).toContainText('Heladera')
  await expect(plan).toContainText('0 de 6')
  await expect(page.getByTestId('committed-month').first()).toBeVisible()

  await plan.click()
  await expect(page.getByTestId('plan-installment')).toHaveCount(6)
  await page.getByLabel('Cantidad de cuotas').fill('12')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByRole('button', { name: 'Todas' }).click()
  await expect(page.getByText('Cuotas actualizadas')).toBeVisible()
  await expect(plan).toContainText('0 de 12')
})

test('borrar una compra en cuotas desde Tarjetas', async ({ page }) => {
  await openApp(page)
  await buyInInstallments(page)
  await page.getByRole('tab', { name: /Tarjetas/ }).click()
  await page.getByTestId('plan-row').click()
  await page.getByRole('button', { name: 'Borrar cuotas' }).click()
  await page.getByRole('button', { name: 'Todas' }).click()
  await expect(page.getByText('6 cuotas borradas')).toBeVisible()
  await expect(page.getByTestId('plan-row')).toHaveCount(0)
  await expect(page.getByText('Sin cuotas activas.').first()).toBeVisible()
})
