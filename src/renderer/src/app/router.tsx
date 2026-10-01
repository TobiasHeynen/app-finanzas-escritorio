import { createHashRouter } from 'react-router'
import { Layout } from './layout'
import { ConfiguracionPage } from '@renderer/features/configuracion/configuracion-page'
import { DashboardPage } from '@renderer/features/dashboard/dashboard-page'
import { MovimientosPage } from '@renderer/features/movimientos/movimientos-page'
import { Page, PageHeader } from '@renderer/components/page'

function Placeholder({ title }: { title: string }) {
  return (
    <Page>
      <PageHeader title={title} description="Próximamente." />
    </Page>
  )
}

// Hash router: funciona con file:// en la app empaquetada.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'movimientos', element: <MovimientosPage /> },
      { path: 'tarjetas', element: <Placeholder title="Tarjetas" /> },
      { path: 'ahorros', element: <Placeholder title="Ahorros" /> },
      { path: 'reporte', element: <Placeholder title="Reporte" /> },
      { path: 'configuracion', element: <ConfiguracionPage /> },
    ],
  },
])
