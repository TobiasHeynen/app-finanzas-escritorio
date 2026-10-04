import { expect, test, type Page } from '@playwright/test'
import { openApp, pickCategory } from './helpers'

async function createGroup(page: Page) {
  await page.getByRole('tab', { name: /Más/ }).click()
  await page.getByText('Grupos', { exact: true }).click()
  await expect(page.getByText('Todavía no armaste ningún grupo')).toBeVisible()

  await page.getByRole('button', { name: 'Crear un grupo' }).click()
  await page.getByPlaceholder('Casa, Viaje a Bariloche…').fill('Casa')
  await page.getByLabel('Persona 1').fill('Tobi')
  await page.getByLabel('Persona 2').fill('Ana')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Grupo creado')).toBeVisible()
  await expect(page.getByTestId('group-card')).toContainText('Todavía no hay gastos en el grupo.')
  await page.getByRole('button', { name: 'Volver' }).click()
}

test('armar un grupo y cargar un gasto eligiendo quién pagó', async ({ page }) => {
  await openApp(page)
  await createGroup(page)

  await page.getByRole('tab', { name: /Inicio/ }).click()
  await page.getByRole('button', { name: 'Gasto' }).click()
  await page.keyboard.type('40000')
  await pickCategory(page, 'chino', 'Chino')
  await page.getByPlaceholder('Opcional').first().fill('Cena')
  await page.getByRole('radio', { name: 'Casa', exact: true }).click()
  await page.getByRole('radio', { name: 'Ana', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Tobi' })).toContainText('$ 20.000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  const row = page.getByTestId('expense-row').filter({ hasText: 'Cena' })
  await expect(row).toContainText('Casa · pagó Ana')
})

test('repartir a mano, ver quién le debe a quién y saldar', async ({ page }) => {
  await openApp(page)
  await createGroup(page)

  await page.getByRole('tab', { name: /Inicio/ }).click()
  await page.getByRole('button', { name: 'Gasto' }).click()
  await page.keyboard.type('30000')
  await pickCategory(page, 'chino', 'Chino')
  await page.getByRole('radio', { name: 'Casa', exact: true }).click()
  await page.getByRole('radio', { name: 'A mano' }).click()
  await page.getByLabel('Parte de Tobi').fill('10.000')
  await expect(page.getByText('Faltan asignar $ 5.000')).toBeVisible()
  await page.getByLabel('Parte de Ana').fill('20.000')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Gasto guardado')).toBeVisible()

  await page.getByRole('tab', { name: /Más/ }).click()
  await page.getByText('Grupos', { exact: true }).click()
  const card = page.getByTestId('group-card')
  const transfer = card.getByTestId('group-transfer')
  await expect(transfer).toContainText('Ana')
  await expect(transfer).toContainText('Tobi')
  await expect(transfer).toContainText('$ 20.000')

  await transfer.getByRole('button', { name: 'Saldar' }).click()
  await expect(page.getByText('Saldar en Casa')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Pago registrado')).toBeVisible()
  await expect(card.getByText('Están a mano.')).toBeVisible()
  await expect(card.getByTestId('settlement')).toContainText('Ana le pasó a Tobi')

  await card.getByRole('button', { name: 'Borrar pago' }).click()
  await expect(card.getByTestId('group-transfer')).toContainText('$ 20.000')
})
