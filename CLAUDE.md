# Chanchito

App de escritorio (Windows) para control de gastos personales: gastos, ingresos y ahorros mes a mes,
cuotas proyectadas, gastos recurrentes, tarjetas de crédito (el gasto cuenta en el mes en que se paga el
resumen), ahorro en ARS y USD con metas, reporte anual y exportación a Excel/CSV.
100% local: sin cuentas, sin login, sin backend remoto. UI en español rioplatense, formato es-AR.

Plan y decisiones aprobadas: ver "Decisiones de producto" abajo. Las fases 0 a 8 del plan original están
terminadas; los cambios nuevos van con lint + typecheck + tests (y e2e si tocan flujos de UI).

## Comandos

| Comando                           | Qué hace                                                            |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                     | App en modo desarrollo (Vite + HMR)                                 |
| `npm run build`                   | Typecheck + build de producción en `out/`                           |
| `npm run preview`                 | Corre el build de producción                                        |
| `npm test`                        | Tests unitarios (Vitest **dentro del Node de Electron**, ver abajo) |
| `npm run test:watch`              | Tests en modo watch                                                 |
| `npm run test:e2e`                | Build + E2E con Playwright sobre la app Electron (en Linux: xvfb)   |
| `npm run typecheck`               | `tsc` sobre main/preload/shared y renderer                          |
| `npm run lint`                    | ESLint (typescript-eslint strict type-checked)                      |
| `npm run format` / `format:check` | Prettier (con orden de clases de Tailwind)                          |
| `npm run package`                 | Build + instalador NSIS para Windows x64 en `release/` (en Windows) |
| `npm run package:store`           | Build + paquete appx para Microsoft Store (en Windows)              |

Antes de commitear: `npm run lint && npm run typecheck && npm test`.

`npm run test:core-expo` corre la misma suite con core hablando con SQLite a través del adaptador del celu.

## App para celular (`apps/mobile`)

Expo SDK 57 + React Native 0.86 + expo-router (pestañas de `expo-router/js-tabs`) + expo-sqlite (API
sincrónica). Estilos con `StyleSheet` y los tokens de `src/lib/theme.ts` (los mismos colores que la PC).
Tiene su propio `package.json`/`node_modules` (no hay workspaces): `npm ci` en la raíz **y** en `apps/mobile`.

- Core se usa tal cual: `src/lib/services.ts` abre `finanzas.db` con expo-sqlite, lo envuelve con
  `wrapSyncSqlite` (`packages/core/src/db/sync-adapter.ts`) y llama a `initDatabase` + `createServices`.
- La UI usa **los mismos canales que la PC**: `call(canal, input)` (`src/lib/api.ts`) pasa por el `dispatch` de
  core (zod) y los handlers de `packages/core/src/api/handlers.ts`, sin IPC. Mismos hooks (`useApiQuery`,
  `useApiMutation`, `keys`, `movementKeys`) que el renderer. Los canales de plataforma (backups, exportar) se
  suman con `addHandlers` (exportar: `src/lib/export.ts`, arma el archivo con core y lo comparte con
  expo-sharing; en web lo descarga).
- Estructura: `src/app/` rutas de expo-router (pestañas en `(tabs)/`, formularios como pantallas modales),
  `src/features/<pantalla>/`, `src/components/` (ui.tsx con Button/Card/Chip/TextField, Money, MoneyField,
  DateField con calendario propio, toaster con "Deshacer"), `src/lib/`.
- Las migraciones se leen de `packages/core/src/db/migrations.generated.ts` (Metro no tiene
  `import.meta.glob`): después de tocar un `.sql`, `node scripts/gen-migrations.mjs` (un test avisa).
- `metro.config.js` resuelve los imports de core desde el `node_modules` de la app, nunca desde la raíz.
- Comandos (en `apps/mobile`): `npm run lint`, `npm run typecheck`, `npx expo export --platform android`
  (verifica el bundle), `npm start`, `npm run test:e2e` (export web + Playwright en `e2e/`; en el entorno
  remoto, con `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`). El `postinstall` corrige un bug de expo-sqlite
  web (resultados de más de 255 bytes) que sólo afecta a la vista previa. Para agregar paquetes, la versión exacta sale de
  `node_modules/expo/bundledNativeModules.json` (`expo install` necesita la API de Expo, bloqueada en remoto).
- Vista previa web (sólo para desarrollo): `npx expo export --platform web` y servir `dist/` con
  `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`.
- CI (job `android`, ubuntu): `test:core-expo`, lint, typecheck, e2e web, `expo prebuild` + `gradlew assembleRelease`
  → artifact `chanchito-android-apk` (firmado con la clave de debug: sólo para probar).

## Stack

Electron 44 + electron-vite 5 (Vite 7) + electron-builder (NSIS). Renderer: React 19 + TypeScript strict +
Tailwind v4 + shadcn/ui (new-york) + lucide-react + Recharts. Datos en el renderer con TanStack Query.
Persistencia SQLite con better-sqlite3 sólo en main. zod 4 en todos los payloads IPC. date-fns (locale es).
exceljs para xlsx. Vitest + Playwright (e2e). ESLint + Prettier.

