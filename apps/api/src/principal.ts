// Sobe a API. `pnpm dev` na raiz chama isto junto com a tela.
// Sem DATABASE_URL, usa o banco embutido em apps/api/.banco-local, com usuários de exemplo.
import { fileURLToPath } from 'node:url'
import { abrirBanco } from './banco/conexao.ts'
import { criarServidor } from './servidor.ts'

const { banco } = await abrirBanco()

const app = criarServidor({
  logger: true,
  banco,
  pastaTela: fileURLToPath(new URL('../../web/dist', import.meta.url)),
  cookieSeguro: process.env.NODE_ENV === 'production',
})
await app.listen({ port: Number(process.env.PORTA ?? 3000), host: process.env.HOST ?? '127.0.0.1' })
