import { expect, type Page } from '@playwright/test'

/** Abre la app con una base nueva (cada test arranca de cero: la base web vive en OPFS del contexto). */
export async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Disponible')).toBeVisible()
}

export async function pickCategory(page: Page, search: string, name: string) {
  await page.getByRole('button', { name: 'Elegir categoría' }).click()
  await page.getByPlaceholder('Buscar').fill(search)
  await page.getByRole('radio', { name }).click()
}
