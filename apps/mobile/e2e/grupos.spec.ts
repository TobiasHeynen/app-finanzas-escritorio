import { expect, test } from '@playwright/test'
import { openApp, pickCategory } from './helpers'

test('armar un grupo y cargar un gasto eligiendo quién pagó', async ({ page }) => {
  await openApp(page)
  await page.getByRole('tab', { name: /Más/ }).click()
  await page.getByText('Grupos', { exact: true }).click()
  await expect(page.getByText('Todavía no armaste ningún grupo')).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo' }).click()
  await page.getByPlaceholder('Casa, Viaje a Bariloche…').fill('Casa')
  await page.getByLabel('Persona 1').fill('Tobi')
  await page.getByLabel('Persona 2').fill('Ana')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Grupo creado')).toBeVisible()
  await expect(page.getByText('Tobi, Ana')).toBeVisible()

  await page.getByRole('button', { name: 'Volver' }).click()
  await page.getByRole('tab', { name: /Inicio/ }).click()
  await page.getByRole('button', { name: 'Gasto' }).click()
  await page.keyboard.type('40000')
  await pickCategory(page, 'chino', 'Chino')
  await page.getByPlaceholder('Opcional').first().fill('Cena')
  await page.getByRole('radio', { name: 'Casa', exact: true }).click()
  await page.getByRole('radio', { name: 'Ana', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  const row = page.getByTestId('expense-row').filter({ hasText: 'Cena' })
  await expect(row).toContainText('Casa · pagó Ana')
})
