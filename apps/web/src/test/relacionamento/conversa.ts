// SÓ PARA OS TESTES (GGVP-138). O antigo servidor de exemplo, agora o servidor falso das telas nos testes, com a semente.
// Era: Servidor de exemplo da conversa com o lead ou o cliente (fluxo D5, GGVP-12), sobre o mesmo banco de servidor.ts.
// A gravação é a mesma da entrevista (GGVP-40): uma Gravacao em banco.gravacoes, com as mesmas ações (registrarAcao) e o
// mesmo cofre, e a transcrição usa o mesmo motor (montarTranscricao). Sem microfone e sem OpenAI: a conversa é a de
// exemplo. Nada aqui apaga áudio (Q11, Lucas 06/10). Ligar no servidor: trocar o corpo de cada função por fetch no
// endpoint da design.md (change ggvp-12).
import { dataParaIso, normalizarData } from '../../campos.ts'
import { dataCurta, dataHora, hojeIso, hora } from '../../regras/datas.ts'
import {
  CAMPOS_DA_CONVERSA,
  CANAIS_DO_REGISTRO,
  COM_QUEM,
  motivoParaNaoAbrir,
  papelDoPerfil,
  motivoParaNaoConferir,
  motivoParaNaoCriarPendencia,
  oQueMudou,
  oQuePrecisaAtualizar,
  podeVoltarVersao,
  situacaoDaPendencia,
  valorGuardado,
  valorLido,
  type CampoDaFicha,
  type DecisaoDaMudanca,
  type VersaoDoCampo,
  type CampoDoProcesso,
  type CanalDoRegistro,
  type ComQuem,
  type Dito,
  type ModoDoRegistro,
  type Mudanca,
  type Pessoa,
  type PapelNaConversa,
} from '../../regras/conversa.ts'
import { ehAudio, minutos, partesDoAudio, tirarSenhas } from '../../regras/entrevista.ts'
import { COMO_VERIFICOU, ehProtegido, motivoParaNaoMudar, verificacaoDaConversa, type Verificacao } from '../../regras/seguranca.ts'
import { BYTES_POR_SEGUNDO, montarTranscricao } from '../../dados/entrevista.ts'
import { dataDaPericia } from '../../dados/pericia.ts'
import type { IdPerfil } from '../../dados/perfis.ts'
import { falasDaConversa, type FalaDaConversa } from '../../dados/conversaSimulada.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from '../../dados/servidor.ts'
import type { Ficha, Gravacao, Setor, Tarefa } from '../../dados/tipos.ts'

/** A conversa do D5: quem conduziu, o canal, com quem e como foi registrada. Espelho do Zod da design.md. */
export type Conversa = {
  id: string
  fichaId: string
  /** Lead sem processo: a conversa fica na ficha dele, que é a mesma tela do cliente (Lucas, 06/10). */
  processoId?: string
  canal: CanalDoRegistro
  comQuem: ComQuem
  modo: ModoDoRegistro
  /** Quem conduziu e registrou: o nome do perfil. */
  quem: string
  papel: PapelNaConversa
  /** Data e hora ISO. */
  abertaEm: string
  /** A gravação (o mesmo motor da entrevista) ou o registro sem áudio, em banco.gravacoes. */
  gravacaoId?: string
  /** O registro escrito, sem áudio. */
  registro?: string
  /** Data e hora ISO em que a conversa foi finalizada (gravada, anexada ou escrita). */
  finalizadaEm?: string
  /** O que a pessoa contou ao abrir, para a Central (a ligação da semente). */
  motivo?: string
  /** O que a IA achou na conversa transcrita (GGVP-80). */
  analise?: AnaliseDaConversa
  /** A conferência de quem conversou, na hora (GGVP-84), e a do Jurídico no que só ele pode. */
  decisoes?: DecisaoDaMudanca[]
  /** Data e hora ISO da conferência de quem conversou; depois dela, o caso segue de onde parou. */
  conferidaEm?: string
  /** O que ficou pendente e virou tarefa no card (GGVP-88). Sem ela, não surgiu pendência. */
  pendencia?: Pendencia
}

/** O quadro da IA depois de transcrever: o que mudou, o que precisa atualizar, a observação e o combinado (GGVP-80). */
export type AnaliseDaConversa = { mudancas: Mudanca[]; atualizar: Dito['onde'][]; observacao: string; pendencia?: string }

/**
 * Os campos do processo que a conversa compara (GGVP-80, CA5). Até a página do processo existir (GGVP-86), vêm daqui:
 * a perícia da Maria Exemplo, marcada para 02/10.
 */
const CAMPOS_DO_PROCESSO_DE_EXEMPLO: Record<string, Partial<Record<CampoDoProcesso, string>>> = { 'maria-exemplo-1': { pericia: '2026-10-02' } }

