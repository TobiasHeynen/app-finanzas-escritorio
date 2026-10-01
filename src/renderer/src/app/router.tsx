import { createHashRouter } from 'react-router'
import { Layout } from './layout'
import { AhorrosPage } from '@renderer/features/ahorros/ahorros-page'
import { ConfiguracionPage } from '@renderer/features/configuracion/configuracion-page'
import { DashboardPage } from '@renderer/features/dashboard/dashboard-page'
import { MovimientosPage } from '@renderer/features/movimientos/movimientos-page'
import { TarjetasPage } from '@renderer/features/tarjetas/tarjetas-page'
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
      { path: 'tarjetas', element: <TarjetasPage /> },
      { path: 'ahorros', element: <AhorrosPage /> },
      { path: 'reporte', element: <Placeholder title="Reporte" /> },
      { path: 'configuracion', element: <ConfiguracionPage /> },
    ],
  },
])
