import { existsSync } from 'node:fs'
import fastifyStatic from '@fastify/static'
import Fastify from 'fastify'
import { Saude } from '@ggv/contratos'

type Opcoes = {
  logger?: boolean
  /** Faz uma consulta simples no banco e rejeita se ele não responder. Sem isto, não há banco configurado. */
  consultarBanco?: () => Promise<unknown>
  /** Pasta da tela montada (`apps/web/dist`). Existindo, a API serve a tela na mesma URL (homologação, GGVP-119). */
  pastaTela?: string
}

/** Monta a API sem abrir porta, para o teste chamar as rotas com `inject`. */
export function criarServidor({ logger = false, consultarBanco, pastaTela }: Opcoes = {}) {
  const app = Fastify({ logger })

  app.get('/saude', async (_pedido, resposta): Promise<Saude> => {
    if (!consultarBanco) return Saude.parse({ ok: true, servico: 'api', banco: 'sem-banco' })
    try {
      await consultarBanco()
      return Saude.parse({ ok: true, servico: 'api', banco: 'ligado' })
    } catch {
      resposta.code(503) // o Coolify lê como deploy com falha e mantém a versão anterior no ar
      return Saude.parse({ ok: false, servico: 'api', banco: 'fora-do-ar' })
    }
  })

  if (pastaTela && existsSync(pastaTela)) {
    app.register(fastifyStatic, { root: pastaTela })
    // A tela decide a rota pelo endereço (App.tsx): qualquer caminho desconhecido devolve o index.html.
    app.setNotFoundHandler((pedido, resposta) =>
      pedido.method === 'GET' ? resposta.sendFile('index.html') : resposta.code(404).send(),
    )
  }

  return app
}
