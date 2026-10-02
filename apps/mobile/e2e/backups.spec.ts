import { expect, test, type Page } from '@playwright/test'
import { openApp, pickCategory } from './helpers'

async function addExpense(page: Page, amount: string) {
  await page.getByRole('tab', { name: /Inicio/ }).click()
  await page.getByRole('button', { name: 'Gasto' }).click()
  await page.keyboard.type(amount)
  await pickCategory(page, 'verdu', 'Verdulería')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Gasto guardado').first()).toBeVisible()
}

async function openBackups(page: Page) {
  await page.getByRole('tab', { name: /Más/ }).click()
  await page.getByText('Backups y pasar datos').click()
}

test('hacer un backup, compartirlo y restaurarlo desde el archivo', async ({ page }) => {
  await openApp(page)
  await addExpense(page, '1000')
  await openBackups(page)
  await page.getByRole('button', { name: 'Hacer un backup ahora' }).click()
  await expect(page.getByTestId('backup-row')).toHaveCount(1)
  await expect(page.getByTestId('backup-row')).toContainText('Manual')

  await page.getByTestId('backup-row').click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Compartir' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^finanzas-\d{8}-\d{6}-manual\.db$/)
  const file = await download.path()

  await page.getByRole('button', { name: 'Volver' }).click()
  await addExpense(page, '2000')
  await expect(page.getByTestId('expense-row')).toHaveCount(2)

  await openBackups(page)
  await page.getByRole('button', { name: 'Restaurar desde un archivo' }).click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Elegir archivo' }).click(),
  ])
  await chooser.setFiles(file)
  await expect(page.getByText('Restaurando… la app se reinicia en un momento.')).toBeVisible()

  // Después del reinicio queda sólo el gasto que estaba en el backup.
  await expect(page.getByText('Disponible')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('expense-row')).toHaveCount(1)
  await expect(page.getByTestId('expense-row')).toContainText('$ 1.000')
})

test('un archivo que no es un backup se rechaza', async ({ page }) => {
  await openApp(page)
  await openBackups(page)
  await page.getByRole('button', { name: 'Restaurar desde un archivo' }).click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Elegir archivo' }).click(),
  ])
  await chooser.setFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(500, 7) })
  await expect(page.getByText(/no es un backup de Chanchito/)).toBeVisible()
})
