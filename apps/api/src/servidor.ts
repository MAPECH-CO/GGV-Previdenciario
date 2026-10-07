import { existsSync } from 'node:fs'
import fastifyStatic from '@fastify/static'
import { sql } from 'drizzle-orm'
import Fastify from 'fastify'
import { Saude } from '@ggv/contratos'
import { abrirArmazenamento, type Armazenamento } from './armazenamento.ts'
import type { Banco } from './banco/conexao.ts'
import { chaveDoCofre, criarCofre, type Cofre } from './cofre.ts'
import { registrarRotasConferencia } from './rotas/conferencia.ts'
import { registrarRotasInss } from './rotas/inss.ts'
import { registrarRotasVigilia } from './rotas/vigilia.ts'
import { registrarRotasExigencia } from './rotas/exigencia.ts'
import { registrarRotasPrestacao } from './rotas/prestacao.ts'
import { registrarRotasPublicacoes } from './rotas/publicacoes.ts'
import { registrarRotasVigiliaDiario } from './rotas/vigilia-diario.ts'
import { registrarRotasExigenciaJuiz } from './rotas/exigencia-juiz.ts'
import { registrarRotasManifestacao } from './rotas/manifestacao.ts'
import { registrarRotasDocumentos } from './rotas/documentos.ts'
import { registrarRotasIndeferimento } from './rotas/indeferimento.ts'
import { registrarRotasPeticao } from './rotas/peticao.ts'
import { registrarRotasGestao } from './rotas/gestao.ts'
import { registrarRotasRegras } from './rotas/regras.ts'
import { registrarRotasHistorico } from './rotas/historico.ts'
import { registrarRotasCofre } from './rotas/cofre.ts'
import { registrarRotasConfiguracao } from './rotas/configuracao.ts'
import { registrarRotasIa } from './rotas/ia.ts'
import { criarIa, type Ia } from './ia/ia.ts'
import { fontesAtivas, type Fonte } from './vigilia/fontes.ts'
import { registrarSessao } from './sessao/rotas.ts'

type Opcoes = {
  logger?: boolean
  /** Banco do portal. Com ele entram o login e a trava de toda rota /api (GGVP-117). */
  banco?: Banco
  /** Faz uma consulta simples no banco e rejeita se ele não responder. Padrão: `select 1` no `banco`. */
  consultarBanco?: () => Promise<unknown>
  /** Pasta da tela montada (`apps/web/dist`). Existindo, a API serve a tela na mesma URL (homologação, GGVP-119). */
  pastaTela?: string
  /** Relógio, para o teste controlar a trava e a expiração. */
  agora?: () => Date
  /** Cookie só por HTTPS (homologação). */
  cookieSeguro?: boolean
  /** Cofre do gov.br (G9). Padrão: chave do COFRE_CHAVE. */
  cofre?: Cofre
  /** Onde os arquivos ficam. Padrão: Supabase Storage com as variáveis, ou a pasta local. */
  armazenamento?: Armazenamento
  /** Fontes da vigília; padrão: as do ambiente (`FONTES_PUBLICACAO`). */
  fontes?: Fonte[]
  /** A IA (GGVP-106). Padrão: chaves do ambiente; sem chave, desligada. O teste passa uma IA com `fetch` falso. */
  ia?: Ia
}

/** Monta a API sem abrir porta, para o teste chamar as rotas com `inject`. */
export function criarServidor({ logger = false, banco, consultarBanco, pastaTela, agora, cookieSeguro, cofre, armazenamento, fontes, ia }: Opcoes = {}) {
  const app = Fastify({ logger })
  const consultar = consultarBanco ?? (banco && (() => banco.execute(sql`select 1`)))

  app.get('/saude', async (_pedido, resposta): Promise<Saude> => {
    if (!consultar) return Saude.parse({ ok: true, servico: 'api', banco: 'sem-banco' })
    try {
      await consultar()
      return Saude.parse({ ok: true, servico: 'api', banco: 'ligado' })
    } catch {
      resposta.code(503) // o deploy lê como falha e mantém a versão anterior no ar
      return Saude.parse({ ok: false, servico: 'api', banco: 'fora-do-ar' })
    }
  })

  if (banco) {
    registrarSessao(app, { banco, agora, cookieSeguro })
    registrarRotasConferencia(app, { banco, agora })
    const arquivos = armazenamento ?? abrirArmazenamento()
    const cofreDoGov = cofre ?? criarCofre(chaveDoCofre())
    registrarRotasInss(app, { banco, agora, cofre: cofreDoGov, armazenamento: arquivos })
    registrarRotasVigilia(app, { banco, agora, armazenamento: arquivos })
    registrarRotasExigencia(app, { banco, agora, armazenamento: arquivos })
    registrarRotasPrestacao(app, { banco, agora })
    registrarRotasPublicacoes(app, { banco, agora, ia: ia ?? criarIa({ banco, agora }) })
    registrarRotasVigiliaDiario(app, { banco, agora, fontes: fontes ?? fontesAtivas() })
    registrarRotasExigenciaJuiz(app, { banco, agora, armazenamento: arquivos })
    registrarRotasManifestacao(app, { banco, agora, armazenamento: arquivos })
    registrarRotasDocumentos(app, { banco, agora, armazenamento: arquivos })
    registrarRotasIndeferimento(app, { banco, agora })
    registrarRotasPeticao(app, { banco, agora, armazenamento: arquivos })
    registrarRotasGestao(app, { banco, agora })
    registrarRotasRegras(app, { banco, agora })
    registrarRotasHistorico(app, { banco, agora })
    registrarRotasCofre(app, { banco, agora, cofre: cofreDoGov })
    registrarRotasConfiguracao(app, { banco, agora })
    registrarRotasIa(app, { banco, agora })
  }

  if (pastaTela && existsSync(pastaTela)) {
    app.register(fastifyStatic, { root: pastaTela })
    // A tela decide a rota pelo endereço (App.tsx): caminho desconhecido devolve o index.html; /api desconhecida é 404.
    app.setNotFoundHandler((pedido, resposta) =>
      pedido.method === 'GET' && !pedido.url.startsWith('/api/')
        ? resposta.sendFile('index.html')
        : resposta.code(404).send({ erro: 'Não encontrado.' }),
    )
  }

  return app
}
