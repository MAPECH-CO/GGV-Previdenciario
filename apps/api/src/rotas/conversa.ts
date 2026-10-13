// A conversa com o lead ou o cliente no servidor (GGVP-138; telas da GGVP-76, 80, 84 e 88), sobre o fichário da
// Recepção (GGVP-125). As rotas têm a forma da design.md da change ggvp-12 e as regras são as mesmas do servidor de
// exemplo do Pedro, importadas das telas (só as regras puras), rodando aqui com o perfil da sessão. A conversa fica em
// `atendimento`, com o documento das telas em `dados`; a gravação, em `gravacao_recepcao`, o mesmo motor da entrevista;
// cada mudança conferida, em `versao_campo`, e na ficha do cliente.
// GGVP-133: o áudio é o de verdade (o microfone da conversa no escritório ou a ligação baixada do Chatwoot) e o texto vem
// da OpenAI, pelo motor de IA, como na entrevista. Sem áudio guardado ou sem a chave do serviço, a transcrição falha com
// o motivo e a tela segue manual: nada de conversa de exemplo nem de áudio de mentira (as falas de exemplo ficam no
// servidor falso dos testes das telas).
// ponytail: as regras vêm de apps/web; mover para um pacote comum quando a ligação terminar.
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { dataParaIso, normalizarData, normalizarNome, validarNome } from '@ggv/campos'
import {
  AcaoNaGravacaoPedida,
  CampoDaConversa,
  Conferencia,
  EntrevistaSemAudio,
  FimDaConversa,
  InicioDaGravacao,
  NovaConversa,
  NovoPrazoDaPendencia,
  PedidoDeTranscricao,
  VerificacaoNaConversa,
  VoltarVersao,
  pode,
  type AnaliseDaConversa,
  type Conversa,
  type Erro,
  type Pendencia,
} from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, atendimento, pericia, pessoa, tarefa, usuario, versaoCampo } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import type { AcaoNaGravacao, Ficha, Gravacao, Setor, Tarefa, Trecho } from '../../../web/src/dados/tipos.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import {
  CAMPOS_DA_CONVERSA,
  CANAIS_DO_REGISTRO,
  COM_QUEM,
  apareceNaFala,
  erroDoValor,
  motivoParaNaoAbrir,
  motivoParaNaoConferir,
  motivoParaNaoCriarPendencia,
  oQueMudou,
  oQuePrecisaAtualizar,
  situacaoDaPendencia,
  valorGuardado,
  valorLido,
  type CampoDaFicha,
  type CampoDoProcesso,
  type Dito,
  type Mudanca,
  type PapelNaConversa,
  type Pessoa,
  type VersaoDoCampo,
} from '../../../web/src/regras/conversa.ts'
import { ehAudio, minutos, temSenha, tirarSenhas } from '../../../web/src/regras/entrevista.ts'
import { COMO_VERIFICOU, ehProtegido, motivoParaNaoMudar, verificacaoDaConversa, type Verificacao } from '../../../web/src/regras/seguranca.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario, horaEmBrasilia } from './recepcao.ts'
import { AnaliseDaConversaPelaIa, ChaveAoVivo } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import { lerJson, type Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { MSG_SEM_AUDIO, guardarAudio, transcreverGravacao } from '../fluxo/transcricao.ts'
import { SENHA_RETIRADA } from '../../../web/src/regras/entrevista.ts'
import { lerFormulario } from './formulario.ts'
import { MSG_AUDIO_GRANDE, MSG_MANDE_O_ARQUIVO } from './recepcao-entrevista.ts'
import { MSG_SEM_AO_VIVO, chaveDaGravacao } from './transcricao.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import { semAcento } from '../../../web/src/regras/busca.ts'
import type { MensagemDoWhatsapp } from './chatwoot-entrada.ts'

export const MSG_CONVERSA_NAO_ENCONTRADA = 'Conversa não encontrada.'
export const MSG_SEM_AVISO_NA_CONVERSA = 'Avise que a conversa será gravada antes de gravar (G10).'
export const MSG_SEM_AVISO_NA_LIGACAO = 'Confirme que a ligação começou com o aviso de gravação (G10).'
/** GGVP-140 CA5: a IA não leu a conversa (fora do ar, recusada ou resposta fora do formato): a pessoa segue pela leitura. */
export const MSG_DECISAO_DA_SENIOR = 'Quem confirma, corrige ou desfaz o que a IA apontou é a Sênior.'
export const MSG_VIDEO_NA_LIGACAO = 'Na ligação e no WhatsApp, o cliente se verifica por chamada de vídeo.'
export const MSG_WHATSAPP_DO_ATENDIMENTO = 'A conversa do WhatsApp é conferida pelo Atendimento.'
export const TITULO_PENDENCIA = 'Cumprir pendência da conversa'
export const TITULO_CONFERIR_IA = 'Conferir o que a IA apontou na conversa'
export const TITULO_CONFERIR_WHATSAPP = 'Conferir a conversa do WhatsApp'
/** GGVP-158 P6.5: quem "conduz" a conversa do WhatsApp; ela junta as mensagens até 30 minutos sem mensagem nova. */
export const QUEM_NO_WHATSAPP = 'WhatsApp (Chatwoot)'
export const PARADA_DO_WHATSAPP_MS = 30 * 60_000
export const MSG_IA_SEM_ANALISE = 'A IA não respondeu agora: leia a transcrição e confira o que mudou.'
/** GGVP-133: sem `IA_PERMITE_DADO_DE_SAUDE=sim`, o motor recusa a leitura: a tela diz o motivo certo e segue manual. */
export const MSG_IA_SEM_SAUDE_NA_CONVERSA = 'A IA não está autorizada a ler dado de saúde neste ambiente: leia a transcrição e confira o que mudou.'

const ESTADO_DEPOIS: Partial<Record<AcaoNaGravacao['acao'], Gravacao['estado']>> = {
  pausou: 'pausada',
  'abriu-cofre': 'pausada',
  retomou: 'gravando',
  'guardou-senha': 'gravando',
  falhou: 'falhou',
}
const CANAL_DO_ATENDIMENTO = { ligacao: 'telefone', presencial: 'presencial' } as const
const SETOR_DO_PERFIL: Record<string, Setor> = {
  atendimento: 'Atendimento',
  atendimento_lider: 'Atendimento',
  documentacao: 'Documentação · ADM',
  advogada: 'Jurídico',
  senior: 'Jurídico',
  juridico_adm: 'Jurídico',
  financeiro: 'Financeiro',
}

/**
 * A conversa como fica guardada: a das telas, com quem conduziu e quem ficou com a pendência pelo id do login. A do
 * WhatsApp não tem quem conduziu (`quemId` nulo) e guarda os ids das mensagens do Chatwoot que já entraram.
 */
type Guardada = Conversa & { quemId: string | null; pendencia?: Pendencia & { responsavelId: string }; chatwoot?: number[]; ultimaEm?: string }

/** Quem conduz pelo perfil da sessão: o mesmo `papelDoPerfil` das telas, com os nomes da matriz. */
export function papelDaSessao(perfil: string | null): PapelNaConversa | null {
  if (perfil === 'atendimento' || perfil === 'atendimento_lider') return 'atendimento'
  if (perfil === 'advogada' || perfil === 'senior') return 'juridico'
  return null
}

const comMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)
const comQuemFalado = (c: Conversa) => `${CANAIS_DO_REGISTRO[c.canal].rotulo.toLowerCase()}, com ${COM_QUEM[c.comQuem].toLowerCase()}`
/** Fato novo e documento citado somam ao caso: não têm versão anterior nem volta. */
const somaAoCaso = (campo: string) => campo === 'fato' || campo === 'documento'
/** "05/10/2026 14:32", em Brasília, também no servidor em UTC. */
const dataHoraEmBrasilia = (iso: string) => {
  const [a, m, d] = hojeEmBrasilia(new Date(iso)).split('-')
  return `${d}/${m}/${a} ${horaEmBrasilia(new Date(iso))}`
}

/** Uma coisa dita, com a hora e o trecho da transcrição de onde saiu (GGVP-80 CA5). */
type DitoNaConversa = Dito & { aos: number; trecho: string }

const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** GGVP-133: o motor de IA, o armazenamento e o preparo ligam a transcrição de verdade; sem eles, nada é transcrito. */
type Opcoes = { banco: Banco; agora?: () => Date; ia?: Ia; armazenamento?: Armazenamento; preparo?: Preparo }
const formatoDo = (nome: string) => nome.split('.').at(-1)?.toLowerCase() ?? ''

/**
 * A conversa como a tela recebe, sem os ids do login. O que a conversa registrou não é dado de saúde (Pedro, 08/10: dado de
 * saúde é o conteúdo médico, como laudo, CID, diagnóstico e parecer): quem vê o caso vê a conversa inteira.
 */
export function paraTela(c: Conversa): Conversa {
  const { quemId: _q, chatwoot: _c, pendencia: comId, ...conversa } = c as Guardada
  if (!comId) return conversa
  const { responsavelId: _r, ...pendencia } = comId
  return { ...conversa, pendencia }
}