/** Os campos do processo em vigor: a semente e, por cima, a última versão de cada um (GGVP-84). */
function camposDoProcesso(banco: Banco, processoId: string | undefined): Partial<Record<CampoDoProcesso, string>> | null {
  if (!processoId) return null
  const campos = { ...CAMPOS_DO_PROCESSO_DE_EXEMPLO[processoId] }
  for (const v of banco.versoes ?? []) if (v.processoId === processoId) campos[v.campo as CampoDoProcesso] = v.valor
  // A data marcada na tela da perícia (épico GGVP-10) é a que vale: uma fonte só.
  const marcada = dataDaPericia(banco, processoId)
  if (marcada) campos.pericia = marcada
  return campos
}

/** O que a tela pede ao abrir a conversa (Figma 2144:2). */
export type NovaConversa = { canal: CanalDoRegistro; comQuem: ComQuem; modo: ModoDoRegistro; processoId?: string; registro?: string }

/** O áudio da ligação já feita, com a confirmação de que ele começa com o aviso de gravação (G10). */
export type AudioDaLigacao = { nome: string; tipo: string; tamanho: number; avisoNaGravacao: true }

/** Quem age na tela: o nome e o perfil do "Trocar perfil". Ao ligar no servidor, vem da sessão. */
export type QuemAge = { quem: string; perfil: IdPerfil | undefined }

export type ConversaAberta = { conversa: Conversa; ficha: Ficha; gravacao?: Gravacao }

// A fala simulada da conversa fica num arquivo só dela, que o servidor também lê (GGVP-138).
export { falasDaConversa, type FalaDaConversa }


/** A ligação de hoje do Pedro Exemplo, esperando a gravação subir: a tarefa "Registrar conversa" da Central (CA8). */
export function conversasDeExemplo(hoje: string): Conversa[] {
  return [
    {
      id: 'conversa-pedro-ligacao',
      fichaId: 'pedro-exemplo',
      processoId: 'pedro-exemplo-1',
      canal: 'ligacao',
      comQuem: 'cliente',
      modo: 'arquivo',
      quem: 'Ana (exemplo)',
      papel: 'atendimento',
      abertaEm: new Date(`${hoje}T09:15:00`).toISOString(),
      motivo: 'ligou com informação nova sobre a exigência do INSS',
    },
  ]
}

function conversasDo(banco: Banco): Conversa[] {
  banco.conversas ??= conversasDeExemplo(hojeIso(agora()))
  return banco.conversas
}

function acharConversa(banco: Banco, conversaId: string): { conversa: Conversa; ficha: Ficha; gravacao?: Gravacao } {
  const conversa = conversasDo(banco).find((c) => c.id === conversaId)
  const ficha = banco.fichas.find((f) => f.id === conversa?.fichaId)
  if (!conversa || !ficha) throw new Error('Conversa não encontrada')
  return { conversa, ficha, gravacao: banco.gravacoes.find((g) => g.id === conversa.gravacaoId) }
}

function interlocutor(ficha: Ficha, comQuem: ComQuem): string {
  return comQuem === 'cliente' ? ficha.nome : COM_QUEM[comQuem].toLowerCase()
}

/** GET /api/conversas/:id. Nulo quando a conversa não existe. */
export async function obterConversa(conversaId: string): Promise<ConversaAberta | null> {
  try {
    return acharConversa(ler(), conversaId)
  } catch {
    return null
  }
}

function novaGravacao(banco: Banco, ficha: Ficha, c: Conversa, origem: Gravacao['origem']): Gravacao {
  banco.seq += 1
  return {
    id: `gravacao-${banco.seq}`,
    fichaId: ficha.id,
    data: hojeIso(agora()),
    titulo: `${CANAIS_DO_REGISTRO[c.canal].rotulo} · ${COM_QUEM[c.comQuem].toLowerCase()}`,
    canal: c.canal === 'ligacao' ? 'ligação' : 'presencial',
    // Quem registrou vem primeiro (CA7).
    participantes: [c.quem, interlocutor(ficha, c.comQuem)],
    duracao: 0,
    origem,
    estado: 'gravando',
    acoes: [],
    transcricao: 'transcrevendo',
    trechos: [],
    extraidas: [],
    documentos: [],
    // Como o servidor: o que a conversa registrou não é dado de saúde (Pedro, 08/10).
    soJuridico: false,
    marcas: [],
    conversaId: c.id,
  }
}

const comQuemFalado = (c: Conversa) => `${CANAIS_DO_REGISTRO[c.canal].rotulo.toLowerCase()}, com ${COM_QUEM[c.comQuem].toLowerCase()}`

/**
 * POST /api/fichas/:id/conversas. Abre a conversa no card do lead ou do cliente (CA3, CA4, CA9). Só escrita, já fica
 * registrada como "só registro" (GGVP-80, CA9). O servidor confere de novo o perfil e os campos.
 */
