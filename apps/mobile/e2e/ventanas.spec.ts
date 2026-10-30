import { expect, test } from '@playwright/test'
import { openApp } from './helpers'

// La base web (OPFS) la puede tener abierta una sola página: la última que se abre se queda con ella.
test('abrir la app en otra pestaña pausa la primera y "Usar acá" la retoma', async ({
  page,
  context,
}) => {
  await openApp(page)
  for (let i = 0; i < 3; i++) {
    await page.reload()
    await expect(page.getByText('Disponible')).toBeVisible()
  }

  const other = await context.newPage()
  await openApp(other)
  await expect(page.getByText('Chanchito está abierta en otra ventana')).toBeVisible()

  await page.getByRole('button', { name: 'Usar acá' }).click()
  await expect(page.getByText('Disponible')).toBeVisible()
  await expect(other.getByText('Chanchito está abierta en otra ventana')).toBeVisible()
})
