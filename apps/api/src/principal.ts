// Sobe a API. `pnpm dev` na raiz chama isto junto com a tela. Não precisa de banco para subir.
import { criarServidor } from './servidor.ts'

const app = criarServidor({ logger: true })
await app.listen({ port: Number(process.env.PORTA ?? 3000), host: process.env.HOST ?? '127.0.0.1' })
