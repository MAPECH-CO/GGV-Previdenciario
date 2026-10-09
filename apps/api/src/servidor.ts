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
import { registrarRotasAcervo } from './rotas/acervo.ts'
import { registrarRotasJuizo } from './rotas/juizo.ts'
import { registrarRotasRegras } from './rotas/regras.ts'
import { registrarRotasHistorico } from './rotas/historico.ts'
import { registrarRotasCofre } from './rotas/cofre.ts'
import { registrarRotasConfiguracao } from './rotas/configuracao.ts'
import { registrarRotasPericia } from './rotas/pericia.ts'
import { registrarRotasSetor } from './rotas/setor.ts'
import { criarTarefasPorArea } from './fluxo/tarefasPorArea.ts'
import { registrarRotasIa } from './rotas/ia.ts'
import { criarIa, type Ia } from './ia/ia.ts'
import { criarPreparo } from './ia/preparo.ts'
import { alimentarAcervo } from './ia/acervo.ts'
import { registrarRotasResultado } from './rotas/resultado.ts'
import { registrarRotasEstudo } from './rotas/estudo.ts'
import { registrarRotasRecurso } from './rotas/recurso.ts'
import { registrarRotasRecomendacaoPericia } from './rotas/recomendacao-pericia.ts'
import { registrarRotasGlossario } from './rotas/glossario.ts'
import { registrarRotasTranscricao } from './rotas/transcricao.ts'
import { registrarRotasRoteiros } from './rotas/roteiros.ts'
import { registrarRotasParecer } from './rotas/parecer.ts'
import { registrarRotasComplemento } from './rotas/complemento.ts'
import { registrarRotasDeficiencia } from './rotas/deficiencia.ts'
import { registrarRotasAcidente } from './rotas/acidente.ts'
import { registrarRotasCrianca } from './rotas/crianca.ts'
import { registrarRotasDocumentacaoMedica } from './rotas/documentacao-medica.ts'
import { fontesAtivas, type Fonte } from './vigilia/fontes.ts'
import { registrarSessao } from './sessao/rotas.ts'
import { registrarRotasRecepcao } from './rotas/recepcao.ts'
import { registrarRotasRecepcaoAgenda } from './rotas/recepcao-agenda.ts'
import { registrarRotasRecepcaoEntrevista } from './rotas/recepcao-entrevista.ts'
import { registrarRotasRecepcaoDecisoes } from './rotas/recepcao-decisoes.ts'
import { registrarRotasRecepcaoSegundaFicha } from './rotas/recepcao-segunda-ficha.ts'
import { registrarRotasRecepcaoContrato } from './rotas/recepcao-contrato.ts'
import { registrarRotasConversa } from './rotas/conversa.ts'
import { registrarRotasMensagens } from './rotas/mensagens.ts'
import { registrarRotasSeguranca } from './rotas/seguranca.ts'
import { registrarRotasImportacao } from './rotas/importacao.ts'
import { registrarRotasFeriados } from './rotas/feriados.ts'
import { registrarRotasProcesso } from './rotas/processo.ts'
import { registrarRotasBases } from './rotas/bases.ts'
import { registrarRotasFinanceiro } from './rotas/financeiro.ts'
import { registrarRotasChat } from './rotas/chat.ts'

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

declare module 'fastify' {
  interface FastifyInstance {
    /** Sugestão pronta (07/10): uma rodada do preparo das sugestões da IA. Sem banco, não faz nada. */
    prepararSugestoes: () => Promise<void>
    /** GGVP-141 (ADR-013): uma rodada do acervo que se alimenta sozinho. Sem banco ou sem a chave da IA, não faz nada. */
    alimentarAcervo: () => Promise<void>
  }
}

