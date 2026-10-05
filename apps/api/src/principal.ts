// Sobe a API. `pnpm dev` na raiz chama isto junto com a tela. Sem DATABASE_URL, sobe sem banco.
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { criarServidor } from './servidor.ts'

const url = process.env.DATABASE_URL
const banco = url ? new pg.Pool({ connectionString: url, max: 5 }) : undefined

const app = criarServidor({
  logger: true,
  consultarBanco: banco && (() => banco.query('select 1')),
  pastaTela: fileURLToPath(new URL('../../web/dist', import.meta.url)),
})
await app.listen({ port: Number(process.env.PORTA ?? 3000), host: process.env.HOST ?? '127.0.0.1' })