export async function abrirConversa(fichaId: string, pedido: NovaConversa, por: QuemAge): Promise<Conversa> {
  await esperar()
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const papel = papelDoPerfil(por.perfil)
  const motivo = motivoParaNaoAbrir(pedido, papel, ficha.processos.map((p) => p.id))
  if (motivo) throw new Error(motivo)
  banco.seq += 1
  const conversa: Conversa = {
    id: `conversa-${banco.seq}`,
    fichaId,
    processoId: pedido.processoId ?? ficha.processos[0]?.id,
    canal: pedido.canal,
    comQuem: pedido.comQuem,
    modo: pedido.modo,
    quem: por.quem,
    papel: papel!,
    abertaEm: agora().toISOString(),
  }
  conversasDo(banco).push(conversa)
  if (pedido.modo === 'escrito') {
    const g = novaGravacao(banco, ficha, conversa, 'registro')
    Object.assign(g, { estado: 'encerrada', transcricao: 'sem-audio', registro: pedido.registro!.trim() })
    banco.gravacoes.push(g)
    Object.assign(conversa, { gravacaoId: g.id, registro: g.registro, finalizadaEm: conversa.abertaEm })
    ficha.historico.push(evento(`Registrou a conversa sem áudio (${comQuemFalado(conversa)}): só registro`, por.quem))
  } else {
    const falta = pedido.modo === 'arquivo' ? 'falta subir a gravação da ligação' : 'grava depois do aviso (G10)'
    ficha.historico.push(evento(`Abriu a conversa (${comQuemFalado(conversa)}): ${falta}`, por.quem))
  }
  gravar(banco)
  return conversa
}

/** POST /api/conversas/:id/gravacao. Só grava com o aviso registrado, com a hora (CA1, CA5, G10). */
export async function gravarConversa(conversaId: string, inicio: { avisei: true }): Promise<Gravacao> {
  await esperar()
  if (inicio.avisei !== true) throw new Error('Avise que a conversa será gravada antes de gravar (G10).')
  const banco = ler()
  const { conversa, ficha, gravacao } = acharConversa(banco, conversaId)
  if (conversa.modo !== 'tempo-real') throw new Error('Esta conversa não é gravada agora.')
  // Clique duplo ou página recarregada: a mesma gravação.
  if (gravacao) return gravacao
  const g = novaGravacao(banco, ficha, conversa, 'portal')
  g.avisoEm = agora().toISOString()
  g.acoes.push({ acao: 'avisou', quando: g.avisoEm, aos: 0 }, { acao: 'gravou', quando: g.avisoEm, aos: 0 })
  banco.gravacoes.push(g)
  conversa.gravacaoId = g.id
  ficha.historico.push(evento(`Avisou às ${hora(g.avisoEm)} que a conversa seria gravada (G10) e começou a gravar`, conversa.quem))
  gravar(banco)
  return g
}

function guardarNoCard(ficha: Ficha, g: Gravacao, nome: string, tamanho: number) {
  g.estado = 'encerrada'
  g.audio = { nome, formato: nome.split('.').at(-1)?.toLowerCase() ?? '', tamanho, partes: partesDoAudio(tamanho) }
  g.transcricao = 'transcrevendo'
  ficha.transcricoes += 1
}

/** POST /api/conversas/:id/finalizar. O áudio fica no card do lead ou cliente e vai para a transcrição (CA6, CA9). */
export async function finalizarConversa(conversaId: string, fim: { aos: number }): Promise<ConversaAberta> {
  await esperar()
  const banco = ler()
  const { conversa, ficha, gravacao: g } = acharConversa(banco, conversaId)
  if (!g) throw new Error('Grave a conversa antes de finalizar.')
  if (g.estado === 'encerrada') return { conversa, ficha, gravacao: g }
  g.acoes.push({ acao: 'encerrou', quando: agora().toISOString(), aos: fim.aos })
  g.duracao = Math.max(g.duracao, fim.aos)
  guardarNoCard(ficha, g, `conversa-${ficha.id}-${g.data}.webm`, g.duracao * BYTES_POR_SEGUNDO)
  conversa.finalizadaEm = agora().toISOString()
  ficha.historico.push(evento(`Finalizou a conversa gravada (${minutos(g.duracao)}); o áudio ficou no card e foi para a transcrição`, conversa.quem))
  gravar(banco)
  return { conversa, ficha, gravacao: g }
}

/** POST /api/conversas/:id/sem-audio (GGVP-133). Sem microfone, quem conversou escreve o que foi conversado: "só registro". */
export async function registrarSemAudio(conversaId: string, notas: string): Promise<ConversaAberta> {
  await esperar()
  if (notas.trim().length < 3) throw new Error('Escreva o que foi conversado.')
  const banco = ler()
  const { conversa, ficha, gravacao: g } = acharConversa(banco, conversaId)
  if (!g) throw new Error('Grave a conversa antes.')
  if (g.estado === 'encerrada') return { conversa, ficha, gravacao: g }
  g.acoes.push({ acao: 'sem-audio', quando: agora().toISOString(), aos: g.duracao })
  Object.assign(g, { estado: 'encerrada', transcricao: 'sem-audio', registro: notas.trim() })
  Object.assign(conversa, { registro: notas.trim(), finalizadaEm: agora().toISOString() })
  ficha.historico.push(evento(`Registrou a conversa sem áudio (${comQuemFalado(conversa)}): o microfone não gravou`, conversa.quem))
  gravar(banco)
  return { conversa, ficha, gravacao: g }
}