/** A perícia marcada na tela da perícia (épico GGVP-10) é a que vale: uma fonte só. aaaa-mm-dd, em Brasília. */
export async function periciaMarcadaNoCaso(banco: Banco, casoId: string | undefined): Promise<string | undefined> {
  if (!casoId) return undefined
  const marcadas = await banco.select({ quando: pericia.agendadaPara }).from(pericia).where(and(eq(pericia.casoId, casoId), isNotNull(pericia.agendadaPara)))
  const ultima = marcadas.map((p) => p.quando!).sort((a, b) => a.getTime() - b.getTime()).at(-1)
  return ultima ? hojeEmBrasilia(ultima) : undefined
}

const versoesDoCliente = (banco: Banco, pessoaId: string) =>
  banco.select().from(versaoCampo).where(eq(versaoCampo.pessoaId, pessoaId)).orderBy(asc(versaoCampo.quando), asc(versaoCampo.criadoEm))

/** Os campos do processo em vigor: a última versão de cada um e, por cima, a perícia marcada (GGVP-84). */
export async function camposDoProcessoEmVigor(banco: Banco, pessoaId: string, casoId: string | undefined): Promise<Partial<Record<CampoDoProcesso, string>> | null> {
  if (!casoId) return null
  const campos: Partial<Record<CampoDoProcesso, string>> = {}
  for (const v of await versoesDoCliente(banco, pessoaId)) if (v.casoId === casoId && v.onde === 'processo') campos[v.campo as CampoDoProcesso] = v.valor
  const marcada = await periciaMarcadaNoCaso(banco, casoId)
  if (marcada) campos.pericia = marcada
  return campos
}

