// Genera packages/core/src/db/migrations.generated.ts con el SQL de cada migración como string.
// Así las migraciones viajan dentro del bundle tanto con Vite (PC) como con Metro (celu).
// Uso: node scripts/gen-migrations.mjs (un test falla si el archivo quedó desactualizado).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '../packages/core/src/db')

export function renderMigrations() {
  const files = readdirSync(join(dir, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
  const entries = files
    .map((f) => {
      const sql = readFileSync(join(dir, 'migrations', f), 'utf8')
      return `  ${JSON.stringify(`./migrations/${f}`)}: ${JSON.stringify(sql)},`
    })
    .join('\n')
  return `// Generado por scripts/gen-migrations.mjs a partir de migrations/*.sql. No editar a mano.\nexport const migrationFiles: Record<string, string> = {\n${entries}\n}\n`
}

if (process.argv[1] === import.meta.filename) {
  writeFileSync(join(dir, 'migrations.generated.ts'), renderMigrations())
  console.log('packages/core/src/db/migrations.generated.ts actualizado')
}
