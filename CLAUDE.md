# Mis Finanzas

App de escritorio (Windows) para control de gastos personales: gastos, ingresos y ahorros mes a mes,
cuotas proyectadas, gastos recurrentes, tarjetas de crédito (el gasto cuenta en el mes en que se paga el
resumen), ahorro en ARS y USD con metas, reporte anual y exportación a Excel/CSV.
100% local: sin cuentas, sin login, sin backend remoto. UI en español rioplatense, formato es-AR.

Plan y decisiones aprobadas: ver "Decisiones de producto" abajo. Se trabaja por fases (0 a 8); al cerrar
cada una se corre lint + typecheck + tests y se espera el OK de Tobias antes de seguir.

## Comandos

| Comando                           | Qué hace                                                            |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                     | App en modo desarrollo (Vite + HMR)                                 |
| `npm run build`                   | Typecheck + build de producción en `out/`                           |
| `npm run preview`                 | Corre el build de producción                                        |
| `npm test`                        | Tests unitarios (Vitest **dentro del Node de Electron**, ver abajo) |
| `npm run test:watch`              | Tests en modo watch                                                 |
| `npm run typecheck`               | `tsc` sobre main/preload/shared y renderer                          |
| `npm run lint`                    | ESLint (typescript-eslint strict type-checked)                      |
| `npm run format` / `format:check` | Prettier (con orden de clases de Tailwind)                          |
| `npm run package`                 | Build + instalador NSIS para Windows x64 en `release/`              |

Antes de commitear: `npm run lint && npm run typecheck && npm test`.

## Stack

Electron 44 + electron-vite 5 (Vite 7) + electron-builder (NSIS). Renderer: React 19 + TypeScript strict +
Tailwind v4 + shadcn/ui (new-york) + lucide-react + Recharts. Datos en el renderer con TanStack Query.
Persistencia SQLite con better-sqlite3 sólo en main. zod 4 en todos los payloads IPC. date-fns (locale es).
exceljs para xlsx. Vitest + Playwright (e2e). ESLint + Prettier.

Dependencias aprobadas además del stack: react-router, react-hook-form + @hookform/resolvers, sonner,
@fontsource-variable/inter, y las de shadcn (radix-ui, class-variance-authority, clsx, tailwind-merge,
tw-animate-css, cmdk). **No agregar otras dependencias sin preguntar.**

shadcn: el registry (ui.shadcn.com) puede estar bloqueado por red en el entorno de desarrollo remoto; en ese
caso los componentes se escriben a mano en `src/renderer/src/components/ui/` copiando el estilo new-york v4.

## Arquitectura

```
src/
├─ main/                  proceso principal (Node)
│  ├─ index.ts            ciclo de vida, single instance
│  ├─ window.ts           BrowserWindow con webPreferences seguras
│  ├─ security.ts         permisos, navegación, window.open, origen confiable
│  ├─ ipc/
│  │  ├─ dispatch.ts      valida con zod → handler → IpcResult (puro, testeable)
│  │  ├─ register.ts      ipcMain.handle por canal + chequeo del frame emisor
│  │  └─ handlers.ts      mapa canal → handler (llama a services)
│  ├─ db/                 connection, migrations/NNN_*.sql, migrate, seed   (Fase 1)
│  ├─ repositories/       SQL plano con better-sqlite3                     (Fase 1)
│  └─ services/           reglas de negocio                                (Fase 1+)
├─ preload/index.ts       contextBridge: expone sólo window.api.invoke
├─ shared/                código común main/renderer
│  ├─ ipc/channels.ts     lista blanca de canales (SIN zod: lo usa el preload)
│  ├─ ipc/contract.ts     { canal: { input, output } } con zod: fuente de verdad
│  ├─ ipc/api.ts          tipo de window.api
│  ├─ ipc/result.ts       IpcResult<T> = { ok: true, data } | { ok: false, error }
│  ├─ errors.ts           AppError(code, message, fields?)
│  ├─ money.ts            (Fase 1)
│  └─ months.ts           (Fase 1)
└─ renderer/
   ├─ index.html          la CSP se inyecta desde electron.vite.config.ts
   └─ src/
      ├─ main.tsx
      ├─ app/             App, tema, globals.css (tokens de color)
      ├─ features/        una carpeta por pantalla
      ├─ components/ui/   shadcn
      └─ lib/             api.ts (call → tira ApiError), query-client, utils (cn)
```

### Cómo agregar un canal IPC

1. Agregar el nombre en `src/shared/ipc/channels.ts` (`dominio:accion`).
2. Agregar `{ input, output }` en `src/shared/ipc/contract.ts`. Inputs con `.strict()`.
3. Implementar el handler en `src/main/ipc/handlers.ts` (delegando en un service).
4. En el renderer: `call('dominio:accion', input)` dentro de un hook de TanStack Query en `lib/` o en la feature.
   El typecheck falla si falta el handler; un test verifica que la lista blanca coincida con el contrato.

Errores: los services tiran `AppError` con código (`VALIDATION`, `NOT_FOUND`, `CONFLICT`, ...). Cualquier otro
error se loguea en main y viaja como `INTERNAL` con mensaje genérico: nunca stack traces al renderer.

