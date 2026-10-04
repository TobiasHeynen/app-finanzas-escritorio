import { NavLink, Outlet } from 'react-router'
import {
  ArrowLeftRight,
  ChartColumnBig,
  CreditCard,
  House,
  PiggyBank,
  Settings,
  Users,
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import {
  ExpenseDialogProvider,
  QuickAddButton,
} from '@renderer/features/gastos/expense-dialog-provider'

const NAV = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/tarjetas', label: 'Tarjetas', icon: CreditCard },
  { to: '/ahorros', label: 'Ahorros', icon: PiggyBank },
  { to: '/grupos', label: 'Grupos', icon: Users },
  { to: '/reporte', label: 'Reporte', icon: ChartColumnBig },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

export function Layout() {
  return (
    <ExpenseDialogProvider>
      <div className="flex h-full">
        <aside className="flex w-60 shrink-0 flex-col gap-6 border-r bg-sidebar px-4 py-5">
          <div className="flex items-center gap-2.5 px-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <PiggyBank className="size-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Chanchito</span>
          </div>
          <QuickAddButton />
          <nav className="flex flex-col gap-1" aria-label="Secciones">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'bg-accent text-accent-foreground',
                  )
                }
              >
                <Icon className="size-4.5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </ExpenseDialogProvider>
  )
}
