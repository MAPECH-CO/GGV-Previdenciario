import { existsSync } from 'node:fs'
import fastifyStatic from '@fastify/static'
import { sql } from 'drizzle-orm'
import Fastify, { type FastifyError } from 'fastify'
import { Saude } from '@ggv/contratos'
import { abrirArmazenamento, type Armazenamento } from './armazenamento.ts'
import type { Banco } from './banco/conexao.ts'
import { chaveDoCofre, criarCofre, type Cofre } from './cofre.ts'
import { abrirDrive } from './drive.ts'
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
import { registrarRotasModelos } from './rotas/modelos.ts'
import { registrarRotasPericia } from './rotas/pericia.ts'
import { registrarRotasSetor } from './rotas/setor.ts'
import { criarTarefasPorArea } from './fluxo/tarefasPorArea.ts'
import { registrarRotasIa } from './rotas/ia.ts'
import { criarIa, type Ia } from './ia/ia.ts'
import { criarLeitor } from './fluxo/leitura.ts'
import { abrirConversor, type ConversorDePdf } from './kit/pdf.ts'
import { criarPreparo } from './ia/preparo.ts'
import { registrarRotasDesfecho } from './rotas/desfecho.ts'
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
import { aceitaGanchoDeTeste, registrarRotasRecepcao } from './rotas/recepcao.ts'
import { registrarRotasRecepcaoAgenda } from './rotas/recepcao-agenda.ts'
import { registrarRotasRecepcaoEntrevista } from './rotas/recepcao-entrevista.ts'
import { registrarRotasRecepcaoDecisoes } from './rotas/recepcao-decisoes.ts'
import { registrarRotasRecepcaoSegundaFicha } from './rotas/recepcao-segunda-ficha.ts'
import { registrarRotasRecepcaoContrato } from './rotas/recepcao-contrato.ts'
import { registrarRotasRecepcaoDocumentos } from './rotas/recepcao-documentos.ts'
import { registrarRotasRecepcaoChecklist } from './rotas/recepcao-checklist.ts'
import { registrarRotasRecepcaoCobranca } from './rotas/recepcao-cobranca.ts'
import { registrarRotasConversa } from './rotas/conversa.ts'
import { criarCorreio, registrarRotasMensagens } from './rotas/mensagens.ts'
import { registrarRotasChatwootEntrada } from './rotas/chatwoot-entrada.ts'
import { registrarRotasEstrategia } from './rotas/estrategia.ts'
import { registrarRotasValores } from './rotas/valores.ts'
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
  /**
   * Converte o .docx do kit em PDF (GGVP-136, CA5). Padrão: o Gotenberg de `GOTENBERG_URL`; sem a variável, o portal entrega o
   * Word. `null`: sem conversor, mesmo com a variável (o teste que confere o Word).
   */
  conversor?: ConversorDePdf | null
  /** Drive do escritório ligado (GGVP-107): a trava do pacote cobra o pacote salvo lá. Padrão: as variáveis do Drive. */
  driveLigado?: boolean
  /** O commit do build (GGVP-158), que o /saude mostra. Padrão: "local". */
  versao?: string
  /**
   * GGVP-158 P4.10: a leitura de exemplo, pelo nome do arquivo, no lugar da IA de verdade, só para os testes. Padrão:
   * `LEITURA_SIMULADA=sim`, que só o Playwright liga.
   */
  leituraSimulada?: boolean
  /** O Drive do escritório (GGVP-107; GGVP-158 P4.7, a pasta do cliente). Padrão: as variáveis do Drive; `null`, desligado. */
  drive?: ReturnType<typeof abrirDrive>
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Sugestão pronta (07/10): uma rodada do preparo das sugestões da IA. Sem banco, não faz nada. */
    prepararSugestoes: () => Promise<void>
    /** GGVP-141 (ADR-013): uma rodada do acervo que se alimenta sozinho. Sem banco ou sem a chave da IA, não faz nada. */
    alimentarAcervo: () => Promise<void>
  }
  interface FastifyContextConfig {
    /** GGVP-158: por que esta rota /api não tem trava de permissão (a que recusa sempre, por exemplo). */
    semTrava?: string
  }
}

/**
 * GGVP-158: cabeçalhos de segurança em toda resposta, da API e da tela. A tela montada só carrega arquivos dela mesma; a
 * exceção é o texto ao vivo da entrevista, que o navegador pede direto à OpenAI com a chave temporária (web/src/dados/audio.ts).
 * O quadro aceita blob:, porque a impressão do kit em PDF abre o arquivo baixado num quadro escondido (web/src/impressao.ts).
 */
const CABECALHOS_DE_SEGURANCA = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'content-security-policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; " +
    "connect-src 'self' https://api.openai.com; frame-src 'self' blob:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
}

export const MSG_ERRO_INESPERADO = 'Algo deu errado.'
export const MSG_LEITURA_SO_NO_TESTE = 'A leitura de exemplo (LEITURA_SIMULADA) é só dos testes de tela: na homologação e na produção, o portal não sobe com ela.'

