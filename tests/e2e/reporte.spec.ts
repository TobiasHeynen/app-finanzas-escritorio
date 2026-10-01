import { expect, test } from './fixtures'

test('ver el reporte anual con categorías y subcategorías', async ({ page }) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${String(year)}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Datos de base por la API del preload (la carga por UI ya la cubre el otro test).
  const ok = await page.evaluate(
    async ({ year, month }) => {
      const api = (
        globalThis as unknown as {
          api: { invoke: (c: string, i: unknown) => Promise<{ ok: boolean; data: unknown }> }
        }
      ).api
      const cats = (await api.invoke('catalog:list', {})).data as {
        subcategories: { id: number; name: string }[]
      }[]
      const sub = (n: string) => cats.flatMap((c) => c.subcategories).find((s) => s.name === n)!.id
      const methods = (await api.invoke('paymentMethods:list', {})).data as {
        id: number
        name: string
      }[]
      const debito = methods.find((m) => m.name === 'Débito')!.id
      const results = await Promise.all([
        api.invoke('incomes:create', {
          month: `${String(year)}-01`,
          type: 'sueldo',
          description: 'Sueldo',
          amountCents: 150000000,
          date: `${String(year)}-01-01`,
        }),
        ...[
          ['Chino', `${String(year)}-01-10`, 4500000],
          ['Verdulería', `${String(year)}-01-12`, 1500000],
          ['Chino', `${month}-02`, 3000000],
          ['Gimnasio', `${month}-03`, 3500000],
        ].map(([s, date, amount]) =>
          api.invoke('expenses:create', {
            subcategoryId: sub(s as string),
            paymentMethodId: debito,
            description: s,
            purchaseDate: date,
            amountCents: amount,
            chargeMonthOverride: null,
            notes: null,
          }),
        ),
      ])
      return results.every((r) => r.ok)
    },
    { year, month },
  )
  expect(ok).toBe(true)

  await page.getByRole('link', { name: 'Reporte' }).click()
  await expect(page.getByRole('heading', { name: 'Reporte anual' })).toBeVisible()
  await expect(page.getByText(String(year), { exact: true })).toBeVisible()
  await expect(page.getByText('$ 125.000').first()).toBeVisible() // gastado en el año

  const table = page.locator('table')
  await expect(table.getByRole('button', { name: /Supermercado/ })).toBeVisible()
  await expect(table.getByText('Verdulería')).toBeHidden()
  await table.getByRole('button', { name: /Supermercado/ }).click()
  await expect(table.getByText('Verdulería')).toBeVisible()
  await expect(table.getByText('Chino')).toBeVisible()
  await expect(page.locator('.recharts-surface').first()).toBeVisible()
})
