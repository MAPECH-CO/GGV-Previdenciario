// Sobe a API. `pnpm dev` na raiz chama isto junto com a tela.
// Sem DATABASE_URL, usa o banco embutido na memória, com usuários de exemplo (src/banco/exemplo.ts).
import { fileURLToPath } from 'node:url'
import { abrirBanco } from './banco/conexao.ts'
import { criarServidor } from './servidor.ts'
import { fontesAtivas } from './vigilia/fontes.ts'
import { ligarRelogio } from './vigilia/rodadas.ts'

const { banco } = await abrirBanco()

const app = criarServidor({
  logger: true,
  banco,
  pastaTela: fileURLToPath(new URL('../../web/dist', import.meta.url)),
  cookieSeguro: process.env.NODE_ENV === 'production',
})
// Vigília do diário: 3 rodadas por dia (GGVP-30, G13). Uma batida por minuto, só aqui (nunca nos testes).
ligarRelogio(banco, fontesAtivas())
await app.listen({ port: Number(process.env.PORTA ?? 3000), host: process.env.HOST ?? '127.0.0.1' })
