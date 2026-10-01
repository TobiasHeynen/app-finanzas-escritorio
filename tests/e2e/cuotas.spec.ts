import { expect, test } from './fixtures'

test('cargar una compra en cuotas con tarjeta y verla en Tarjetas', async ({ page }) => {
  await page.keyboard.press('Control+n')
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.locator('#expense-amount').fill('120.000')
  await dialog.locator('#expense-category').click()
  await page.getByPlaceholder('Buscar…').fill('Electro')
  await page.keyboard.press('Enter')
  await expect(dialog.locator('#expense-category')).toContainText('Electrodomésticos')

  await dialog.locator('#expense-method').click()
  await page.getByRole('option', { name: 'VISA' }).click()
  await dialog.locator('#expense-description').fill('Heladera')

  await dialog.locator('#expense-installments').click()
  await dialog.locator('#expense-count').fill('12')
  await expect(dialog).toContainText('12 cuotas de $ 10.000')

  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Compra en 12 cuotas guardada')).toBeVisible()
  await expect(dialog).toBeHidden()

  // La primera cuota cae en un resumen futuro: en Tarjetas aparece el plan y lo comprometido.
  await page.getByRole('link', { name: 'Tarjetas' }).click()
  const visa = page.locator('[data-testid^="card-"]', { hasText: 'VISA' })
  await expect(visa.getByText('Heladera')).toBeVisible()
  await expect(visa.getByText('0 de 12')).toBeVisible()
  await expect(visa).toContainText('Comprometido: $ 120.000')

  // Dos meses adelante ya hay una cuota de una compra de antes: va en su propio grupo.
  await page.getByRole('link', { name: 'Inicio' }).click()
  await page.getByRole('button', { name: 'Mes siguiente' }).first().click()
  await page.getByRole('button', { name: 'Mes siguiente' }).first().click()
  await expect(page.getByText('Comprado antes · tarjeta y cuotas')).toBeVisible()
  await expect(page.getByText('Heladera').first()).toBeVisible()
})
