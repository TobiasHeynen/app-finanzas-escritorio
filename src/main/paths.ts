import { app } from 'electron'
import { join } from 'node:path'

export const dbPath = (): string => join(app.getPath('userData'), 'finanzas.db')
export const backupsDir = (): string => join(app.getPath('userData'), 'backups')