Dependencias aprobadas además del stack: react-router, react-hook-form + @hookform/resolvers (hoy sin uso), sonner,
@fontsource-variable/inter, y las de shadcn (radix-ui, class-variance-authority, clsx, tailwind-merge,
tw-animate-css, cmdk). **No agregar otras dependencias sin preguntar.**

shadcn: el registry (ui.shadcn.com) puede estar bloqueado por red en el entorno de desarrollo remoto; en ese
caso los componentes se escriben a mano en `src/renderer/src/components/ui/` copiando el estilo new-york v4.

## Arquitectura

```
packages/core/src/        lógica compartida PC/celu (alias @core y @shared). ESLint le prohíbe importar
│                         electron, better-sqlite3, exceljs, node:*, react-native o expo
├─ api/                   dispatch (valida con zod → handler → IpcResult) y handlers de core por canal
├─ db/                    sql.ts (interfaz SqlDb), migrations/NNN_*.sql, migrate, seed, init (migra+siembra+purga)
├─ repositories/          SQL plano sobre SqlDb
├─ services/              reglas de negocio: expenses, recurring, incomes, summary, cards, savings, report,
│                         export-data (datos/resumen/CSV de la exportación), export-file (xlsx del celu)
├─ xlsx/                  zip "store" + escritor de .xlsx propio, sin dependencias (lo usa el celu)
└─ shared/                código común (también lo usa el renderer)
   ├─ ipc/channels.ts     lista blanca de canales (SIN zod: lo usa el preload)
   ├─ ipc/contract.ts     { canal: { input, output } } con zod: fuente de verdad
   ├─ ipc/api.ts          tipo de window.api
   ├─ ipc/result.ts       IpcResult<T> = { ok: true, data } | { ok: false, error }
   ├─ errors.ts           AppError(code, message, fields?)
   ├─ money.ts            parseo/formato de montos, cuotas, conversiones USD (enteros)
   ├─ months.ts           meses 'YYYY-MM' y fechas 'YYYY-MM-DD' sin líos de huso horario
   ├─ domain/             charge_month y armado de cuotas
   └─ schemas.ts/types.ts zod de entidades e inputs y sus tipos
src/                      app de escritorio (Electron)
├─ main/                  proceso principal (Node)
│  ├─ index.ts            ciclo de vida, single instance
│  ├─ window.ts           BrowserWindow con webPreferences seguras
│  ├─ security.ts         permisos, navegación, window.open, origen confiable
│  ├─ ipc/
│  │  ├─ register.ts      ipcMain.handle por canal + chequeo del frame emisor
│  │  └─ handlers.ts      los de core + los de la PC (app, export, backups)
│  ├─ backups.ts          backup antes de migrar, acciones de backup/restaurar (diálogos, relaunch)
│  ├─ export-file.ts      diálogo "Guardar como" y escritura del xlsx/csv
│  ├─ db/                 connection (better-sqlite3 + PRAGMAs), bootstrap (abre + init de core),
│  │                      backup.ts (API de backup de SQLite, rotación, validación de archivos)
│  └─ services/           los de core + export (exceljs), que sólo existe en la PC
├─ preload/index.ts       contextBridge: expone sólo window.api.invoke
└─ renderer/
   ├─ index.html          la CSP se inyecta desde electron.vite.config.ts
   └─ src/
      ├─ main.tsx
      ├─ app/             App, tema, globals.css (tokens de color)
      ├─ features/        una carpeta por pantalla: dashboard, gastos, ingresos, movimientos,
      │                   tarjetas, ahorros, reporte, configuracion (incluye backups)
      ├─ components/ui/   shadcn
      └─ lib/             api.ts (call → tira ApiError), hooks (keys + useApiQuery/useApiMutation),
                          movements (deshacer), export, catalog, utils
```

### Cómo agregar un canal IPC

1. Agregar el nombre en `packages/core/src/shared/ipc/channels.ts` (`dominio:accion`).
2. Agregar `{ input, output }` en `packages/core/src/shared/ipc/contract.ts`. Inputs con `.strict()`.
3. Implementar el handler en `packages/core/src/api/handlers.ts` (delegando en un service), o en
   `src/main/ipc/handlers.ts` y en el celu si depende de la plataforma (`PlatformChannel`).
4. En el renderer: `call('dominio:accion', input)` dentro de un hook de TanStack Query en `lib/` o en la feature.
   El typecheck falla si falta el handler; un test verifica que la lista blanca coincida con el contrato.

Errores: los services tiran `AppError` con código (`VALIDATION`, `NOT_FOUND`, `CONFLICT`, ...). Cualquier otro
error se loguea en main y viaja como `INTERNAL` con mensaje genérico: nunca stack traces al renderer.

## Reglas de dinero (no negociables)

