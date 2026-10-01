import { app } from 'electron'
import { dbPath } from '../paths'
import type { Services } from '../services'
import type { IpcHandlers } from './dispatch'

const ok = { ok: true } as const

export function createHandlers(services: Services): IpcHandlers {
  const { repos, clock } = services.ctx
  return {
    'app:ping': ({ message }) => ({
      reply: `pong: ${message}`,
      receivedAt: new Date().toISOString(),
      versions: {
        app: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
      },
    }),
    'app:info': () => ({ version: app.getVersion(), dataPath: dbPath(), today: clock.today() }),

    // Catálogo
    'catalog:list': () => repos.catalog.listCategories(),
    'catalog:createCategory': (input) => repos.catalog.createCategory(input),
    'catalog:updateCategory': ({ id, ...input }) => repos.catalog.updateCategory(id, input),
    'catalog:archiveCategory': ({ id, archived }) =>
      repos.catalog.setCategoryArchived(id, archived),
    'catalog:reorderCategories': ({ ids }) => {
      repos.catalog.reorderCategories(ids)
      return ok
    },
    'catalog:createSubcategory': ({ categoryId, name }) =>
      repos.catalog.createSubcategory(categoryId, name),
    'catalog:renameSubcategory': ({ id, name }) => repos.catalog.renameSubcategory(id, name),
    'catalog:archiveSubcategory': ({ id, archived }) =>
      repos.catalog.setSubcategoryArchived(id, archived),
    'catalog:reorderSubcategories': ({ categoryId, ids }) => {
      repos.catalog.reorderSubcategories(categoryId, ids)
      return ok
    },

    // Medios de pago
    'paymentMethods:list': () => repos.paymentMethods.list(),
    'paymentMethods:create': (input) => repos.paymentMethods.create(input),
    'paymentMethods:update': ({ id, data }) => repos.paymentMethods.update(id, data),
    'paymentMethods:archive': ({ id, archived }) => repos.paymentMethods.setArchived(id, archived),
    'paymentMethods:reorder': ({ ids }) => {
      repos.paymentMethods.reorder(ids)
      return ok
    },

    // Mes
    'month:overview': ({ month }) => services.summary.overview(month),

    // Gastos
    'expenses:create': (input) => services.expenses.create(input),
    'expenses:update': ({ id, data }) => services.expenses.update(id, data),
    'expenses:setAmount': ({ id, amountCents }) => services.expenses.setAmount(id, amountCents),
    'expenses:duplicate': ({ id }) => services.expenses.duplicate(id),
    'expenses:remove': ({ id }) => ({ ids: services.expenses.remove(id) }),
    'expenses:restore': ({ ids }) => ({ restored: services.expenses.restore(ids) }),
    'expenses:search': (filter) => repos.expenses.search(filter),

    // Cuotas
    'plans:create': (input) => services.expenses.createPlan(input),
    'plans:get': ({ id }) => services.expenses.getPlan(id),
    'plans:update': ({ id, data, scope }) => services.expenses.updatePlan(id, data, scope),
    'plans:remove': ({ id, scope }) => ({ ids: services.expenses.removePlan(id, scope) }),

    // Recurrentes
    'recurring:list': () => services.recurring.list(),
    'recurring:create': (input) => services.recurring.create(input),
    'recurring:update': ({ id, data }) => services.recurring.update(id, data),
    'recurring:remove': ({ id }) => {
      services.recurring.remove(id)
      return ok
    },

    // Ingresos
    'incomes:list': ({ month }) => repos.incomes.listByMonth(month),
    'incomes:create': (input) => repos.incomes.insert(input),
    'incomes:update': ({ id, data }) => repos.incomes.update(id, data),
    'incomes:remove': ({ id }) => {
      repos.incomes.softDelete(id)
      return ok
    },
    'incomes:restore': ({ id }) => {
      repos.incomes.restore(id)
      return ok
    },
    'incomes:copyPreviousSalary': ({ month }) => services.incomes.copyPreviousSalary(month),
  }
}
