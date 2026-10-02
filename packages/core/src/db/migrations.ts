import { migrationFiles } from './migrations.generated'

export interface Migration {
  version: number
  name: string
  sql: string
}

// El SQL viaja como strings dentro del bundle (Vite en la PC, Metro en el celu): no hay archivos sueltos.
// Después de agregar o cambiar un .sql: node scripts/gen-migrations.mjs.
export const migrations: Migration[] = parseMigrationFiles(migrationFiles)

export function parseMigrationFiles(entries: Record<string, string>): Migration[] {
  const list = Object.entries(entries).map(([path, sql]) => {
    const match = /(\d{3})_([\w-]+)\.sql$/.exec(path)
    if (!match) throw new Error(`Nombre de migración inválido: ${path} (usar NNN_nombre.sql)`)
    return { version: Number(match[1]), name: match[2] ?? '', sql }
  })
  list.sort((a, b) => a.version - b.version)
  list.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`Falta la migración ${i + 1} (encontré ${m.version})`)
  })
  return list
}