/**
 * GGVP-158: o que o log guarda de um erro: o código e o tipo, nunca a mensagem. O erro do banco traz o SQL e os parâmetros
 * (dado do cliente) na mensagem e nos campos dele; o do Google, o nome do arquivo.
 */
export function resumoDoErro(e: unknown) {
  const erro = e as { name?: string; code?: string | number; cause?: { code?: string } } | null
  return { codigo: erro?.code ?? erro?.cause?.code, tipo: erro?.name }
}

/** Monta a API sem abrir porta, para o teste chamar as rotas com `inject`. */
export function criarServidor({
  logger = false,
  banco,
  consultarBanco,
  pastaTela,
  agora,
  cookieSeguro,
  cofre,
  armazenamento,
  fontes,
  ia,
  conversor,
  driveLigado,
  versao = 'local',
  leituraSimulada = process.env.LEITURA_SIMULADA === 'sim',
  drive: driveDado,
}: Opcoes = {}) {
  // GGVP-158 P4.10: a homologação e a produção nunca leem pelo nome do arquivo.
  if (leituraSimulada && !aceitaGanchoDeTeste(process.env)) throw new Error(MSG_LEITURA_SO_NO_TESTE)
  // GGVP-158: o log nunca leva o cookie da sessão nem a autorização, mesmo num registro que traga os cabeçalhos.
  const app = Fastify({ logger: logger && { redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'] } })
  // GGVP-158: o erro inesperado responde a mensagem genérica e registra só a rota, o código e o tipo. O 4xx (validação,
  // corpo inválido) segue com o tratador padrão do Fastify, com a mensagem e o status dele.
  app.setErrorHandler<FastifyError>((erro, pedido, resposta) => {
    if (erro.statusCode && erro.statusCode < 500) return resposta.send(erro)
    pedido.log.error({ rota: pedido.routeOptions.url, ...resumoDoErro(erro) }, 'erro inesperado')
    return resposta.code(500).send({ erro: MSG_ERRO_INESPERADO })
  })
  // GGVP-158: toda rota /api tem trava de permissão; a que nascer sem trava não deixa o servidor subir. Ficam sem só as da
  // sessão (entrar, sair, trocar a senha e o perfil), que abrem a sessão, e a que diz por quê em `config.semTrava`.
  app.addHook('onRoute', (rota) => {
    const dispensada = rota.url.startsWith('/api/sessao') || Boolean(rota.config?.semTrava)
    if (rota.url.startsWith('/api/') && !dispensada && !rota.preHandler) throw new Error(`Rota sem trava de permissão: ${String(rota.method)} ${rota.url}`)
  })
  app.addHook('onSend', async (_pedido, resposta, corpo) => {
    // O que a rota já pôs vale: o arquivo do cliente sai com a CSP de sandbox, mais estreita que a geral.
    for (const [nome, valor] of Object.entries(CABECALHOS_DE_SEGURANCA)) if (!resposta.hasHeader(nome)) resposta.header(nome, valor)
    // HSTS só por HTTPS: o cookie seguro é o sinal de que o portal está atrás do HTTPS (homologação e produção).
    if (cookieSeguro) resposta.header('strict-transport-security', 'max-age=31536000; includeSubDomains')
    return corpo
  })
  let preparar = async () => {}
  app.decorate('prepararSugestoes', () => preparar())
  let alimentar = async () => {}
  app.decorate('alimentarAcervo', () => alimentar())
  const consultar = consultarBanco ?? (banco && (() => banco.execute(sql`select 1`)))
  // CA10: só leitura não guarda o pacote no Drive, então a trava do pacote não o cobra.
  const doAmbiente = driveDado === undefined ? abrirDrive() : driveDado
  const comDrive = driveLigado ?? (doAmbiente !== null && !doAmbiente.soLeitura)
  const drive = doAmbiente?.soLeitura ? ('so-leitura' as const) : comDrive ? ('ligado' as const) : ('desligado' as const)

  app.get('/saude', async (_pedido, resposta): Promise<Saude> => {
    if (!consultar) return Saude.parse({ ok: true, servico: 'api', banco: 'sem-banco', drive, versao })
    try {
      await consultar()
      return Saude.parse({ ok: true, servico: 'api', banco: 'ligado', drive, versao })
    } catch {
      resposta.code(503) // o deploy lê como falha e mantém a versão anterior no ar
      return Saude.parse({ ok: false, servico: 'api', banco: 'fora-do-ar', drive, versao })
    }
  })

  if (banco) {
    registrarSessao(app, { banco, agora, cookieSeguro })
    const motorIa = ia ?? criarIa({ banco, agora })
    const preparo = criarPreparo(motorIa, (erro) => app.log.error(resumoDoErro(erro), 'preparo da sugestão da IA falhou'))
    preparar = preparo.rodar
    registrarRotasConferencia(app, { banco, agora, ia: motorIa, preparo })
    const arquivos = armazenamento ?? abrirArmazenamento()
    const cofreDoGov = cofre ?? criarCofre(chaveDoCofre())
    // GGVP-147: cada área registra as tarefas abertas dela; as tarefas do setor juntam todas.
    const tarefasPorArea = criarTarefasPorArea()
    registrarRotasInss(app, { banco, agora, cofre: cofreDoGov, armazenamento: arquivos, tarefasPorArea })
    registrarRotasVigilia(app, { banco, agora, armazenamento: arquivos })
    registrarRotasExigencia(app, { banco, agora, armazenamento: arquivos })
    registrarRotasPrestacao(app, { banco, agora, correio: criarCorreio(banco, agora ?? (() => new Date())) })
    // GGVP-158 P7.6: o valor da causa e a renda por pessoa do LOAS, pela regra de valores.
    registrarRotasValores(app, { banco, agora })
    registrarRotasPublicacoes(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasVigiliaDiario(app, { banco, agora, fontes: fontes ?? fontesAtivas() })
    registrarRotasExigenciaJuiz(app, { banco, agora, armazenamento: arquivos, ia: motorIa, preparo })
    registrarRotasManifestacao(app, { banco, agora, armazenamento: arquivos, ia: motorIa })
    registrarRotasDocumentos(app, { banco, agora, armazenamento: arquivos })
    registrarRotasIndeferimento(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasPeticao(app, { banco, agora, armazenamento: arquivos, ia: motorIa, preparo, driveLigado: comDrive })
    registrarRotasGestao(app, { banco, agora })
    registrarRotasAcervo(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasJuizo(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasRegras(app, { banco, agora })
    registrarRotasHistorico(app, { banco, agora })
    registrarRotasCofre(app, { banco, agora, cofre: cofreDoGov })
    registrarRotasConfiguracao(app, { banco, agora })
    registrarRotasModelos(app, { banco, agora, armazenamento: arquivos })
    registrarRotasIa(app, { banco, agora })
    registrarRotasResultado(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasDesfecho(app, { banco, agora })
    registrarRotasEstudo(app, { banco, agora, ia: motorIa, preparo })
    // GGVP-158 P7.1: a estratégia do caso, que a IA propõe e o Jurídico confere.
    registrarRotasEstrategia(app, { banco, agora, ia: motorIa, preparo })
    registrarRotasRecurso(app, { banco, agora, armazenamento: arquivos, ia: motorIa, preparo })
    registrarRotasRecomendacaoPericia(app, { banco, agora, ia: motorIa, preparo })
    // GGVP-158 parte 4: quem lê o que chega à Recepção, a IA de verdade ou a leitura de exemplo dos testes de tela.
    const leitor = criarLeitor({ ia: motorIa, simulada: leituraSimulada, agora })
    registrarRotasRecepcao(app, { banco, agora, tarefasPorArea, armazenamento: arquivos, cofre: cofreDoGov, leitor, drive: doAmbiente })
    registrarRotasRecepcaoAgenda(app, { banco, agora })
    registrarRotasRecepcaoEntrevista(app, { banco, agora, ia: motorIa, armazenamento: arquivos, preparo })
    registrarRotasRecepcaoDecisoes(app, { banco, agora })
    registrarRotasRecepcaoSegundaFicha(app, { banco, agora, armazenamento: arquivos, cofre: cofreDoGov, leitor })
    registrarRotasRecepcaoContrato(app, {
      banco,
      agora,
      armazenamento: arquivos,
      conversor: conversor === undefined ? abrirConversor() : (conversor ?? undefined),
      leitor,
    })
    registrarRotasRecepcaoDocumentos(app, { banco, agora, armazenamento: arquivos, leitor })
    registrarRotasRecepcaoChecklist(app, { banco, agora })
    registrarRotasRecepcaoCobranca(app, { banco, agora })
    registrarRotasRoteiros(app, { banco, agora })
    registrarRotasParecer(app, { banco, agora, ia: motorIa, armazenamento: arquivos, preparo })
    registrarRotasComplemento(app, { banco, agora, ia: motorIa, armazenamento: arquivos })
    registrarRotasDeficiencia(app, { banco, agora })
    registrarRotasAcidente(app, { banco, agora })
    registrarRotasCrianca(app, { banco, agora })
    registrarRotasDocumentacaoMedica(app, { banco, agora, ia: motorIa, armazenamento: arquivos })
    const conversas = registrarRotasConversa(app, { banco, agora, ia: motorIa, armazenamento: arquivos, preparo })
    // GGVP-158 P6.5: a entrada do Chatwoot (o webhook com o segredo), que leva a mensagem do WhatsApp à conversa.
    registrarRotasChatwootEntrada(app, { banco, agora, receber: conversas.receberDoWhatsapp })
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
      await alimentarAcervo(banco, motorIa).catch((erro) => app.log.error(resumoDoErro(erro), 'alimentar o acervo falhou'))
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
