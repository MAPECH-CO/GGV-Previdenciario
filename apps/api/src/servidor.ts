import Fastify from 'fastify'
import { Saude } from '@ggv/contratos'

/** Monta a API sem abrir porta, para o teste chamar as rotas com `inject`. */
export function criarServidor({ logger = false }: { logger?: boolean } = {}) {
  const app = Fastify({ logger })

  app.get('/saude', async (): Promise<Saude> => Saude.parse({ ok: true, servico: 'api' }))

  return app
}