/** POST /api/conversas/:id/audio. A ligação já feita sobe gravada, de qualquer formato e tamanho, com o aviso nela (CA2, G10). */
export async function anexarAudio(conversaId: string, arquivo: AudioDaLigacao): Promise<ConversaAberta> {
  await esperar()
  if (arquivo.avisoNaGravacao !== true) throw new Error('Confirme que a ligação começou com o aviso de gravação (G10).')
  if (!ehAudio(arquivo) || arquivo.tamanho < 1) throw new Error('Esse arquivo não é de áudio.')
  const banco = ler()
  const { conversa, ficha, gravacao } = acharConversa(banco, conversaId)
  if (conversa.modo !== 'arquivo') throw new Error('Esta conversa não espera um áudio.')
  if (gravacao) return { conversa, ficha, gravacao }
  const g = novaGravacao(banco, ficha, conversa, 'arquivo')
  g.acoes.push({ acao: 'subiu-arquivo', quando: agora().toISOString(), aos: 0 })
  guardarNoCard(ficha, g, arquivo.nome, arquivo.tamanho)
  banco.gravacoes.push(g)
  Object.assign(conversa, { gravacaoId: g.id, finalizadaEm: agora().toISOString() })
  ficha.historico.push(evento(`Subiu a gravação da ligação (${arquivo.nome}); o áudio ficou no card e foi para a transcrição`, conversa.quem))
  gravar(banco)
  return { conversa, ficha, gravacao: g }
}

const comMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/**
 * A IA simulada depois da transcrição (GGVP-80): extrai o que foi dito; a comparação com a ficha e o processo é código
 * (`oQueMudou`). A senha dita sai do texto e vai para o cofre, só a trilha (G9). Nada muda na ficha aqui: só depois de
 * conferido por quem conversou (G14).
 */
function analisar(banco: Banco, c: Conversa, ficha: Ficha, g: Gravacao, ditas: FalaDaConversa[]): AnaliseDaConversa {
  const ditos = ditas.flatMap((f) => (f.diz ?? []).map((d) => ({ ...d, aos: f.aos, trecho: tirarSenhas([f])[0].texto })))
  const mudancas = oQueMudou(ditos, ficha, camposDoProcesso(banco, c.processoId))
  const saude = mudancas.some((m) => m.saude)
  const senhaDita = ditas.some((f) => f.senha)
  const pendencia = ditas.find((f) => f.combinado)?.combinado
  if (senhaDita) ficha.historico.push(evento('A senha do gov.br foi dita na conversa: saiu da transcrição e não ficou guardada; para o cofre, o cliente digita (G9)', 'Sistema (IA)'))
  const cofre = senhaDita || g.acoes.some((a) => a.acao === 'guardou-senha')
  g.extraidas = [
    ...mudancas.map((m) => ({ id: m.id, rotulo: comMaiuscula(m.rotulo), valor: valorLido(m.campo, m.depois), destino: m.onde })),
    ...(cofre
      ? [{ id: 'senha', rotulo: 'Senha do gov.br', valor: `${senhaDita ? 'dita na conversa' : 'digitada no cofre'}: não consta na transcrição (G9)`, destino: 'cofre' as const }]
      : []),
  ]
  const oQue = mudancas.map((m) => m.rotulo)
  g.resumo = `${comMaiuscula(comQuemFalado(c))}: ${oQue.length ? oQue.join(', ') : 'nada muda na ficha nem no processo'}.${pendencia ? ` Combinado: ${pendencia}` : ''}`
  // Tudo fica no histórico do contato (GGVP-76, CA9).
  ficha.contatos.push({ data: hojeIso(agora()), canal: `${CANAIS_DO_REGISTRO[c.canal].rotulo} (gravada, G10)`, texto: g.resumo })
  const observacao = [
    senhaDita && 'A senha do gov.br foi dita em voz alta: saiu da transcrição (G9). Para o cofre, o cliente digita.',
    saude && 'Tem fato novo de saúde: quem confirma é o Jurídico.',
    c.comQuem !== 'cliente' && 'Quem falou não foi o cliente: confira antes de mudar dado de contato.',
  ]
    .filter(Boolean)
    .join(' ')
  return { mudancas, atualizar: oQuePrecisaAtualizar(mudancas), observacao: observacao || 'Nada fora do comum na conversa.', pendencia }
}

/**
 * POST /api/conversas/:id/transcricao. A OpenAI simulada, com o mesmo motor da entrevista: as falas da conversa de
 * exemplo, nas partes do áudio, com quem fala e sem senha (G9). `falhar` simula a falha; chamar de novo tenta outra vez.
 */
