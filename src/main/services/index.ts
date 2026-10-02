import { createServices as createCoreServices, type Services as CoreServices } from '@core/services'
import type { ServiceContext } from '@core/services/context'
import type { Db } from '../db/connection'
import { createExportService, type ExportService } from './export'

/** Los services de core más los que sólo existen en la PC. */
export type Services = CoreServices<Db> & { exporter: ExportService }

export function createServices(ctx: ServiceContext<Db>): Services {
  return { ...createCoreServices(ctx), exporter: createExportService(ctx) }
}