- Todos los montos son **INTEGER en la unidad mínima**: centavos de ARS o centavos de USD. Columnas `*_cents`
  o `*_minor`. **Prohibido float para dinero.**
- Cotizaciones: INTEGER, centavos de ARS por 1 USD (`rate_cents_per_usd`).
- Todo parseo de montos pasa por `packages/core/src/shared/money.ts` (input argentino "1.234,56" → 123456). ESLint prohíbe
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

- Vitest corre con `ELECTRON_RUN_AS_NODE=1 electron vitest` (`scripts/run-vitest.mjs`), así usa el mismo
  Node/ABI que la app. better-sqlite3 13 es N-API y trae prebuilds para todas las plataformas: no hay rebuild
  (`npmRebuild: false`). No correr `npx vitest` directo.
- Obligatorios: money.ts, charge_month con tarjetas (cierre a fin de mes, cambio de año), reparto de cuotas,
  generación idempotente de recurrentes, disponible del mes, migraciones. También hay de tarjetas, ahorros,
  reporte/exportación (se relee el xlsx con exceljs) y backups.
- Repositorios y services: SQLite en memoria con las migraciones reales (`tests/helpers/context.ts`, con un
  reloj fijo). Backups: archivos en un directorio temporal.
- E2E (`tests/e2e`, Playwright `_electron`): cada test abre la app con `--user-data-dir` temporal. Necesitan
  `out/` buildeado (`npm run test:e2e` lo hace).

## Backups y exportación

- Al iniciar: si hay migraciones pendientes sobre una base existente, backup `pre-migracion`; después de abrir,
  backup `inicio` (salvo base recién creada). Manual desde Configuración → Backups. Se guardan los últimos 15
  de cada tipo en `userData/backups` (`finanzas-AAAAMMDD-HHMMSS-<tipo>.db`), con `db.backup()`.
- Restaurar: valida el archivo (`integrity_check`, tablas, versión de schema ≤ la de la app), hace un backup
  `pre-restauracion`, cierra la base, reemplaza el archivo (borra `-wal`/`-shm`) y hace `app.relaunch()`.
  El renderer sólo manda el nombre del backup (validado por regex) o pide abrir el diálogo nativo.
- Nombre, rotación y validación de backups son de core (`@core/db/backup-rules`), así un backup de la PC se
  restaura en el celu y al revés. En el celu (`apps/mobile/src/lib/backups.ts`): el backup es la imagen de la base
  (`serializeSync`, marcada sin WAL) en `<documentos>/backups`; restaurar valida en memoria
  (`deserializeDatabaseSync`), copia con `backupDatabaseSync` sobre la base abierta y recarga la app. Se comparten
  con expo-sharing y se eligen con expo-document-picker.
- Exportar: xlsx (hojas Resumen, Gastos, Ingresos, Ahorros; montos numéricos con formato de moneda) y CSV de
  gastos (`;`, coma decimal, UTF-8 con BOM, para Excel en español). Los gastos pendientes no suman.
  Los datos, el resumen y el CSV salen de `@core/services/export-data`; la PC arma el xlsx con exceljs y el celu
  con el escritor de `packages/core/src/xlsx/` (exceljs no anda en React Native). Un test relee los dos con exceljs.

## Empaquetado y CI

- `electron-builder.yml`: NSIS x64 y appx (Microsoft Store). Ícono en `build/icon.ico` y logos de la Store
  en `build/appx/`; todo se regenera desde `build/icon.svg` y `build/glyph.svg` con
  `npx electron scripts/make-icon.mjs` (en Linux como root: `xvfb-run -a npx electron --no-sandbox ...`). Se excluyen del paquete los bundles de browser de exceljs, el fuente
  de SQLite y los binarios de otras plataformas.
- Sólo `better-sqlite3`, `date-fns`, `exceljs` y `zod` son `dependencies` (los usa main en runtime); todo lo
  del renderer va en `devDependencies` porque Vite lo bundlea.
- NSIS necesita Windows (o wine). `.github/workflows/build.yml` corre en `windows-latest`: lint, typecheck,
  tests, e2e, instalador NSIS (artifact `chanchito-instalador`) y paquete appx para la Store (artifact
  `chanchito-store`).
- El instalador no está firmado: Windows SmartScreen avisa la primera vez ("Más información" → "Ejecutar de
  todas formas"). Desinstalar no borra los datos.
- Microsoft Store: la identidad del paquete (`appx.identityName`, `publisher`, `publisherDisplayName`) sale de
  Partner Center y **no se cambia**. El appx va sin firmar; la Store lo firma. Política de privacidad y
  landing en `docs/` (GitHub Pages desde `main` /docs).
- La app se llamaba "Mis Finanzas": si existe `%APPDATA%\Mis Finanzas\finanzas.db` y no hay base en la
  carpeta nueva, `main/index.ts` sigue usando la vieja. Las claves de localStorage `mis-finanzas:*` quedan así.

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