export async function transcreverConversa(conversaId: string, opcoes: { falhar?: boolean } = {}): Promise<ConversaAberta> {
  await esperar()
  const banco = ler()
  const { conversa, ficha, gravacao: g } = acharConversa(banco, conversaId)
  if (!g || g.estado !== 'encerrada' || (g.transcricao !== 'transcrevendo' && g.transcricao !== 'falhou')) return { conversa, ficha, gravacao: g }
  if (opcoes.falhar) {
    g.transcricao = 'falhou'
    g.motivoDaFalha = 'o serviço de transcrição não respondeu'
  } else {
    const { trechos, ditas } = montarTranscricao(g, falasDaConversa(ficha, conversa))
    g.trechos = trechos
    g.transcricao = 'pronta'
    g.motivoDaFalha = undefined
    conversa.analise = analisar(banco, conversa, ficha, g, ditas)
    // O texto fica no card, nas Transcrições, com acesso por perfil; o histórico só registra o fato (GGVP-80, CA1).
    ficha.historico.push(evento('A transcrição da conversa ficou pronta: está nas Transcrições do card', 'Sistema (IA)'))
  }
  gravar(banco)
  return { conversa, ficha, gravacao: g }
}

/** O que falta na conversa aberta, para a Central; nulo quando não falta nada nesta etapa. */
function faltaNaConversa(c: Conversa, g: Gravacao | undefined): string | null {
  if (c.modo === 'arquivo' && !g) return 'subir a gravação da ligação'
  if (c.modo === 'tempo-real' && !g) return 'gravar depois do aviso (G10)'
  if (g && g.estado !== 'encerrada') return 'finalizar a conversa'
  if (!c.conferidaEm) return 'conferir a conversa (D5.04)'
  return null
}

/** "nome · Registrar conversa" para quem abriu a conversa e não terminou (CA8). */
export function tarefasDeRegistrarConversa(usuario: string | undefined): Tarefa[] {
  const banco = ler()
  return conversasDo(banco)
    .filter((c) => c.quem === usuario)
    .flatMap((c) => {
      const ficha = banco.fichas.find((f) => f.id === c.fichaId)
      const falta = faltaNaConversa(c, banco.gravacoes.find((g) => g.id === c.gravacaoId))
      if (!ficha || !falta) return []
      return [
        {
          id: `registrar-${c.id}`,
          codigo: 'D5.01',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Registrar conversa',
          detalhe: [c.motivo ?? comQuemFalado(c), `${c.canal === 'ligacao' ? 'ligou' : 'chegou'} às ${hora(c.abertaEm)}`, falta].join(' · '),
          prazo: 'hoje',
          href: `/conversas/${c.id}`,
          processoId: c.processoId,
        },
      ]
    })
}

/** A conversa de uma gravação: as Transcrições levam à conferência dela, em vez de "Conferir e levar" (GGVP-80, CA6). */
export function conversaDaGravacao(gravacaoId: string): string | undefined {
  return ler().conversas?.find((c) => c.gravacaoId === gravacaoId)?.id
}

// GGVP-84 · Atualizar ficha e processo com desfazer.

/** "Surgiu pendência?" (GGVP-88): o combinado, quem fica com a tarefa (nunca presumido) e o prazo (dd/mm/aaaa). */
export type NovaPendencia = { surgiu: false } | { surgiu: true; texto: string; responsavel: string; prazo: string }

/** A pendência que virou tarefa no card (GGVP-88). */
export type Pendencia = {
  texto: string
  responsavel: string
  setor: Setor
  /** aaaa-mm-dd */
  prazo: string
  criadaEm: string
  cumpridaEm?: string
  cumpridaPor?: string
}

/** O que a tela manda ao conferir: a decisão de cada mudança e, na conferência de quem conversou, a pendência. */
export type Conferencia = {
  decisoes: DecisaoDaMudanca[]
  pendencia?: NovaPendencia
  /** Como quem conversou confirmou que é o cliente, para mudar telefone ou e-mail (GGVP-111, CA1). */
  verificacao?: Partial<Verificacao>
}

type Alvo = Pick<VersaoDoCampo, 'fichaId' | 'processoId' | 'onde' | 'campo'>

const mesmoCampo = (v: Alvo, a: Alvo) => v.fichaId === a.fichaId && v.processoId === a.processoId && v.onde === a.onde && v.campo === a.campo

/** Fato novo e documento citado somam ao caso: não têm versão anterior nem volta. */
const somaAoCaso = (campo: VersaoDoCampo['campo']) => campo === 'fato' || campo === 'documento'