export function registrarRotasConversa(app: FastifyInstance, { banco, agora = () => new Date(), ia, armazenamento, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const { hoje, evento, nomeDe, fichas, guardar, guardarGravacao, acharGravacao, gravacoes } = criarFichario(banco, agora)
  const real = ia && armazenamento ? { banco, ia, armazenamento } : null
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }
  const registrar = { preHandler: exigir(banco, 'conversa.registrar', agora) }
  const voltar = { preHandler: exigir(banco, 'ficha.voltar_versao', agora) }
  const darPrazo = { preHandler: exigir(banco, 'conversa.prazo_da_pendencia', agora) }
  const verTarefas = { preHandler: exigir(banco, 'tarefa.ver', agora) }
  const cumprir = { preHandler: exigir(banco, 'tarefa.cumprir', agora) }
  const veSaude = (pedido: FastifyRequest) => pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')

  async function guardarConversa(c: Guardada, g?: Gravacao) {
    await banco
      .update(atendimento)
      .set({ fim: c.finalizadaEm ? new Date(c.finalizadaEm) : null, avisoGravacaoEm: g?.avisoEm ? new Date(g.avisoEm) : null, resumo: g?.resumo ?? null, dados: c })
      .where(eq(atendimento.id, c.id))
  }

  /** A conversa, a ficha e a gravação. Nulo quando a conversa não existe. */
  async function acharConversa(id: string) {
    if (!UUID.test(id)) return null
    const [linha] = await banco.select().from(atendimento).where(and(eq(atendimento.id, id), isNotNull(atendimento.dados)))
    if (!linha) return null
    const conversa = linha.dados as Guardada
    const [ficha] = await fichas([linha.pessoaId])
    if (!ficha) return null
    const gravacao = conversa.gravacaoId ? (await acharGravacao(conversa.gravacaoId))?.gravacao : undefined
    return { conversa, ficha, gravacao }
  }

  /** O que a tela recebe: a conversa, a ficha e a gravação que a pessoa pode ver. */
  async function resposta(pedido: FastifyRequest, c: Guardada, ficha: Ficha, g?: Gravacao) {
    const pode = veSaude(pedido)
    // LGPD: a leitura do fato novo de saúde pelo Jurídico fica registrada.
    if (pode && (c.analise?.mudancas.some((m) => m.saude) || g?.soJuridico)) {
      await banco.insert(acessoDadoSensivel).values({ usuarioId: pedido.usuario!.id, perfil: pedido.perfilAtivo!, casoId: c.processoId ?? null, recurso: `conversa:${c.id}`, quando: agora() })
    }
    // GGVP-140: a conversa da advogada, para quem não é do Jurídico, aparece sem o texto, o registro, o resumo e a análise.
    if (!pode && g?.soJuridico) {
      const semTexto = { trechos: [], extraidas: [], resumo: undefined, registro: undefined }
      return { conversa: paraTela({ ...c, analise: undefined, registro: undefined }), ficha, gravacao: { ...g, ...semTexto } }
    }
    return { conversa: paraTela(c), ficha, gravacao: g }
  }

  /** As pessoas do escritório que podem ficar com a pendência: as do login, com o setor do primeiro perfil. */
  async function pessoasDoEscritorio(): Promise<(Pessoa & { id: string })[]> {
    const linhas = await banco.select({ id: usuario.id, nome: usuario.nome, perfis: usuario.perfis }).from(usuario).orderBy(asc(usuario.nome))
    return linhas.flatMap((u) => {
      const setor = u.perfis.map((p) => SETOR_DO_PERFIL[p]).find(Boolean)
      return setor ? [{ id: u.id, nome: u.nome, setor }] : []
    })
  }

  const versoesDa = (pessoaId: string) => versoesDoCliente(banco, pessoaId)
  const periciaMarcada = (casoId: string | undefined) => periciaMarcadaNoCaso(banco, casoId)
  const camposDoProcesso = (pessoaId: string, casoId: string | undefined) => camposDoProcessoEmVigor(banco, pessoaId, casoId)

  function novaGravacao(ficha: Ficha, c: Conversa, origem: Gravacao['origem']): Gravacao {
    return {
      id: `gravacao-${randomUUID()}`,
      fichaId: ficha.id,
      data: hoje(),
      titulo: `${CANAIS_DO_REGISTRO[c.canal].rotulo} · ${COM_QUEM[c.comQuem].toLowerCase()}`,
      canal: c.canal === 'ligacao' ? 'ligação' : 'presencial',
      // Quem registrou vem primeiro (GGVP-76 CA7).
      participantes: [c.quem, c.comQuem === 'cliente' ? ficha.nome : COM_QUEM[c.comQuem].toLowerCase()],
      duracao: 0,
      origem,
      estado: 'gravando',
      acoes: [],
      transcricao: 'transcrevendo',
      trechos: [],
      extraidas: [],
      documentos: [],
      // O que a conversa registrou não é dado de saúde: quem vê o caso vê a conversa (Pedro, 08/10). A conversa da advogada
      // fica só com o Jurídico, como a entrevista (desenho do Relacionamento; GGVP-140).
      soJuridico: c.papel === 'juridico',
      marcas: [],
      conversaId: c.id,
    }
  }

  /** GGVP-133: só o áudio guardado de verdade vai ao card e à transcrição; quem chama já guardou o documento. */
  function guardarNoCard(ficha: Ficha, g: Gravacao) {
    g.estado = 'encerrada'
    g.transcricao = 'transcrevendo'
    ficha.transcricoes += 1
  }

  // GGVP-76 CA3, CA4, CA9: a conversa abre no card do lead ou do cliente; só escrita, já fica "só registro".
  app.post('/api/conversas', registrar, async (pedido, resp) => {
    const entrada = NovaConversa.safeParse(pedido.body)
    if (!entrada.success) return negar(resp, 400, 'Conversa incompleta ou inválida.')
    const d = entrada.data
    const [ficha] = await fichas([d.fichaId])
    if (!ficha) return negar(resp, 404, MSG_FICHA_NAO_ENCONTRADA)
    const papel = papelDaSessao(pedido.perfilAtivo)
    const motivo = motivoParaNaoAbrir(d, papel, ficha.processos.map((p) => p.id))
    if (motivo) return negar(resp, 400, motivo)
    const quem = await nomeDe(pedido)
    const conversa: Guardada = {
      id: randomUUID(),
      fichaId: ficha.id,
      processoId: d.processoId ?? ficha.processos[0]?.id,
      canal: d.canal,
      comQuem: d.comQuem,
      modo: d.modo,
      quem,
      quemId: pedido.usuario!.id,
      papel: papel!,
      abertaEm: agora().toISOString(),
    }
    await banco.insert(atendimento).values({
      id: conversa.id,
      pessoaId: ficha.id,
      casoId: conversa.processoId ?? null,
      canal: CANAL_DO_ATENDIMENTO[d.canal],
      responsavelId: pedido.usuario!.id,
      inicio: agora(),
      dados: conversa,
    })
    let g: Gravacao | undefined
    if (d.modo === 'escrito') {
      g = novaGravacao(ficha, conversa, 'registro')
      Object.assign(g, { estado: 'encerrada', transcricao: 'sem-audio', registro: d.registro!.trim() })
      Object.assign(conversa, { gravacaoId: g.id, registro: g.registro, finalizadaEm: conversa.abertaEm })
      ficha.historico.push(evento(`Registrou a conversa sem áudio (${comQuemFalado(conversa)}): só registro`, quem))
      await guardarGravacao(g)
    } else {
      const falta = d.modo === 'arquivo' ? 'falta subir a gravação da ligação' : 'grava depois do aviso (G10)'
      ficha.historico.push(evento(`Abriu a conversa (${comQuemFalado(conversa)}): ${falta}`, quem))
    }
    await guardarConversa(conversa, g)
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'conversa_aberta', pedido, `pessoa:${ficha.id}`, { conversa: conversa.id, canal: d.canal, comQuem: d.comQuem, modo: d.modo })
    return resposta(pedido, conversa, ficha, g)
  })

  app.get<{ Params: { id: string } }>('/api/conversas/:id', ver, async (pedido, resp) => {
    const achada = await acharConversa(pedido.params.id)
    if (!achada) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    return resposta(pedido, achada.conversa, achada.ficha, achada.gravacao)
  })

  // GGVP-76 CA1, CA5, G10: só grava com o aviso registrado, com a hora. A que está aberta continua.
  app.post<{ Params: { id: string } }>('/api/conversas/:id/gravacao', registrar, async (pedido, resp) => {
    if (!InicioDaGravacao.safeParse(pedido.body).success) return negar(resp, 400, MSG_SEM_AVISO_NA_CONVERSA)
    const achada = await acharConversa(pedido.params.id)
    if (!achada) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    const { conversa: c, ficha, gravacao } = achada
    if (c.modo !== 'tempo-real') return negar(resp, 400, 'Esta conversa não é gravada agora.')
    if (gravacao) return resposta(pedido, c, ficha, gravacao)
    const g = novaGravacao(ficha, c, 'portal')
    g.avisoEm = agora().toISOString()
    g.acoes.push({ acao: 'avisou', quando: g.avisoEm, aos: 0 }, { acao: 'gravou', quando: g.avisoEm, aos: 0 })
    c.gravacaoId = g.id
    ficha.historico.push(evento(`Avisou às ${horaEmBrasilia(agora())} que a conversa seria gravada (G10) e começou a gravar`, c.quem))
    await guardarGravacao(g)
    await guardarConversa(c, g)
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'conversa_gravada', pedido, `pessoa:${ficha.id}`, { conversa: c.id })
    return resposta(pedido, c, ficha, g)
  })

  // GGVP-76 CA9: pausar, retomar e o cofre, como na entrevista: cada ação com a hora e o ponto do áudio.
  app.post<{ Params: { id: string } }>('/api/conversas/:id/acoes', registrar, async (pedido, resp) => {
    const entrada = AcaoNaGravacaoPedida.safeParse(pedido.body)
    if (!entrada.success) return negar(resp, 400, 'Ação inválida.')
    const achada = await acharConversa(pedido.params.id)
    if (!achada?.gravacao) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    const { conversa: c, ficha, gravacao: g } = achada
    if (g.estado === 'encerrada') return negar(resp, 400, 'A gravação já foi encerrada.')
    g.acoes.push({ acao: entrada.data.acao, quando: agora().toISOString(), aos: entrada.data.aos })
    g.duracao = Math.max(g.duracao, entrada.data.aos)
    g.estado = ESTADO_DEPOIS[entrada.data.acao]!
    await guardarGravacao(g)
    return resposta(pedido, c, ficha, g)
  })

  // GGVP-76 CA6, CA9: o áudio fica no card do lead ou cliente e vai para a transcrição.
  app.post<{ Params: { id: string } }>('/api/conversas/:id/finalizar', registrar, async (pedido, resp) => {
    const entrada = FimDaConversa.safeParse(pedido.body)
    if (!entrada.success) return negar(resp, 400, 'Fim da conversa inválido.')
    const achada = await acharConversa(pedido.params.id)
    if (!achada) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    const { conversa: c, ficha, gravacao: g } = achada
    if (!g) return negar(resp, 400, 'Grave a conversa antes de finalizar.')
    if (g.estado === 'encerrada') return resposta(pedido, c, ficha, g)
    g.duracao = Math.max(g.duracao, entrada.data.aos)
    // GGVP-133, CA8: nenhum áudio chegou (a página recarregou antes da primeira parte, ou sem microfone). Nada de áudio de
    // mentira: a gravação falha e as saídas são subir o áudio gravado fora ou registrar sem áudio.
    if (!g.audio?.documentos?.length) {
      g.acoes.push({ acao: 'falhou', quando: agora().toISOString(), aos: entrada.data.aos })
      g.estado = 'falhou'
      await guardarGravacao(g)
      return resposta(pedido, c, ficha, g)
    }
    g.acoes.push({ acao: 'encerrou', quando: agora().toISOString(), aos: entrada.data.aos })
    guardarNoCard(ficha, g)
    c.finalizadaEm = agora().toISOString()
    ficha.historico.push(evento(`Finalizou a conversa gravada (${minutos(g.duracao)}); o áudio ficou no card e foi para a transcrição`, c.quem))
    await guardarGravacao(g)
    await guardarConversa(c, g)
    await guardar(ficha)
    return resposta(pedido, c, ficha, g)
  })

  // GGVP-76 CA2, G10: a ligação já feita sobe gravada, de qualquer formato e tamanho, com o aviso nela.
  app.post<{ Params: { id: string } }>('/api/conversas/:id/audio', registrar, async (pedido, resp) => {
    // GGVP-133: o áudio de verdade vira documento na pasta do cliente. Na conversa por arquivo, é a gravação da ligação
    // baixada do Chatwoot (CA2), com o aviso nela (G10); na conversa gravada agora, é uma parte do microfone.
    if (pedido.isMultipart()) {
      if (!real) return negar(resp, 503, 'O armazenamento do áudio não está ligado.')
      const formulario = await lerFormulario(pedido)
      if (!formulario) return negar(resp, 400, MSG_AUDIO_GRANDE)
      const { arquivo, campos } = formulario
      if (!arquivo || !ehAudio({ nome: arquivo.nome, tipo: arquivo.mime })) return negar(resp, 400, 'Esse arquivo não é de áudio.')
      const achadaComAudio = await acharConversa(pedido.params.id)
      if (!achadaComAudio) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
      const { conversa: c, ficha, gravacao } = achadaComAudio
      if (c.modo === 'arquivo') {
        if (campos.avisoNaGravacao !== 'sim') return negar(resp, 400, MSG_SEM_AVISO_NA_LIGACAO)
        if (gravacao) return resposta(pedido, c, ficha, gravacao)
        const g = novaGravacao(ficha, c, 'arquivo')
        g.acoes.push({ acao: 'subiu-arquivo', quando: agora().toISOString(), aos: 0 })
        const id = await guardarAudio(real, g, arquivo, pedido.usuario!.id)
        g.audio = { nome: arquivo.nome, formato: formatoDo(arquivo.nome), tamanho: arquivo.conteudo.length, partes: 1, documentos: [{ id, inicio: 0 }] }
        guardarNoCard(ficha, g)
        Object.assign(c, { gravacaoId: g.id, finalizadaEm: agora().toISOString() })
        ficha.historico.push(evento(`Subiu a gravação da ligação (${arquivo.nome}); o áudio ficou no card e foi para a transcrição`, c.quem))
        await guardarGravacao(g)
        await guardarConversa(c, g)
        await guardar(ficha)
        return resposta(pedido, c, ficha, g)
      }
      const inicio = Number(campos.inicio ?? 0)
      if (c.modo !== 'tempo-real' || !gravacao || gravacao.estado === 'encerrada' || !Number.isFinite(inicio) || inicio < 0)
        return negar(resp, 400, 'Esta conversa não recebe mais áudio.')
      const id = await guardarAudio(real, gravacao, arquivo, pedido.usuario!.id)
      const antes = gravacao.audio?.documentos ? gravacao.audio : undefined
      const documentos = [...(antes?.documentos ?? []), { id, inicio }]
      gravacao.audio = { nome: antes?.nome ?? arquivo.nome, formato: formatoDo(arquivo.nome), tamanho: (antes?.tamanho ?? 0) + arquivo.conteudo.length, partes: documentos.length, documentos }
      await guardarGravacao(gravacao)
      return resposta(pedido, c, ficha, gravacao)
    }
    // Só o nome do arquivo não é áudio guardado: sem o arquivo, nada fica no card (nada de áudio de mentira), como na entrevista.
    return negar(resp, 400, MSG_MANDE_O_ARQUIVO)
  })

  // GGVP-133: sem microfone, a conversa gravada agora não inventa falas: quem conversou escreve o que foi conversado e ela
  // fica como "só registro", como a conversa escrita. Nada muda na ficha sem a conferência (G14).
  app.post<{ Params: { id: string } }>('/api/conversas/:id/sem-audio', registrar, async (pedido, resp) => {
    const entrada = EntrevistaSemAudio.safeParse(pedido.body)
    if (!entrada.success || entrada.data.notas.length < 3) return negar(resp, 400, 'Escreva o que foi conversado.')
    const achada = await acharConversa(pedido.params.id)
    if (!achada?.gravacao) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    const { conversa: c, ficha, gravacao: g } = achada
    if (g.estado === 'encerrada') return resposta(pedido, c, ficha, g)
    g.acoes.push({ acao: 'sem-audio', quando: agora().toISOString(), aos: g.duracao })
    Object.assign(g, { estado: 'encerrada', transcricao: 'sem-audio', registro: entrada.data.notas })
    Object.assign(c, { registro: entrada.data.notas, finalizadaEm: agora().toISOString() })
    ficha.historico.push(evento(`Registrou a conversa sem áudio (${comQuemFalado(c)}): o microfone não gravou`, c.quem))
    await guardarGravacao(g)
    await guardarConversa(c, g)
    await guardar(ficha)
    return resposta(pedido, c, ficha, g)
  })

  /**
   * A análise depois da transcrição, da IA de verdade (GGVP-140): a IA diz o que foi dito; a
   * comparação com a ficha e o processo é código (`oQueMudou`). A senha dita sai do texto e fica só a trilha, nunca o valor
   * (G9): para o cofre, quem tem a senha digita. Nada muda na ficha aqui: só depois de conferido por quem conversou (G14).
   * `aviso`: por que a IA não leu, à frente da observação, e a linha do contato não diz o que mudou.
   */
  async function montarAnalise(c: Conversa, ficha: Ficha, g: Gravacao, lido: { ditos: DitoNaConversa[]; senhaDita: boolean; pendencia?: string; aviso?: string }): Promise<AnaliseDaConversa> {
    const { ditos, senhaDita, pendencia, aviso } = lido
    const mudancas = oQueMudou(ditos, ficha, await camposDoProcesso(ficha.id, c.processoId))
    const saude = mudancas.some((m) => m.saude)
    if (senhaDita) ficha.historico.push(evento('A senha do gov.br foi dita na conversa: saiu da transcrição e não ficou guardada; para o cofre, o cliente digita (G9)', 'Sistema (IA)'))
    const cofre = senhaDita || g.acoes.some((a) => a.acao === 'guardou-senha')
    g.extraidas = [
      ...mudancas.map((m) => ({ id: m.id, rotulo: comMaiuscula(m.rotulo), valor: valorLido(m.campo, m.depois), destino: m.onde })),
      ...(cofre
        ? [{ id: 'senha', rotulo: 'Senha do gov.br', valor: `${senhaDita ? 'dita na conversa' : 'digitada no cofre'}: não consta na transcrição (G9)`, destino: 'cofre' as const }]
        : []),
    ]
    const oQue = mudancas.map((m) => m.rotulo)
    const disse = aviso ? 'transcrição pronta, a conferir' : oQue.length ? oQue.join(', ') : 'nada muda na ficha nem no processo'
    g.resumo = `${comMaiuscula(comQuemFalado(c))}: ${disse}.${pendencia ? ` Combinado: ${pendencia}` : ''}`
    // Tudo fica no histórico do contato (GGVP-76 CA9).
    ficha.contatos.push({ data: hoje(), canal: c.canal === 'whatsapp' ? 'WhatsApp' : `${CANAIS_DO_REGISTRO[c.canal].rotulo} (gravada, G10)`, texto: g.resumo })
    const observacao = [
      aviso,
      senhaDita && 'A senha do gov.br foi dita em voz alta: saiu da transcrição (G9). Para o cofre, o cliente digita.',
      saude && 'Tem fato novo de saúde: quem confirma é o Jurídico.',
      c.comQuem !== 'cliente' && 'Quem falou não foi o cliente: confira antes de mudar dado de contato.',
    ]
      .filter(Boolean)
      .join(' ')
    return { mudancas, atualizar: oQuePrecisaAtualizar(mudancas), observacao: observacao || 'Nada fora do comum na conversa.', pendencia }
  }

  /**
   * GGVP-140 CA1, CA3, CA4: a IA de verdade lê a transcrição (já sem a senha, G9, como dado dentro do `<conteudo>`, com o
   * alerta do motor) e diz o que foi dito. O que vale passa pelo código: o campo vai à ficha ou ao processo pelo nome, o
   * valor é conferido pela biblioteca de campos, e a hora e o trecho são os da transcrição, nunca os da IA. O que traz
   * senha não passa. Nula quando a IA não respondeu (CA5).
   */
  async function lerComIa(c: Conversa, ficha: Ficha, g: Gravacao, quemId: string | null) {
    const quem = (t: Trecho) => (t.papel === 'cliente' ? 'cliente' : t.papel === 'terceiro' ? 'outra pessoa' : 'escritório')
    const conteudo = [
      `Conversa: ${comQuemFalado(c)}, conduzida por ${c.papel === 'juridico' ? 'advogada' : 'Atendimento'}.`,
      `Benefício: ${nomeBeneficio(ficha.beneficioInteresse) || 'a definir'}.`,
      'Falas:',
      JSON.stringify(g.trechos.map((t, i) => ({ i, quem: quem(t), texto: t.texto }))),
    ].join('\n')
    const valida = (texto: string) => AnaliseDaConversaPelaIa.safeParse(lerJson(texto)).success
    const fontes = [{ tipo: 'documento' as const, referencia: `gravacao:${g.id}` }]
    const s = await real!.ia.sugerir('analisar_conversa', { casoId: c.processoId ?? null, quem: quemId, conteudo, fontes }, { validar: valida })
    if (!s) return null
    const lida = AnaliseDaConversaPelaIa.parse(lerJson(s.texto))
    const ditos = lida.ditos.flatMap(({ campo, valor, i, saude }): DitoNaConversa[] => {
      const t = g.trechos[i]
      // GGVP-158 P6.6: só o valor que aparece na fala de onde veio; o resto fica de fora, sem chegar à conferência.
      if (!t || temSenha(valor) || erroDoValor(campo, valor) || !apareceNaFala(campo, valor, t.texto)) return []
      const comum = { valor: valorGuardado(campo, valor), aos: t.aos, trecho: t.texto }
      return campo === 'pericia' || campo === 'fato' || campo === 'documento'
        ? [{ onde: 'processo', campo, ...comum, ...(saude && { saude: true as const }) }]
        : [{ onde: 'ficha', campo, ...comum }]
    })
    const resumo = temSenha(lida.resumo) ? 'O resumo da IA citava uma senha e foi retirado (G9): leia a transcrição.' : lida.resumo
    const combinado = lida.combinado && !temSenha(lida.combinado) ? lida.combinado : undefined
    return { ditos, combinado, daIa: { resumo, chamadaId: s.chamadaId, modelo: s.modelo, alerta: s.alerta } }
  }

  // GGVP-80, GGVP-133 CA1, CA8: a transcrição de verdade, pelo motor de IA, como na entrevista; falhou, o áudio fica e a
  // pessoa tenta de novo. Sem a chave do serviço, falha com o motivo; sem áudio guardado (sem microfone, ou a página caiu
  // antes da primeira parte), não há o que transcrever. `falhar` é da transcrição simulada das telas de exemplo: aqui não
  // simula nada.
  app.post<{ Params: { id: string } }>('/api/conversas/:id/transcricao', registrar, async (pedido, resp) => {
    const entrada = PedidoDeTranscricao.safeParse(pedido.body ?? {})
    if (!entrada.success) return negar(resp, 400, 'Pedido inválido.')
    const achada = await acharConversa(pedido.params.id)
    if (!achada) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    const { conversa: c, ficha, gravacao: g } = achada
    if (!g || g.estado !== 'encerrada' || (g.transcricao !== 'transcrevendo' && g.transcricao !== 'falhou')) return resposta(pedido, c, ficha, g)
    if (!g.audio?.documentos?.length || !real) {
      Object.assign(g, { transcricao: 'falhou', motivoDaFalha: MSG_SEM_AUDIO })
      await guardarGravacao(g)
      return resposta(pedido, c, ficha, g)
    }
    const { pronta, senhaDita } = await transcreverDeVerdade(c, ficha, g, pedido.usuario!.id)
    const mudancas = c.analise?.mudancas ?? []
    if (pronta)
      await historico(pedido.usuario!.id, 'conversa_transcrita', pedido, `pessoa:${ficha.id}`, { conversa: c.id, mudancas: mudancas.length, saude: mudancas.some((m) => m.saude), senhaDita })
    return resposta(pedido, c, ficha, g)
  })

  /** GGVP-158 P6.7: a linha da tarefa da conversa (D5.04, D5.05), com a pessoa, o caso quando há e a conversa; uma só aberta. */
  async function abrirTarefaDaConversa(
    c: Guardada,
    pessoaId: string,
    t: { passo: 'D5.04' | 'D5.05'; titulo: string; perfilDono: string | null; responsavelId?: string; prazo?: string },
  ) {
    const doDono = t.perfilDono ? eq(tarefa.perfilDono, t.perfilDono) : isNull(tarefa.perfilDono)
    const [aberta] = await banco
      .select({ id: tarefa.id })
      .from(tarefa)
      .where(and(eq(tarefa.atendimentoId, c.id), eq(tarefa.passo, t.passo), doDono, isNull(tarefa.concluidaEm)))
      .limit(1)
    if (aberta) return
    await banco.insert(tarefa).values({
      casoId: c.processoId ?? null,
      pessoaId,
      atendimentoId: c.id,
      passo: t.passo,
      titulo: t.titulo,
      perfilDono: t.perfilDono,
      responsavelId: t.responsavelId ?? null,
      prazo: t.prazo ?? null,
    })
  }

  /** Fecha a linha aberta da conversa naquele passo (e daquele dono, quando vem), com quem e quando. */
  async function fecharTarefaDaConversa(atendimentoId: string, passo: 'D5.04' | 'D5.05', quem: string, perfilDono?: string) {
    await banco
      .update(tarefa)
      .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
      .where(and(eq(tarefa.atendimentoId, atendimentoId), eq(tarefa.passo, passo), ...(perfilDono ? [eq(tarefa.perfilDono, perfilDono)] : []), isNull(tarefa.concluidaEm)))
  }

  /** Leva à ficha ou ao processo uma mudança conferida, com o valor de antes na lista de versões (GGVP-84 CA2, CA6, G14). */
  async function aplicar(c: Conversa, ficha: Ficha, m: Mudanca, valor: string, quem: string) {
    const casoId = m.onde === 'processo' ? (c.processoId ?? null) : null
    const doCampo = (await versoesDa(ficha.id)).filter((v) => v.casoId === casoId && v.onde === m.onde && v.campo === m.campo)
    const antes = m.onde === 'ficha' ? (ficha[m.campo as CampoDaFicha] ?? '') : ((await camposDoProcesso(ficha.id, c.processoId))?.[m.campo as CampoDoProcesso] ?? '')
    const alvo = { pessoaId: ficha.id, casoId, onde: m.onde, campo: m.campo }
    const instante = agora()
    if (!somaAoCaso(m.campo) && doCampo.length === 0) {
      await banco.insert(versaoCampo).values({ ...alvo, valor: antes, quem: 'Valor de antes da conversa', quando: new Date(c.abertaEm), origem: 'antes' })
    }
    await banco.insert(versaoCampo).values({ ...alvo, valor, quem, quando: instante, origem: 'conversa', conversaId: c.id })
    if (m.onde === 'ficha') ficha[m.campo as CampoDaFicha] = valor
    const onde = m.onde === 'ficha' ? 'na ficha' : 'no processo'
    ficha.historico.push(
      evento(
        somaAoCaso(m.campo)
            ? `Registrou ${onde}, pela conversa, o ${m.rotulo}: «${valor}»`
            : `Atualizou ${onde}, pela conversa, o ${m.rotulo}: «${valorLido(m.campo, antes)}» → «${valorLido(m.campo, valor)}»`,
        quem,
      ),
    )
  }

  /**
   * GGVP-84, GGVP-88, GGVP-111: quem fez a conversa confere na hora; só entra o que foi confirmado ou corrigido (G14); o
   * que o perfil não pode fica para quem pode (o Jurídico confere depois só isso). Telefone e e-mail só mudam com o cliente
   * verificado e em contrato novo. A etapa do processo não muda: o caso segue de onde parou.
   */
  app.post<{ Params: { id: string } }>('/api/conversas/:id/conferencia', registrar, async (pedido, resp) => {
    const entrada = Conferencia.safeParse(pedido.body)
    if (!entrada.success) return negar(resp, 400, 'Conferência inválida.')
    const conferencia = entrada.data
    const achada = await acharConversa(pedido.params.id)
    if (!achada) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    const { conversa: c, ficha, gravacao: g } = achada
    const quem = await nomeDe(pedido)
    const primeira = !c.conferidaEm
    // GGVP-158 P6.6: a primeira conferência é de quem conduziu (a do WhatsApp, do Atendimento) e responde a pendência.
    // Confirmar, corrigir ou desfazer o que a IA apontou é da Sênior (Lucas, GGVP-84), numa tarefa dela.
    const daSenior = pode(pedido.perfilAtivo, 'ficha.voltar_versao')
    if (primeira && c.quemId && pedido.usuario!.id !== c.quemId) return negar(resp, 403, `Quem confere é quem fez a conversa: ${c.quem}.`)
    if (primeira && !c.quemId && papelDaSessao(pedido.perfilAtivo) !== 'atendimento' && !daSenior) return negar(resp, 403, MSG_WHATSAPP_DO_ATENDIMENTO)
    if (conferencia.decisoes.length && !daSenior) {
      await historico(pedido.usuario!.id, 'portao_bloqueado', pedido, `pessoa:${ficha.id}`, { portao: 'conferencia_da_senior', passo: 'D5.04', perfil: pedido.perfilAtivo, conversa: c.id })
      return negar(resp, 403, MSG_DECISAO_DA_SENIOR)
    }
    if (primeira && !conferencia.pendencia) return negar(resp, 400, 'Responda "Surgiu pendência?".')
    const p = primeira && conferencia.pendencia?.surgiu ? conferencia.pendencia : undefined
    const pessoas = await pessoasDoEscritorio()
    const motivoDaPendencia = p && motivoParaNaoCriarPendencia(p, pessoas, hoje())
    if (motivoDaPendencia) return negar(resp, 400, motivoDaPendencia)
    const mudancas = c.analise?.mudancas ?? []
    const motivo = conferencia.decisoes.length
      ? motivoParaNaoConferir(mudancas, conferencia.decisoes, papelDaSessao(pedido.perfilAtivo), (c.decisoes ?? []).map((d) => d.id))
      : null
    if (motivo) return negar(resp, 400, motivo)
    if (!primeira && conferencia.decisoes.length === 0) return negar(resp, 400, 'Não há nada para conferir.')
    const daDecisao = (id: string) => mudancas.find((m) => m.id === id)!
    const valendo = conferencia.decisoes.filter((d) => d.decisao !== 'desfeita')
    // A perícia já marcada muda só pela remarcação, com a hora, o local e o limite de remarcações (épico GGVP-10, G15).
    if (valendo.some((d) => daDecisao(d.id).campo === 'pericia') && (await periciaMarcada(c.processoId))) {
      return negar(resp, 400, 'A data da perícia já marcada muda pela remarcação, na tela da perícia: desfaça este item aqui e remarque lá.')
    }
    // GGVP-158 P6.8: vale a da conversa presencial, a registrada na conversa ou a que vem no pedido. Na ligação e no
    // WhatsApp, "no escritório" não conta: só a chamada de vídeo. O contrato novo é de quem confere.
    const informada = conferencia.verificacao as Partial<Verificacao> | undefined
    const valida = (como?: Verificacao['como']) => (como === 'video' || (como === 'presencial' && c.canal === 'presencial') ? como : undefined)
    const verificacao: Partial<Verificacao> | null =
      verificacaoDaConversa(c) ?? (c.verificacao || informada ? { como: valida(c.verificacao?.como ?? informada?.como), contratoNovo: informada?.contratoNovo } : null)
    const protegidas = valendo.filter((d) => ehProtegido(daDecisao(d.id).campo))
    for (const d of protegidas) {
      const motivoDoContato = motivoParaNaoMudar(daDecisao(d.id).campo, verificacao)
      if (motivoDoContato) {
        await historico(pedido.usuario!.id, 'portao_bloqueado', pedido, `pessoa:${ficha.id}`, { portao: 'verificacao', passo: 'D5.04', perfil: pedido.perfilAtivo, conversa: c.id })
        return negar(resp, 400, motivoDoContato)
      }
    }
    const quando = agora().toISOString()
    if (protegidas.length > 0) {
      c.verificacao ??= { como: verificacao!.como!, por: quem, em: quando }
      const quais = protegidas.map((d) => CAMPOS_DA_CONVERSA[daDecisao(d.id).campo]).join(' e ')
      ficha.historico.push(evento(`Mudança de ${quais} com o cliente verificado (${COMO_VERIFICOU[verificacao!.como!].toLowerCase()}; em contrato novo)`, quem))
    }
    for (const d of conferencia.decisoes) {
      const m = daDecisao(d.id)
      if (d.decisao !== 'desfeita') await aplicar(c, ficha, m, d.decisao === 'corrigida' ? valorGuardado(m.campo, d.valor!) : m.depois, quem)
      const extraida = g?.extraidas.find((e) => e.id === d.id)
      if (extraida) extraida.conferidaEm = quando
    }
    c.decisoes = [...(c.decisoes ?? []), ...conferencia.decisoes]
    if (g && valendo.some((d) => daDecisao(d.id).onde === 'ficha') && !g.marcas.includes('ficha atualizada')) g.marcas.push('ficha atualizada')
    if (primeira) {
      c.conferidaEm = quando
      const senha = g?.extraidas.find((e) => e.destino === 'cofre')
      if (senha) senha.conferidaEm = quando
      const conta = (decisao: string) => conferencia.decisoes.filter((d) => d.decisao === decisao).length
      const processo = ficha.processos.find((x) => x.id === c.processoId)
      // A tarefa nasce no card, para o responsável escolhido (GGVP-88 CA1, CA3); sem pendência, nenhuma (CA2).
      if (p) {
        const responsavel = pessoas.find((x) => x.nome === p.responsavel)!
        c.pendencia = {
          texto: p.texto.trim(),
          responsavel: responsavel.nome,
          responsavelId: responsavel.id,
          setor: responsavel.setor,
          prazo: dataParaIso(normalizarData(p.prazo))!,
          criadaEm: quando,
        }
        // GGVP-158 P6.7: a pendência é uma linha da tarefa, da pessoa (e do caso, quando há), ligada à conversa.
        const [dono] = await banco.select({ perfis: usuario.perfis }).from(usuario).where(eq(usuario.id, responsavel.id))
        await abrirTarefaDaConversa(c, ficha.id, { passo: 'D5.05', titulo: TITULO_PENDENCIA, perfilDono: dono?.perfis[0] ?? null, responsavelId: responsavel.id, prazo: c.pendencia.prazo })
      }
      const pendencia = c.pendencia ? `pendência para ${c.pendencia.responsavel} (${c.pendencia.setor}) até ${dataCurta(c.pendencia.prazo, hoje())}: ${c.pendencia.texto}` : 'sem pendência'
      ficha.historico.push(
        evento(
          `Conferiu a conversa de hoje: ${conta('confirmada')} confirmada(s), ${conta('corrigida')} corrigida(s), ${conta('desfeita')} desfeita(s); ` +
            `${pendencia}; o caso segue de onde parou${processo ? ` (${processo.etapa})` : ''}`,
          quem,
        ),
      )
    }
    // GGVP-158 P6.6: o que a IA apontou e ninguém decidiu espera a Sênior, numa tarefa dela; decidido tudo, ela fecha. A
    // primeira conferência fecha a do Atendimento na conversa do WhatsApp.
    const decididas = new Set((c.decisoes ?? []).map((d) => d.id))
    if (mudancas.some((m) => !decididas.has(m.id))) await abrirTarefaDaConversa(c, ficha.id, { passo: 'D5.04', titulo: TITULO_CONFERIR_IA, perfilDono: 'senior' })
    else await fecharTarefaDaConversa(c.id, 'D5.04', pedido.usuario!.id, 'senior')
    if (primeira) await fecharTarefaDaConversa(c.id, 'D5.04', pedido.usuario!.id, 'atendimento')
    if (g) await guardarGravacao(g)
    await guardarConversa(c, g)
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'conversa_conferida', pedido, `pessoa:${ficha.id}`, {
      conversa: c.id,
      confirmadas: conferencia.decisoes.filter((d) => d.decisao === 'confirmada').length,
      corrigidas: conferencia.decisoes.filter((d) => d.decisao === 'corrigida').length,
      desfeitas: conferencia.decisoes.filter((d) => d.decisao === 'desfeita').length,
      // Só o nome do campo, nunca o valor (pode ser dado de saúde).
      campos: valendo.map((d) => daDecisao(d.id).campo),
      pendencia: Boolean(p),
    })
    return resposta(pedido, c, ficha, g)
  })

  /** As versões como a tela lê. */
  async function versoesParaTela(pessoaId: string): Promise<VersaoDoCampo[]> {
    return (await versoesDa(pessoaId)).map((v) => ({
      fichaId: v.pessoaId,
      ...(v.casoId && { processoId: v.casoId }),
      onde: v.onde as VersaoDoCampo['onde'],
      campo: v.campo as VersaoDoCampo['campo'],
      valor: v.valor,
      quem: v.quem,
      quando: v.quando.toISOString(),
      origem: v.origem as VersaoDoCampo['origem'],
      ...(v.conversaId && { conversaId: v.conversaId }),
    }))
  }

  // GGVP-84 CA2: as versões dos campos da ficha e dos processos dela, da mais antiga à mais nova.
  app.get<{ Params: { id: string } }>('/api/fichas/:id/versoes', ver, async (pedido, resp) => {
    if (!UUID.test(pedido.params.id)) return negar(resp, 404, MSG_FICHA_NAO_ENCONTRADA)
    return versoesParaTela(pedido.params.id)
  })

  // GGVP-84 CA2: só a Sênior volta uma versão; a volta vira versão nova, com quem e quando, e entra no histórico da ficha.
  app.post<{ Params: { id: string; campo: string } }>('/api/fichas/:id/versoes/:campo/volta', voltar, async (pedido, resp) => {
    const entrada = VoltarVersao.safeParse(pedido.body)
    const campo = CampoDaConversa.safeParse(pedido.params.campo)
    if (!entrada.success || !campo.success) return negar(resp, 400, 'Versão inválida.')
    if (somaAoCaso(campo.data)) return negar(resp, 400, 'Fato novo e documento citado somam ao caso: não têm versão para voltar.')
    const [ficha] = UUID.test(pedido.params.id) ? await fichas([pedido.params.id]) : []
    if (!ficha) return negar(resp, 404, MSG_FICHA_NAO_ENCONTRADA)
    const casoId = entrada.data.onde === 'processo' ? (entrada.data.processoId ?? null) : null
    const doCampo = (await versoesDa(ficha.id)).filter((v) => v.casoId === casoId && v.onde === entrada.data.onde && v.campo === campo.data)
    const versao = doCampo[entrada.data.versao]
    if (!versao) return negar(resp, 404, 'Versão não encontrada.')
    if (entrada.data.versao === doCampo.length - 1) return negar(resp, 400, 'Essa já é a versão em vigor.')
    const atual = doCampo.at(-1)!.valor
    const quem = await nomeDe(pedido)
    await banco.insert(versaoCampo).values({ pessoaId: ficha.id, casoId, onde: entrada.data.onde, campo: campo.data, valor: versao.valor, quem, quando: agora(), origem: 'volta' })
    if (entrada.data.onde === 'ficha') ficha[campo.data as CampoDaFicha] = versao.valor
    ficha.historico.push(
      evento(
        `Voltou o ${CAMPOS_DA_CONVERSA[campo.data]} para a versão de ${dataHoraEmBrasilia(versao.quando.toISOString())} (${versao.quem}): «${valorLido(campo.data, atual)}» → «${valorLido(campo.data, versao.valor)}»`,
        quem,
      ),
    )
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'versao_voltada', pedido, `pessoa:${ficha.id}`, { campo: campo.data, onde: entrada.data.onde })
    return versoesParaTela(ficha.id)
  })

  /** A pendência aberta da conversa; nula quando não há. */
  async function pendenciaAberta(id: string) {
    const achada = await acharConversa(id)
    const p = achada?.conversa.pendencia
    return achada && p && !p.cumpridaEm ? { ...achada, p } : null
  }

  // GGVP-88: o responsável ou a Sênior dá a pendência por cumprida; sai da Central.
  app.post<{ Params: { id: string } }>('/api/conversas/:id/pendencia/cumprida', cumprir, async (pedido, resp) => {
    const achada = await pendenciaAberta(pedido.params.id)
    if (!achada) return negar(resp, 404, 'Não há pendência aberta nesta conversa.')
    const { conversa: c, ficha, gravacao, p } = achada
    if (pedido.usuario!.id !== p.responsavelId && pedido.perfilAtivo !== 'senior') return negar(resp, 403, `A pendência é de ${p.responsavel}; a Sênior também pode dar por cumprida.`)
    const quem = await nomeDe(pedido)
    Object.assign(p, { cumpridaEm: agora().toISOString(), cumpridaPor: quem })
    await fecharTarefaDaConversa(c.id, 'D5.05', pedido.usuario!.id)
    ficha.historico.push(evento(`Cumpriu a pendência da conversa: ${p.texto}`, quem))
    await guardarConversa(c, gravacao)
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'pendencia_cumprida', pedido, `pessoa:${ficha.id}`, { conversa: c.id })
    return resposta(pedido, c, ficha, gravacao)
  })

  // GGVP-88 CA5: só a Sênior, com a pendência atrasada: um prazo novo, de hoje em diante.
  app.post<{ Params: { id: string } }>('/api/conversas/:id/pendencia/prazo', darPrazo, async (pedido, resp) => {
    const entrada = NovoPrazoDaPendencia.safeParse(pedido.body)
    const novo = entrada.success ? dataParaIso(normalizarData(entrada.data.prazo)) : null
    if (!novo || novo < hoje()) return negar(resp, 400, 'Prazo de hoje em diante (dd/mm/aaaa).')
    const achada = await pendenciaAberta(pedido.params.id)
    if (!achada) return negar(resp, 404, 'Não há pendência aberta nesta conversa.')
    const { conversa: c, ficha, gravacao, p } = achada
    const quem = await nomeDe(pedido)
    ficha.historico.push(evento(`Deu um prazo novo à pendência da conversa (${p.responsavel}): ${dataCurta(p.prazo, hoje())} → ${dataCurta(novo, hoje())}`, quem))
    p.prazo = novo
    await banco.update(tarefa).set({ prazo: novo }).where(and(eq(tarefa.atendimentoId, c.id), eq(tarefa.passo, 'D5.05'), isNull(tarefa.concluidaEm)))
    await guardarConversa(c, gravacao)
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'pendencia_novo_prazo', pedido, `pessoa:${ficha.id}`, { conversa: c.id })
    return resposta(pedido, c, ficha, gravacao)
  })

  // GGVP-158 P6.8: quem conduziu (no WhatsApp, o Atendimento) ou a Sênior registra a verificação do cliente na conversa. Na
  // ligação e no WhatsApp, só a chamada de vídeo; "no escritório" só vale na conversa presencial. A recusa fica no
  // histórico (portão da verificação).
  app.post<{ Params: { id: string } }>('/api/conversas/:id/verificacao', registrar, async (pedido, resp) => {
    const entrada = VerificacaoNaConversa.safeParse(pedido.body)
    if (!entrada.success) return negar(resp, 400, 'Diga como o cliente foi verificado: chamada de vídeo ou no escritório.')
    const achada = await acharConversa(pedido.params.id)
    if (!achada) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    const { conversa: c, ficha, gravacao: g } = achada
    const conduziu = c.quemId ? c.quemId === pedido.usuario!.id : papelDaSessao(pedido.perfilAtivo) === 'atendimento'
    if (!conduziu && !pode(pedido.perfilAtivo, 'ficha.voltar_versao')) return negar(resp, 403, `Quem registra a verificação é quem fez a conversa: ${c.quem}.`)
    if (c.canal !== 'presencial' && entrada.data.como !== 'video') {
      await historico(pedido.usuario!.id, 'portao_bloqueado', pedido, `pessoa:${ficha.id}`, { portao: 'verificacao', passo: 'D5.04', perfil: pedido.perfilAtivo, conversa: c.id })
      return negar(resp, 400, MSG_VIDEO_NA_LIGACAO)
    }
    const quem = await nomeDe(pedido)
    c.verificacao = { como: entrada.data.como, por: quem, em: agora().toISOString() }
    ficha.historico.push(evento(`Verificou o cliente na conversa: ${COMO_VERIFICOU[entrada.data.como].toLowerCase()}`, quem))
    await guardarConversa(c, g)
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'cliente_verificado', pedido, `pessoa:${ficha.id}`, { conversa: c.id, como: entrada.data.como })
    return resposta(pedido, c, ficha, g)
  })

  // GGVP-88 CA3: quem pode ficar com a pendência, num lugar só: as pessoas do escritório, com o setor.
  app.get('/api/conversas/responsaveis', ver, async () => (await pessoasDoEscritorio()).map(({ nome, setor }) => ({ nome, setor })))

  /** O que falta na conversa aberta, para a Central; nulo quando não falta nada nesta etapa. */
  function faltaNaConversa(c: Conversa, g: Gravacao | undefined): string | null {
    if (c.modo === 'arquivo' && !g) return 'subir a gravação da ligação'
    if (c.modo === 'tempo-real' && !g) return 'gravar depois do aviso (G10)'
    if (g && g.estado !== 'encerrada') return 'finalizar a conversa'
    if (!c.conferidaEm) return 'conferir a conversa (D5.04)'
    return null
  }

  // A Central de quem está no login (GGVP-76 CA8, GGVP-88 CA4, CA5). "Registrar conversa": as conversas que a pessoa
  // conduziu e ainda não conferiu. GGVP-158 P6.7: das linhas da tarefa da conversa, "Cumprir pendência", "Pendência
  // atrasada" (Sênior) e as conferências (D5.04) da Sênior e do Atendimento. Nada lê todas as conversas.
  app.get('/api/conversas/tarefas', verTarefas, async (pedido) => {
    const eu = pedido.usuario!.id
    const naSenior = pedido.perfilAtivo === 'senior'
    const doAtendimento = papelDaSessao(pedido.perfilAtivo) === 'atendimento'
    const tarefas: Tarefa[] = []
    const clienteDa = async (c: Guardada) => {
      const [ficha] = await fichas([c.fichaId])
      return ficha ? { id: ficha.id, nome: ficha.nome } : null
    }
    const minhas = await banco
      .select({ dados: atendimento.dados })
      .from(atendimento)
      .where(and(isNotNull(atendimento.dados), sql`${atendimento.dados}->>'quemId' = ${eu}`, sql`${atendimento.dados}->>'conferidaEm' is null`))
      .orderBy(asc(atendimento.inicio))
    for (const { dados } of minhas) {
      const c = dados as Guardada
      const falta = faltaNaConversa(c, c.gravacaoId ? (await acharGravacao(c.gravacaoId))?.gravacao : undefined)
      const cliente = falta ? await clienteDa(c) : null
      if (!falta || !cliente) continue
      tarefas.push({
        id: `registrar-${c.id}`,
        codigo: 'D5.01',
        cliente,
        acao: 'Registrar conversa',
        detalhe: [c.motivo ?? comQuemFalado(c), `${c.canal === 'ligacao' ? 'ligou' : 'chegou'} às ${horaEmBrasilia(new Date(c.abertaEm))}`, falta].join(' · '),
        prazo: 'hoje',
        href: `/conversas/${c.id}`,
        processoId: c.processoId,
      })
    }
    const linhas = await banco
      .select({ t: tarefa, dados: atendimento.dados })
      .from(tarefa)
      .innerJoin(atendimento, eq(tarefa.atendimentoId, atendimento.id))
      .where(and(inArray(tarefa.passo, ['D5.04', 'D5.05']), isNull(tarefa.concluidaEm)))
      .orderBy(asc(tarefa.criadoEm))
    for (const { t, dados } of linhas) {
      const c = dados as Guardada
      const comum = { href: `/conversas/${c.id}/conferir`, processoId: c.processoId }
      if (t.passo === 'D5.04') {
        const daSenior = t.perfilDono === 'senior'
        const cliente = (daSenior ? naSenior : doAtendimento) ? await clienteDa(c) : null
        if (cliente) tarefas.push({ ...comum, id: `${daSenior ? 'conferir-ia' : 'conferir-whatsapp'}-${c.id}`, codigo: 'D5.04', cliente, acao: t.titulo, detalhe: comQuemFalado(c), prazo: 'hoje' })
        continue
      }
      const p = c.pendencia
      if (!p || !t.prazo) continue
      const situacao = situacaoDaPendencia(t.prazo, hoje(), false)
      const minha = t.responsavelId === eu
      const atrasada = situacao === 'na-senior' && naSenior
      const cliente = minha || atrasada ? await clienteDa(c) : null
      if (!cliente) continue
      const prazo = dataCurta(t.prazo, hoje())
      if (minha) {
        tarefas.push({
          ...comum,
          id: `pendencia-${c.id}`,
          codigo: 'D5.05',
          cliente,
          acao: 'Cumprir pendência',
          detalhe: situacao === 'no-prazo' ? p.texto : `${p.texto} · lembrete: o prazo venceu em ${prazo}`,
          prazo: situacao === 'no-prazo' ? `vence ${prazo}` : `venceu ${prazo}`,
          urgente: situacao !== 'no-prazo',
        })
      }
      if (atrasada) {
        tarefas.push({
          ...comum,
          id: `pendencia-atrasada-${c.id}`,
          codigo: 'D5.05',
          cliente,
          acao: 'Pendência atrasada',
          detalhe: `${p.responsavel} · ${p.texto} · venceu em ${prazo} · novo prazo ou dar por cumprida`,
          prazo: 'hoje',
          urgente: true,
        })
      }
    }
    return tarefas
  })

  /**
   * GGVP-133: a transcrição de verdade da conversa, com quem conduziu no papel do escritório (Atendimento ou advogada). A
   * senha dita sai do texto (G9) e fica só a trilha. GGVP-140: a IA de verdade sugere o resumo e o que mudou; sem ela, a
   * conferência abre sem itens, com o motivo. Nada muda na ficha sem quem conversou conferir (G14). Diz se ficou pronta e
   * se a senha foi dita.
   */
  async function transcreverDeVerdade(c: Guardada, ficha: Ficha, g: Gravacao, quemId: string | null) {
    await transcreverGravacao(real!, g, ficha, quemId, c.papel === 'juridico' ? 'advogada' : 'atendimento')
    const pronta = g.transcricao === 'pronta'
    let senhaDita = false
    if (pronta) {
      senhaDita = g.trechos.some((t) => t.texto.includes(SENHA_RETIRADA))
      g.documentos = []
      const lida = await lerComIa(c, ficha, g, quemId)
      const semIa = real!.ia.saudeAutorizada ? MSG_IA_SEM_ANALISE : MSG_IA_SEM_SAUDE_NA_CONVERSA
      const analise = await montarAnalise(c, ficha, g, { ditos: lida?.ditos ?? [], senhaDita, pendencia: lida?.combinado, aviso: lida ? undefined : semIa })
      c.analise = lida ? { ...analise, daIa: lida.daIa } : analise
      ficha.historico.push(evento('A transcrição da conversa ficou pronta: está nas Transcrições do card', 'Sistema (IA)'))
    }
    await guardarGravacao(g)
    await guardarConversa(c, g)
    await guardar(ficha)
    return { pronta, senhaDita }
  }

  // GGVP-133 CA4: o texto ao vivo é só da conversa no escritório, gravada agora; na ligação, não. A chave temporária vem
  // daqui; a de verdade fica no servidor.
  app.post<{ Params: { id: string } }>('/api/conversas/:id/chave-ao-vivo', registrar, async (pedido, resp) => {
    const achada = await acharConversa(pedido.params.id)
    if (!achada) return negar(resp, 404, MSG_CONVERSA_NAO_ENCONTRADA)
    const { conversa: c, gravacao: g } = achada
    if (c.modo !== 'tempo-real' || c.canal !== 'presencial' || !g || (g.estado !== 'gravando' && g.estado !== 'pausada'))
      return negar(resp, 400, 'O texto ao vivo é só da conversa no escritório, gravada agora.')
    const chave = ia && (await chaveDaGravacao(banco, ia, g, pedido.usuario!.id))
    if (!chave) return negar(resp, 503, MSG_SEM_AO_VIVO)
    return ChaveAoVivo.parse(chave)
  })

  // GGVP-158 P6.5: a conversa do WhatsApp. Uma por pessoa enquanto as mensagens vêm; 30 minutos sem mensagem nova, ela
  // fecha, a IA lê (como a transcrição; sem a IA, com o motivo) e nasce a conferência do Atendimento.

  /** A pessoa do telefone, com e sem o nono dígito: a do nome do contato; depois, o cliente antes do lead; depois, a mais nova. */
  async function pessoaDoTelefone(telefone: string, nome: string) {
    const formas = [telefone]
    if (telefone.length === 11 && telefone[2] === '9') formas.push(telefone.slice(0, 2) + telefone.slice(3))
    if (telefone.length === 10 && '6789'.includes(telefone[2])) formas.push(`${telefone.slice(0, 2)}9${telefone.slice(2)}`)
    const achadas = await banco
      .select({ id: pessoa.id, nome: pessoa.nome, situacao: pessoa.situacao })
      .from(pessoa)
      .where(inArray(pessoa.telefone, formas))
      .orderBy(desc(pessoa.criadoEm))
    const doNome = achadas.filter((p) => semAcento(p.nome) === semAcento(nome))
    const lista = doNome.length ? doNome : achadas
    return lista.find((p) => p.situacao === 'cliente') ?? lista[0] ?? null
  }

  /** O lead do número novo, com o nome do contato quando é nome (sem emoji nem número), como o do balcão. */
  async function leadDoWhatsapp(telefone: string, contato: string): Promise<string> {
    const nome = validarNome(contato) ? normalizarNome(contato) : 'Contato do WhatsApp'
    const [p] = await banco.insert(pessoa).values({ nome, telefone, situacao: 'lead' }).returning({ id: pessoa.id })
    const [ano, mes] = hoje().split('-')
    const ficha: Ficha = {
      id: p.id,
      situacao: 'lead',
      desde: `${mes}/${ano}`,
      nome,
      telefone,
      resumo: 'lead',
      senhaGov: { situacao: 'sem-senha' },
      fichaAtendimentoPreenchida: false,
      processos: [],
      agendamentos: [],
      contatos: [],
      documentos: [],
      arquivos: [],
      transcricoes: 0,
      historico: [evento('Criou a ficha pelo WhatsApp (lead), com a mensagem que chegou', QUEM_NO_WHATSAPP)],
    }
    await guardar(ficha)
    return p.id
  }

  /** A conversa do WhatsApp ainda aberta da pessoa, com a gravação; nula quando não há. */
  async function whatsappAberto(pessoaId: string) {
    const [linha] = await banco
      .select({ id: atendimento.id })
      .from(atendimento)
      .where(and(eq(atendimento.pessoaId, pessoaId), eq(atendimento.canal, 'whatsapp'), isNull(atendimento.fim), isNotNull(atendimento.dados)))
      .orderBy(desc(atendimento.inicio))
      .limit(1)
    const achada = linha && (await acharConversa(linha.id))
    return achada && achada.gravacao ? { conversa: achada.conversa as Guardada, gravacao: achada.gravacao } : null
  }

  function abrirWhatsapp(ficha: Ficha, quando: Date): { conversa: Guardada; gravacao: Gravacao } {
    const conversa: Guardada = {
      id: randomUUID(),
      fichaId: ficha.id,
      processoId: ficha.processos[0]?.id,
      canal: 'whatsapp',
      comQuem: 'cliente',
      modo: 'escrito',
      quem: QUEM_NO_WHATSAPP,
      quemId: null,
      papel: 'atendimento',
      abertaEm: quando.toISOString(),
    }
    const gravacao: Gravacao = {
      id: `gravacao-${randomUUID()}`,
      fichaId: ficha.id,
      data: hoje(),
      titulo: 'WhatsApp · cliente',
      canal: 'WhatsApp',
      participantes: [QUEM_NO_WHATSAPP, ficha.nome],
      duracao: 0,
      origem: 'registro',
      estado: 'gravando',
      acoes: [],
      transcricao: 'pronta',
      trechos: [],
      extraidas: [],
      documentos: [],
      soJuridico: false,
      marcas: [],
      conversaId: conversa.id,
    }
    conversa.gravacaoId = gravacao.id
    ficha.historico.push(evento('Chegou mensagem pelo WhatsApp: a conversa do WhatsApp abriu', QUEM_NO_WHATSAPP))
    return { conversa, gravacao }
  }

  /** Fecha a conversa do WhatsApp parada: a IA lê o texto, como a transcrição (sem ela, com o motivo), e nasce a conferência. */
  async function fecharWhatsapp(c: Guardada, ficha: Ficha, g: Gravacao) {
    const duracao = g.trechos.at(-1)?.aos ?? 0
    Object.assign(g, { estado: 'encerrada', duracao })
    c.finalizadaEm = new Date(new Date(c.abertaEm).getTime() + duracao * 1000).toISOString()
    const lida = real ? await lerComIa(c, ficha, g, null) : null
    const semIa = real && !real.ia.saudeAutorizada ? MSG_IA_SEM_SAUDE_NA_CONVERSA : MSG_IA_SEM_ANALISE
    const senhaDita = g.trechos.some((t) => t.texto.includes(SENHA_RETIRADA))
    const analise = await montarAnalise(c, ficha, g, { ditos: lida?.ditos ?? [], senhaDita, pendencia: lida?.combinado, aviso: lida ? undefined : semIa })
    c.analise = lida ? { ...analise, daIa: lida.daIa } : analise
    ficha.historico.push(evento('A conversa do WhatsApp fechou: está nas Transcrições do card, para conferir', QUEM_NO_WHATSAPP))
    await guardarGravacao(g)
    await guardarConversa(c, g)
    await guardar(ficha)
    await abrirTarefaDaConversa(c, ficha.id, { passo: 'D5.04', titulo: TITULO_CONFERIR_WHATSAPP, perfilDono: 'atendimento' })
  }

  // ponytail: uma mensagem de cada vez, no servidor inteiro, para duas que chegam juntas não abrirem duas conversas; por
  // pessoa, se o volume pedir.
  let fila: Promise<unknown> = Promise.resolve()
  /** A mensagem do WhatsApp na conversa da pessoa do telefone; a resposta do escritório a um número sem ficha não cria lead. */
  function receberDoWhatsapp(m: MensagemDoWhatsapp): Promise<void> {
    const vez = fila.then(async () => {
      const achada = await pessoaDoTelefone(m.telefone, m.nome)
      if (!achada && m.papel !== 'cliente') return
      const pessoaId = achada?.id ?? (await leadDoWhatsapp(m.telefone, m.nome))
      const [ficha] = await fichas([pessoaId])
      if (!ficha) return
      let aberta = await whatsappAberto(pessoaId)
      // O Chatwoot repetiu o aviso: a mensagem já entrou.
      if (m.chatwootId !== null && aberta?.conversa.chatwoot?.includes(m.chatwootId)) return
      if (aberta && m.quando.getTime() - new Date(aberta.conversa.ultimaEm ?? aberta.conversa.abertaEm).getTime() > PARADA_DO_WHATSAPP_MS) {
        await fecharWhatsapp(aberta.conversa, ficha, aberta.gravacao)
        aberta = null
      }
      const nova = !aberta
      const { conversa: c, gravacao: g } = aberta ?? abrirWhatsapp(ficha, m.quando)
      if (nova) {
        await banco.insert(atendimento).values({ id: c.id, pessoaId: ficha.id, casoId: c.processoId ?? null, canal: 'whatsapp', inicio: m.quando, dados: c })
      }
      // G9: a senha mandada por mensagem sai do texto e não fica guardada.
      const aos = Math.max(0, Math.round((m.quando.getTime() - new Date(c.abertaEm).getTime()) / 1000))
      const quem = m.papel === 'cliente' ? ficha.nome : 'Escritório (WhatsApp)'
      g.trechos.push(...tirarSenhas([{ aos, quem, papel: m.papel === 'cliente' ? 'cliente' : 'atendimento', texto: m.texto }]))
      if (m.chatwootId !== null) c.chatwoot = [...(c.chatwoot ?? []), m.chatwootId]
      c.ultimaEm = m.quando.toISOString()
      await guardarGravacao(g)
      await guardarConversa(c, g)
      if (nova) await guardar(ficha)
    })
    fila = vez.catch(() => undefined)
    return vez
  }

  // GGVP-158 P6.5: com a IA, a rodada do preparo (a cada 5 minutos) fecha a conversa do WhatsApp parada há 30 minutos.
  if (preparo)
    preparo.registrar(
      async () =>
        (
          await banco
            .select({ dados: atendimento.dados })
            .from(atendimento)
            .where(and(eq(atendimento.canal, 'whatsapp'), isNull(atendimento.fim), isNotNull(atendimento.dados)))
        ).flatMap(({ dados }) => {
          const c = dados as Guardada
          return agora().getTime() - new Date(c.ultimaEm ?? c.abertaEm).getTime() > PARADA_DO_WHATSAPP_MS ? [c.id] : []
        }),
      async (id) => {
        const achada = await acharConversa(id)
        if (!achada?.gravacao || achada.conversa.finalizadaEm) return
        await fecharWhatsapp(achada.conversa as Guardada, achada.ficha, achada.gravacao)
      },
    )

  // GGVP-133: o preparo em segundo plano (a cada 5 minutos) transcreve as conversas com áudio de verdade que esperam.
  if (real && preparo)
    preparo.registrar(
      async () =>
        (await gravacoes(true)).flatMap((g) =>
          g.conversaId && g.estado === 'encerrada' && g.transcricao === 'transcrevendo' && g.audio?.documentos?.length ? [g.conversaId] : [],
        ),
      async (conversaId) => {
        const achada = await acharConversa(conversaId)
        if (!achada?.gravacao || achada.gravacao.transcricao !== 'transcrevendo') return
        await transcreverDeVerdade(achada.conversa, achada.ficha, achada.gravacao, null)
      },
    )
  return { receberDoWhatsapp }
}
