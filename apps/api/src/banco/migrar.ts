// Aplica as migrações de apps/api/drizzle no banco do DATABASE_URL (vem do .env, GGVP-119).
import { fileURLToPath, pathToFileURL } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

export const pastaMigracoes = fileURLToPath(new URL('../../drizzle', import.meta.url))

// Só migra quando rodado direto (`pnpm db:migrar`); o teste importa a pasta sem conectar.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('Falta DATABASE_URL no .env da raiz do clone.')
    process.exit(1)
  }
  const db = drizzle(url)
  await migrate(db, { migrationsFolder: pastaMigracoes })
  await db.$client.end()
  console.log('Migrações aplicadas.')
}