/** Leva à ficha ou ao processo uma mudança conferida, com o valor de antes na lista de versões (CA2, CA6, G14). */
function aplicar(banco: Banco, c: Conversa, ficha: Ficha, m: Mudanca, valor: string, quem: string) {
  const alvo: Alvo = { fichaId: ficha.id, processoId: m.onde === 'processo' ? c.processoId : undefined, onde: m.onde, campo: m.campo }
  const versoes = (banco.versoes ??= [])
  const antes = m.onde === 'ficha' ? (ficha[m.campo as CampoDaFicha] ?? '') : (camposDoProcesso(banco, c.processoId)?.[m.campo as CampoDoProcesso] ?? '')
  if (!somaAoCaso(m.campo) && !versoes.some((v) => mesmoCampo(v, alvo))) {
    versoes.push({ ...alvo, valor: antes, quem: 'Valor de antes da conversa', quando: c.abertaEm, origem: 'antes' })
  }
  versoes.push({ ...alvo, valor, quem, quando: agora().toISOString(), origem: 'conversa', conversaId: c.id })
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
 * POST /api/conversas/:id/conferencia. Quem fez a conversa confere na hora, antes de gravar (CA4, CA5; Pedro 07/10): só
 * entra o que foi confirmado ou corrigido; o desfeito não muda nada (CA1, CA6, G14). O que o perfil não pode fica para
 * quem pode (CA8): depois, o Jurídico confere só isso. A etapa do processo não muda: o caso segue de onde parou (CA3, CA7).
 */
export async function conferirConversa(conversaId: string, conferencia: Conferencia, por: QuemAge): Promise<ConversaAberta> {
  await esperar()
  const banco = ler()
  const { conversa: c, ficha, gravacao: g } = acharConversa(banco, conversaId)
  const primeira = !c.conferidaEm
  if (primeira && por.quem !== c.quem) throw new Error(`Quem confere é quem fez a conversa: ${c.quem}.`)
  if (primeira && !conferencia.pendencia) throw new Error('Responda "Surgiu pendência?".')
  const p = primeira && conferencia.pendencia?.surgiu ? conferencia.pendencia : undefined
  const pessoas = pessoasDoEscritorio()
  const motivoDaPendencia = p && motivoParaNaoCriarPendencia(p, pessoas, hojeIso(agora()))
  if (motivoDaPendencia) throw new Error(motivoDaPendencia)
  const mudancas = c.analise?.mudancas ?? []
  const decididas = (c.decisoes ?? []).map((d) => d.id)
  const motivo = motivoParaNaoConferir(mudancas, conferencia.decisoes, papelDoPerfil(por.perfil), decididas)
  if (motivo) throw new Error(motivo)
  if (!primeira && conferencia.decisoes.length === 0) throw new Error('Não há nada para conferir.')
  // A perícia já marcada muda só pela remarcação, com a hora, o local e o limite de remarcações (épico GGVP-10, G15).
  const novaData = conferencia.decisoes.some((d) => d.decisao !== 'desfeita' && mudancas.find((x) => x.id === d.id)?.campo === 'pericia')
  if (novaData && c.processoId && dataDaPericia(banco, c.processoId)) {
    throw new Error('A data da perícia já marcada muda pela remarcação, na tela da perícia: desfaça este item aqui e remarque lá.')
  }
  // Telefone e e-mail só mudam com o cliente verificado e em contrato novo (GGVP-111, CA1, CA8): na conversa presencial com
  // o próprio cliente, ele está no escritório; na ligação, ou com outra pessoa, a pessoa marca como verificou.
  const verificacao = verificacaoDaConversa(c) ?? conferencia.verificacao ?? null
  const protegidas = conferencia.decisoes.filter((d) => d.decisao !== 'desfeita' && ehProtegido(mudancas.find((x) => x.id === d.id)!.campo))
  for (const d of protegidas) {
    const motivoDoContato = motivoParaNaoMudar(mudancas.find((x) => x.id === d.id)!.campo, verificacao)
    if (motivoDoContato) throw new Error(motivoDoContato)
  }
  const quando = agora().toISOString()
  if (protegidas.length > 0) {
    const quais = protegidas.map((d) => CAMPOS_DA_CONVERSA[mudancas.find((x) => x.id === d.id)!.campo]).join(' e ')
    ficha.historico.push(evento(`Mudança de ${quais} com o cliente verificado (${COMO_VERIFICOU[verificacao!.como!].toLowerCase()}; em contrato novo)`, por.quem))
  }
  for (const d of conferencia.decisoes) {
    const m = mudancas.find((x) => x.id === d.id)!
    if (d.decisao !== 'desfeita') aplicar(banco, c, ficha, m, d.decisao === 'corrigida' ? valorGuardado(m.campo, d.valor!) : m.depois, por.quem)
    const extraida = g?.extraidas.find((e) => e.id === d.id)
    if (extraida) extraida.conferidaEm = quando
  }
  c.decisoes = [...(c.decisoes ?? []), ...conferencia.decisoes]
  if (g && conferencia.decisoes.some((d) => d.decisao !== 'desfeita' && mudancas.find((m) => m.id === d.id)?.onde === 'ficha') && !g.marcas.includes('ficha atualizada')) {
    g.marcas.push('ficha atualizada')
  }
  if (primeira) {
    c.conferidaEm = quando
    const senha = g?.extraidas.find((e) => e.destino === 'cofre')
    if (senha) senha.conferidaEm = quando
    const conta = (decisao: DecisaoDaMudanca['decisao']) => conferencia.decisoes.filter((d) => d.decisao === decisao).length
    const processo = ficha.processos.find((x) => x.id === c.processoId)
    // A tarefa nasce no card, para o responsável escolhido (CA1, CA3); sem pendência, nenhuma (CA2).
    if (p) {
      const setor = pessoas.find((x) => x.nome === p.responsavel)!.setor
      c.pendencia = { texto: p.texto.trim(), responsavel: p.responsavel, setor, prazo: dataParaIso(normalizarData(p.prazo))!, criadaEm: quando }
    }
    const pendencia = c.pendencia ? `pendência para ${c.pendencia.responsavel} (${c.pendencia.setor}) até ${dataCurta(c.pendencia.prazo, hojeIso(agora()))}: ${c.pendencia.texto}` : 'sem pendência'
    ficha.historico.push(
      evento(
        `Conferiu a conversa de hoje: ${conta('confirmada')} confirmada(s), ${conta('corrigida')} corrigida(s), ${conta('desfeita')} desfeita(s); ` +
          `${pendencia}; o caso segue de onde parou${processo ? ` (${processo.etapa})` : ''}`,
        por.quem,
      ),
    )
  }
  gravar(banco)
  return { conversa: c, ficha, gravacao: g }
}

/** GET /api/fichas/:id/versoes. As versões dos campos da ficha e dos processos dela, da mais antiga à mais nova. */
export async function obterVersoes(fichaId: string): Promise<VersaoDoCampo[]> {
  return (ler().versoes ?? []).filter((v) => v.fichaId === fichaId)
}

/**
 * POST /api/fichas/:id/versoes/:campo/volta. Só a Sênior (CA2, Pedro 07/10): o campo volta ao valor da versão escolhida, e a
 * volta vira versão nova, com quem e quando, e entra no histórico da ficha.
 */
export async function voltarParaVersao(alvo: Alvo, indice: number, por: QuemAge): Promise<VersaoDoCampo[]> {
  await esperar()
  if (!podeVoltarVersao(por.perfil)) throw new Error('Só a Sênior volta uma versão.')
  if (somaAoCaso(alvo.campo)) throw new Error('Fato novo e documento citado somam ao caso: não têm versão para voltar.')
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === alvo.fichaId)
  const doCampo = (banco.versoes ?? []).filter((v) => mesmoCampo(v, alvo))
  const versao = doCampo[indice]
  if (!ficha || !versao) throw new Error('Versão não encontrada')
  if (indice === doCampo.length - 1) throw new Error('Essa já é a versão em vigor.')
  const atual = doCampo.at(-1)!.valor
  banco.versoes!.push({ ...alvo, valor: versao.valor, quem: por.quem, quando: agora().toISOString(), origem: 'volta' })
  if (alvo.onde === 'ficha') ficha[alvo.campo as CampoDaFicha] = versao.valor
  const rotulo = CAMPOS_DA_CONVERSA[alvo.campo]
  ficha.historico.push(
    evento(`Voltou o ${rotulo} para a versão de ${dataHora(versao.quando)} (${versao.quem}): «${valorLido(alvo.campo, atual)}» → «${valorLido(alvo.campo, versao.valor)}»`, por.quem),
  )
  gravar(banco)
  return banco.versoes!.filter((v) => v.fichaId === alvo.fichaId)
}