/** Monta a API sem abrir porta, para o teste chamar as rotas com `inject`. */
export function criarServidor({ logger = false, banco, consultarBanco, pastaTela, agora, cookieSeguro, cofre, armazenamento, fontes, ia }: Opcoes = {}) {
  const app = Fastify({ logger })
  let preparar = async () => {}
  app.decorate('prepararSugestoes', () => preparar())
  let alimentar = async () => {}
  app.decorate('alimentarAcervo', () => alimentar())
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
    const motorIa = ia ?? criarIa({ banco, agora })
    const preparo = criarPreparo(motorIa, (erro) => app.log.error({ erro }, 'preparo da sugestão da IA falhou'))
    preparar = preparo.rodar
    registrarRotasConferencia(app, { banco, agora, ia: motorIa, preparo })
    const arquivos = armazenamento ?? abrirArmazenamento()
    const cofreDoGov = cofre ?? criarCofre(chaveDoCofre())
    // GGVP-147: cada área registra as tarefas abertas dela; as tarefas do setor juntam todas.
    const tarefasPorArea = criarTarefasPorArea()
    registrarRotasInss(app, { banco, agora, cofre: cofreDoGov, armazenamento: arquivos, tarefasPorArea })
    registrarRotasVigilia(app, { banco, agora, armazenamento: arquivos })
    registrarRotasExigencia(app, { banco, agora, armazenamento: arquivos })
    registrarRotasPrestacao(app, { banco, agora })
    registrarRotasPublicacoes(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasVigiliaDiario(app, { banco, agora, fontes: fontes ?? fontesAtivas() })
    registrarRotasExigenciaJuiz(app, { banco, agora, armazenamento: arquivos, ia: motorIa, preparo })
    registrarRotasManifestacao(app, { banco, agora, armazenamento: arquivos })
    registrarRotasDocumentos(app, { banco, agora, armazenamento: arquivos })
    registrarRotasIndeferimento(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasPeticao(app, { banco, agora, armazenamento: arquivos, ia: motorIa, preparo })
    registrarRotasGestao(app, { banco, agora })
    registrarRotasAcervo(app, { banco, agora })
    registrarRotasJuizo(app, { banco, agora })
    registrarRotasRegras(app, { banco, agora })
    registrarRotasHistorico(app, { banco, agora })
    registrarRotasCofre(app, { banco, agora, cofre: cofreDoGov })
    registrarRotasConfiguracao(app, { banco, agora })
    registrarRotasIa(app, { banco, agora })
    registrarRotasResultado(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasEstudo(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasRecurso(app, { banco, agora })
    registrarRotasRecomendacaoPericia(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasRecepcao(app, { banco, agora, tarefasPorArea })
    registrarRotasRecepcaoAgenda(app, { banco, agora })
    registrarRotasRecepcaoEntrevista(app, { banco, agora, ia: motorIa, armazenamento: arquivos, preparo })
    registrarRotasRecepcaoDecisoes(app, { banco, agora })
    registrarRotasRecepcaoSegundaFicha(app, { banco, agora })
    registrarRotasRecepcaoContrato(app, { banco, agora })
    registrarRotasRoteiros(app, { banco, agora })
    registrarRotasParecer(app, { banco, agora, ia: motorIa, armazenamento: arquivos, preparo })
    registrarRotasComplemento(app, { banco, agora, ia: motorIa, armazenamento: arquivos })
    registrarRotasDeficiencia(app, { banco, agora })
    registrarRotasAcidente(app, { banco, agora })
    registrarRotasCrianca(app, { banco, agora })
    registrarRotasDocumentacaoMedica(app, { banco, agora, ia: motorIa, armazenamento: arquivos })
    registrarRotasConversa(app, { banco, agora, ia: motorIa, armazenamento: arquivos, preparo })
    registrarRotasMensagens(app, { banco, agora })
    registrarRotasSeguranca(app, { banco, agora })
    registrarRotasPericia(app, { banco, agora, armazenamento: arquivos, ia: motorIa, preparo, tarefasPorArea })
    registrarRotasSetor(app, { banco, agora, tarefasPorArea })
    registrarRotasImportacao(app, { banco, agora })
    registrarRotasFeriados(app, { banco, agora })
    registrarRotasGlossario(app, { banco, agora })
    registrarRotasTranscricao(app, { banco, agora, ia: motorIa })
    registrarRotasProcesso(app, { banco, agora })
    // GGVP-78: Clientes e Processos, as bases do topo.
    registrarRotasBases(app, { banco, agora })
    // GGVP-78: o painel Financeiro, das prestações de contas.
    registrarRotasFinanceiro(app, { banco, agora })
    // GGVP-142: o chat das Centrais e a aba Suporte pelo servidor.
    registrarRotasChat(app, { banco, agora, ia: motorIa })
    alimentar = async () => {
      if (!motorIa.ligada) return
      await alimentarAcervo(banco, motorIa).catch((erro) => app.log.error({ erro }, 'alimentar o acervo falhou'))
    }
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