## Reglas de dinero (no negociables)

- Todos los montos son **INTEGER en la unidad mínima**: centavos de ARS o centavos de USD. Columnas `*_cents`
  o `*_minor`. **Prohibido float para dinero.**
- Cotizaciones: INTEGER, centavos de ARS por 1 USD (`rate_cents_per_usd`).
- Todo parseo de montos pasa por `src/shared/money.ts` (input argentino "1.234,56" → 123456). ESLint prohíbe
  `parseFloat` fuera de ese archivo. En zod, los montos son `z.number().int()`.
- Reparto de cuotas: si el total no divide exacto, el resto de centavos va en la **primera** cuota.
- Monto `NULL` = **pendiente**, distinto de $0. La UI lo muestra como "pendiente de cargar".
- Formateo con `Intl.NumberFormat('es-AR')`. Montos en pantalla con la clase `money` (cifras tabulares).

## Seguridad de Electron (no negociable)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`. Nada de `remote`.
- El preload se bundlea entero en CJS (con sandbox sólo puede hacer `require('electron')`) y expone sólo
  `window.api.invoke(canal, input)` con lista blanca. Nunca exponer `ipcRenderer` crudo.
- main valida cada payload con zod y verifica que el emisor sea el frame principal de nuestro renderer.
- CSP estricta por `<meta>`: en build `script-src 'self'` sin inline. En dev se agrega lo mínimo para HMR.
- Permisos del navegador denegados, `window.open` denegado (https va al navegador del sistema),
  `will-navigate` fuera de la app bloqueado, `<webview>` bloqueado.
- SQLite, filesystem y diálogos del sistema sólo en main.

## Datos

- DB en `app.getPath('userData')/finanzas.db`. WAL, `foreign_keys=ON`, `busy_timeout`.
- Migraciones versionadas `src/main/db/migrations/NNN_nombre.sql` + tabla `schema_migrations`, al iniciar.
- Meses como TEXT `YYYY-MM`, fechas como TEXT `YYYY-MM-DD`. Nunca `new Date('YYYY-MM-DD')` para lógica
  (UTC vs local): usar los helpers de `months.ts`.

## Tests

- Vitest corre con `ELECTRON_RUN_AS_NODE=1 electron vitest` (`scripts/run-vitest.mjs`): así better-sqlite3 se
  compila una sola vez para el ABI de Electron (lo hace `electron-builder install-app-deps` en `postinstall`)
  y sirve para la app y para los tests. No correr `npx vitest` directo.
- Obligatorios: money.ts, charge_month con tarjetas (cierre a fin de mes, cambio de año), reparto de cuotas,
  generación idempotente de recurrentes, disponible del mes, migraciones.
- Repositorios: SQLite en memoria con las migraciones reales.

## Decisiones de producto (aprobadas 2026-10-01)

- **charge_month con tarjeta**: compra con día <= `closing_day` entra en el resumen que cierra ese mes; si no,
  en el del mes siguiente. charge_month = mes de cierre **+ 1** (regla fija). `due_day` es opcional e
  informativo (suele vencer los primeros días del mes, default 5). `closing_day` 29-31 se clampea al último
  día del mes. Si el usuario corrige el charge_month a mano, queda bloqueado (`charge_month_locked`).
- **Cuotas**: sin interés en general; se carga el **total** y se reparte. Campo "voy por la cuota N" para
  cargar planes ya empezados (se generan sólo las cuotas N..total desde el mes actual). "Sólo futuras" =
  cuotas con `charge_month` > mes actual.
- **Recurrentes**: al iniciar se generan (persistidos) todos los meses faltantes desde `start_month` hasta el
  mes actual. Los meses futuros los muestran como **proyectados** (no se persisten). Si se borra un gasto
  generado, no se regenera.
- **Ingresos**: sólo ARS. `incomes.month` = mes en que se cobra (default: mes de la fecha, editable).
- **USD**: compra = aporte USD con `ars_cost_cents`; venta = retiro USD con ARS recibidos, que suman al
  disponible. Freelance en USD se carga como aporte de ahorro.
- **Borrado con deshacer**: soft delete (`deleted_at`) en gastos, ingresos y movimientos de ahorro.

## Convenciones de código

- TypeScript strict (con `noUncheckedIndexedAccess`). Sin `any`. `import type` para tipos.
- Identificadores y comentarios técnicos en inglés o español, pero consistente por archivo; **todo texto de
  UI en español rioplatense** (voseo: "Agregá", "Cargaste").
- Componentes React como funciones nombradas, una feature por carpeta en `features/`.
- SQL plano con prepared statements; nada de string-concat con datos del usuario.
- Prettier: sin `;`, comillas simples, 100 columnas.

## Commits

Conventional Commits en inglés, chicos y uno por unidad lógica:
`feat(expenses): add installment preview`, `fix(money): ...`, `test(...)`, `chore(...)`, `docs(...)`,
`refactor(...)`. Scope = área (`main`, `ipc`, `db`, `money`, `renderer`, nombre de feature).