// GGVP-88 · Pendência da conversa vira tarefa.

/**
 * Quem pode ficar com a tarefa, num lugar só. No servidor de exemplo: as pessoas dos registros de exemplo e as que entram
 * no portal de exemplo (a semente de `apps/api/src/banco/exemplo.ts`), para a pendência chegar a quem faz login. Ao ligar
 * no servidor (GGVP-125), as pessoas do escritório vêm de lá.
 */
const PESSOAS_DE_EXEMPLO: Pessoa[] = [
  { nome: 'Carla (exemplo)', setor: 'Atendimento' },
  { nome: 'Dra. Paula (exemplo)', setor: 'Jurídico' },
  { nome: 'Dra. Renata (exemplo)', setor: 'Jurídico' },
  { nome: 'Marcos (exemplo)', setor: 'Financeiro' },
  { nome: 'Jéssica (exemplo)', setor: 'Documentação · ADM' },
  { nome: 'Dr. Otávio (exemplo)', setor: 'Jurídico' },
  { nome: 'Ana (exemplo)', setor: 'Atendimento' },
  { nome: 'Eva (exemplo, líder e atendimento)', setor: 'Atendimento' },
  { nome: 'Fábio (exemplo)', setor: 'Documentação · ADM' },
  { nome: 'Gabi (exemplo)', setor: 'Jurídico' },
  { nome: 'Helena (exemplo)', setor: 'Jurídico' },
  { nome: 'Otávio (exemplo, segunda Sênior)', setor: 'Jurídico' },
  { nome: 'Igor (exemplo)', setor: 'Jurídico' },
  { nome: 'Júlia (exemplo)', setor: 'Financeiro' },
]

