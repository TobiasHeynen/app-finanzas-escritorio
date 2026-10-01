import { createHashRouter } from 'react-router'
import { Layout } from './layout'
import { AhorrosPage } from '@renderer/features/ahorros/ahorros-page'
import { ConfiguracionPage } from '@renderer/features/configuracion/configuracion-page'
import { DashboardPage } from '@renderer/features/dashboard/dashboard-page'
import { ReportePage } from '@renderer/features/reporte/reporte-page'
import { MovimientosPage } from '@renderer/features/movimientos/movimientos-page'
import { TarjetasPage } from '@renderer/features/tarjetas/tarjetas-page'

// Hash router: funciona con file:// en la app empaquetada.
export const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'movimientos', element: <MovimientosPage /> },
      { path: 'tarjetas', element: <TarjetasPage /> },
      { path: 'ahorros', element: <AhorrosPage /> },
      { path: 'reporte', element: <ReportePage /> },
      { path: 'configuracion', element: <ConfiguracionPage /> },
    ],
  },
])
