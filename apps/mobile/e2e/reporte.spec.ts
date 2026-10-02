import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { expect, test } from '@playwright/test'
import { openApp, pickCategory } from './helpers'

test('reporte anual y exportar a Excel y CSV', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Gasto' }).click()
  await page.keyboard.type('12500')
  await pickCategory(page, 'verdu', 'Verdulería')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByTestId('expense-row')).toHaveCount(1)

  await page.getByRole('tab', { name: /Más/ }).click()
  await page.getByText('Reporte anual').click()
  await expect(page.getByTestId('report-gastado')).toContainText('$ 12.500')
  const category = page.getByTestId('report-category')
  await expect(category).toHaveCount(1)
  await category.click()
  await expect(page.getByText('Verdulería', { exact: true }).last()).toBeVisible()

  await page.getByRole('button', { name: 'Exportar' }).click()
  const [xlsx] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Excel (.xlsx)' }).click(),
  ])
  expect(xlsx.suggestedFilename()).toMatch(/^chanchito-\d{4}\.xlsx$/)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(readFileSync(await xlsx.path()) as unknown as ArrayBuffer)
  expect(wb.worksheets.map((w) => w.name)).toEqual(['Resumen', 'Gastos', 'Ingresos', 'Ahorros'])
  expect(wb.getWorksheet('Gastos')?.getRow(2).getCell(8).value).toBe(12500)

  await page.getByRole('button', { name: 'Volver' }).click()
  await page.getByText('Exportar a Excel / CSV').click()
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'CSV de gastos' }).click(),
  ])
  expect(csv.suggestedFilename()).toMatch(/^chanchito-\d{4}-\d{2}\.csv$/)
  const text = readFileSync(await csv.path(), 'utf8')
  expect(text).toContain('Supermercado;Verdulería')
  expect(text).toContain(';12500,00;')
})