const SENIORES: IdPerfil[] = ['senior']

export function pessoasDoEscritorio(): Pessoa[] {
  return PESSOAS_DE_EXEMPLO
}

/**
 * "nome · Cumprir pendência", com o combinado embaixo, na Central do responsável (CA4). Vencido o prazo, o lembrete e a
 * tarefa urgente; três dias depois, a Sênior recebe "Pendência atrasada" (CA5).
 */
export function tarefasDePendencia(quem: { usuario: string; id: IdPerfil } | undefined): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  return conversasDo(banco).flatMap((c) => {
    const p = c.pendencia
    const ficha = banco.fichas.find((f) => f.id === c.fichaId)
    if (!p || !ficha || !quem) return []
    const situacao = situacaoDaPendencia(p.prazo, hoje, Boolean(p.cumpridaEm))
    const prazo = dataCurta(p.prazo, hoje)
    const comum = { codigo: 'D5.05', cliente: { id: ficha.id, nome: ficha.nome }, href: `/conversas/${c.id}/conferir`, processoId: c.processoId }
    const tarefas: Tarefa[] = []
    if (situacao !== 'cumprida' && p.responsavel === quem.usuario) {
      tarefas.push({
        ...comum,
        id: `pendencia-${c.id}`,
        acao: 'Cumprir pendência',
        detalhe: situacao === 'no-prazo' ? p.texto : `${p.texto} · lembrete: o prazo venceu em ${prazo}`,
        prazo: situacao === 'no-prazo' ? `vence ${prazo}` : `venceu ${prazo}`,
        urgente: situacao !== 'no-prazo',
      })
    }
    if (situacao === 'na-senior' && SENIORES.includes(quem.id)) {
      tarefas.push({
        ...comum,
        id: `pendencia-atrasada-${c.id}`,
        acao: 'Pendência atrasada',
        detalhe: `${p.responsavel} · ${p.texto} · venceu em ${prazo} · novo prazo ou dar por cumprida`,
        prazo: 'hoje',
        urgente: true,
      })
    }
    return tarefas
  })
}

function pendenciaAberta(banco: Banco, conversaId: string) {
  const achado = acharConversa(banco, conversaId)
  const p = achado.conversa.pendencia
  if (!p || p.cumpridaEm) throw new Error('Não há pendência aberta nesta conversa.')
  return { ...achado, p }
}

/** POST /api/conversas/:id/pendencia/cumprida. O responsável ou a Sênior dá a pendência por cumprida; sai da Central. */
export async function cumprirPendencia(conversaId: string, por: QuemAge): Promise<ConversaAberta> {
  await esperar()
  const banco = ler()
  const { conversa, ficha, gravacao, p } = pendenciaAberta(banco, conversaId)
  if (por.quem !== p.responsavel && !SENIORES.includes(por.perfil!)) throw new Error(`A pendência é de ${p.responsavel}; a Sênior também pode dar por cumprida.`)
  Object.assign(p, { cumpridaEm: agora().toISOString(), cumpridaPor: por.quem })
  ficha.historico.push(evento(`Cumpriu a pendência da conversa: ${p.texto}`, por.quem))
  gravar(banco)
  return { conversa, ficha, gravacao }
}

/** POST /api/conversas/:id/pendencia/prazo. Só a Sênior, com a pendência atrasada: um prazo novo, de hoje em diante (CA5). */
export async function novoPrazoDaPendencia(conversaId: string, prazo: string, por: QuemAge): Promise<ConversaAberta> {
  await esperar()
  if (!SENIORES.includes(por.perfil!)) throw new Error('Só a Sênior dá um prazo novo à pendência atrasada.')
  const banco = ler()
  const { conversa, ficha, gravacao, p } = pendenciaAberta(banco, conversaId)
  const hoje = hojeIso(agora())
  const novo = dataParaIso(normalizarData(prazo))
  if (!novo || novo < hoje) throw new Error('Prazo de hoje em diante (dd/mm/aaaa).')
  ficha.historico.push(evento(`Deu um prazo novo à pendência da conversa (${p.responsavel}): ${dataCurta(p.prazo, hoje)} → ${dataCurta(novo, hoje)}`, por.quem))
  p.prazo = novo
  gravar(banco)
  return { conversa, ficha, gravacao }
}

/** A data da perícia do INSS em vigor no processo (aaaa-mm-dd), para as mensagens da perícia (GGVP-102, CA9). */
export function periciaDoProcesso(processoId: string): string | undefined {
  return camposDoProcesso(ler(), processoId)?.pericia
}
