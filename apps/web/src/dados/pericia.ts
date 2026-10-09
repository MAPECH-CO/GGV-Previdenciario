// EXEMPLO. Servidor de exemplo da perícia (épico GGVP-10), sobre o mesmo banco de servidor.ts. A perícia nasce por
// `iniciarPericia`, com a forma da decisão D2.03 do servidor do Mateus (GGVP-31), do despacho da sênior (D3) e do pedido
// do juiz (D3a): ponta para ligar na junção com o INSS. A semente faz o papel dessas decisões para os clientes de exemplo.
// As regras e as mudanças da perícia ficam em regras/periciaNoCaso.ts, as mesmas do servidor de verdade (GGVP-137). IA,
// Meu INSS e GERID são simulados; o lembrete do caso do servidor sai pelo Chatwoot do servidor (GGVP-146).
// Modo misto (GGVP-137), ligado no main.tsx, como a Recepção: a perícia de um caso do servidor (id uuid) vai à API
// (rotas/pericia.ts) e a cópia daqui recebe o que veio de lá, para a agenda, o chat e as páginas que ainda leem a cópia. As
// perícias da semente (casos "-exemplo") ficam aqui: servem aos testes de tela e ao Playwright.
import { diaFalado, somarDias } from '../regras/agenda.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import {
  COMO_SEGUE,
  DIAS_ANTES_DOCUMENTOS,
  DIAS_ANTES_PREPARO,
  DIAS_PARA_MANIFESTAR,
  LIMITE_DE_REMARCACOES_DA_PERICIA,
  NOMES_DO_TIPO,
  ORIGENS,
  O_QUE_LEVAR,
  esperaOInss,
  etapaEmPericia,
  mensagemDoLembrete,
  numerosDaJurimetria,
  situacaoDaPericia,
  type LidoDoComprovante,
  type SituacaoDaPericia,
  type TipoDePericia,
} from '../regras/pericia.ts'
import {
  criarPericia,
  leituraDoLaudo as leituraDoLaudoNoCaso,
  diaUtil,
  fichaDoProcesso,
  leituraDoComprovante,
  marcar,
  montarOrientacao as montarOrientacaoNoCaso,
  mudancas,
  naTela,
  periciaDo,
  periciaDoResultado,
  podeMarcar,
  tarefasDaAdvogadaEm,
  tarefasDaDocumentacaoEm,
  tarefasDeDecidirDocumentoEm,
  tarefasDoJuridicoAdmEm,
  type ArquivoEnviado,
  type CanalDaOrientacao,
  type LeituraDoLaudo,
  type NaPericia,
  type OrientacaoDaPericia,
  type PedidoDePericia,
  type Pericia,
  type PericiaNaTela,
} from '../regras/periciaNoCaso.ts'
import { emVigor } from '../regras/roteiro.ts'
import { perfilDoPerito, peritosDo } from './peritos.ts'
import { roteiroDoCaso } from './roteiro.ts'
import type { SugestaoDaIa } from '@ggv/contratos'
import { chamarApi } from '../api.ts'
import { agora, doServidor, esperar, gravar, ler, noBanco, servidorLigado, type Banco } from './servidor.ts'
import type { EventoDaAgenda, Tarefa } from './tipos.ts'

export {
  CONFERENCIAS_DA_PERICIA,
  KIT_DA_PERICIA,
  MINIMO_DA_JUSTIFICATIVA,
  MINIMO_DO_MOTIVO,
  SISTEMA,
  hrefDoPasso,
  type CanalDaOrientacao,
  type DocumentosDaPericia,
  type EventoDaPericia,
  type ItemDaPericia,
  type LeituraDoLaudo,
  type MarcacaoDaPericia,
  type OrientacaoDaPericia,
  type PedidoDePericia,
  type Pericia,
  type PericiaNaTela,
  type PreparacaoDaPericia,
  type ResultadoDaPericia,
} from '../regras/periciaNoCaso.ts'

/** Hoje (ou n dias antes), à hora dada, no fuso local. */
function em(dias: number, horas: number, minutos = 0): Date {
  const hoje = agora()
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias, horas, minutos)
}

const DRA_PAULA = 'Dra. Paula (exemplo)'
/** O Jurídico administrativo de exemplo (o mesmo do servidor do Mateus). */
const IGOR = 'Igor (exemplo)'

/**
 * A semente, pelo mesmo caminho do `iniciarPericia`: a Maria (perícia médica pedida pela advogada no D2.03 ontem; o INSS
 * liberou o agendamento hoje cedo), o Pedro (avaliação social pedida na exigência do INSS, já marcada pelo Igor, com
 * documento novo para a Documentação) e o Antônio (perícia médica pedida pelo juiz; a data veio da publicação).
 */
function semear(banco: Banco): Pericia[] {
  banco.pericias = []
  criarPericia(banco, 'maria-exemplo-1', { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: DRA_PAULA }, em(-1, 16, 10), em(0, 8))
  const pedro = criarPericia(
    banco,
    'pedro-exemplo-1',
    {
      origem: 'd2-exigencia',
      tipo: 'social',
      instancia: 'inss',
      pedidaPor: DRA_PAULA,
      oQuePede: 'avaliação social pedida pelo INSS na exigência: visita à casa e composição do grupo familiar',
    },
    em(-3, 11),
    em(-2, 9),
  )
  const hoje = hojeIso(agora())
  const lido = { ...leituraDoComprovante(pedro, 'comprovante.pdf', hoje), data: diaUtil(somarDias(hoje, 16)), hora: '09:00' }
  marcar(banco, pedro, { comprovante: { nome: 'comprovante_avaliacao_social_pedro.pdf' }, lido, pedeDocumentoNovo: true }, IGOR, agora())
  // A marcação do Pedro foi ontem à tarde: o histórico guarda a hora em que aconteceu.
  for (const e of pedro.historico.slice(-5)) e.quando = em(-1, 14, 20).toISOString()
  pedro.marcacao!.registradaEm = em(-1, 14, 20).toISOString()
  pedro.documentos!.abertaEm = em(-1, 14, 20).toISOString()
  pedro.orientacao!.geradaEm = em(-1, 14, 20).toISOString()
  criarPericia(
    banco,
    'antonio-exemplo-1',
    {
      origem: 'd3a-juiz',
      tipo: 'medica',
      instancia: 'juizo',
      pedidaPor: 'Juízo da Vara Federal de Santo Amaro (exemplo)',
      oQuePede: 'perícia médica judicial pedida pelo juiz, com o perito nomeado na publicação',
      peritoLido: 'Dr. A. Prado',
      dataDoJuizo: { data: diaUtil(somarDias(hoje, 9)), hora: '10:30', local: 'Vara Federal de Santo Amaro (exemplo) · sala de perícias' },
    },
    em(-1, 9, 40),
  )
  return banco.pericias
}

/** O banco com as perícias da semente já gravadas. */
function lerComPericias(): Banco {
  const banco = ler()
  if (!banco.pericias) {
    semear(banco)
    gravar(banco)
  }
  return banco
}

/** A data marcada da perícia em andamento do processo (aaaa-mm-dd): a fonte única para a conversa e as mensagens (GGVP-84, GGVP-102). */
export function dataDaPericia(banco: Banco, processoId: string): string | undefined {
  if (!banco.pericias) semear(banco)
  return periciaDo(banco, processoId)?.marcacao?.data
}

// O modo servidor (GGVP-137): a API devolve a perícia na tela; a cópia daqui recebe a perícia e, se faltar, a ficha.

/** As tarefas e os peritos que vieram do servidor na última sincronização. */
let tarefasDoBanco: Tarefa[] = []
let peritosDoBanco: { id: string; nome: string; especialidade: string; tipo: TipoDePericia }[] = []

function receberEm(banco: Banco, t: PericiaNaTela) {
  const pericias = (banco.pericias ??= [])
  for (const p of [...t.anteriores, t.pericia]) {
    const i = pericias.findIndex((x) => x.id === p.id)
    if (i >= 0) pericias[i] = p
    else pericias.push(p)
  }
  if (banco.fichas.some((f) => f.processos.some((x) => x.id === t.processo.id))) return
  const dona = banco.fichas.find((f) => f.id === t.ficha.id)
  if (dona) dona.processos.push(t.processo)
  else banco.fichas.push(t.ficha)
}

/** A perícia que a API devolveu entra na cópia daqui. */
function receber(t: PericiaNaTela): PericiaNaTela {
  const banco = lerComPericias()
  receberEm(banco, t)
  gravar(banco)
  return t
}

/** POST na rota da perícia do processo, com o corpo do contrato (packages/contratos/src/pericia.ts). */
const naApi = (processoId: string, caminho: string, corpo: unknown = {}) =>
  noBanco<PericiaNaTela>(`/processos/${processoId}/pericia${caminho}`, { method: 'POST', corpo }).then(receber)

/** GET da perícia: sem perícia (404), nada. */
async function lerDaApi(processoId: string, caminho = ''): Promise<PericiaNaTela | null> {
  const r = await chamarApi<PericiaNaTela>(`/processos/${processoId}/pericia${caminho}`)
  if (r.ok) return receber(r.dados)
  if (r.status === 404) return null
  throw new Error(r.erro)
}

/** O PDF vai junto, em multipart: o JSON em `dados` e o arquivo no campo do servidor. */
function comArquivo(campo: string, arquivo: Blob | undefined, nome: string, dados: object): FormData {
  if (!arquivo) throw new Error('Anexe o PDF.')
  const f = new FormData()
  f.append('dados', JSON.stringify(dados))
  f.append(campo, arquivo, nome)
  return f
}

/**
 * Ao abrir a tela, depois da sessão (App.tsx): a cópia daqui recebe as perícias do servidor, as tarefas da Central de quem
 * está na sessão e, para o Jurídico, os peritos. Sem o modo servidor, nada.
 */
export async function sincronizarPericias(juridico: boolean) {
  if (!servidorLigado()) return
  const [lista, tarefas] = await Promise.all([noBanco<PericiaNaTela[]>('/pericias'), noBanco<Tarefa[]>('/pericias/tarefas')])
  // Os peritos servem à pergunta de um clique, que é do Jurídico: os outros perfis nem pedem.
  peritosDoBanco = juridico ? await noBanco<typeof peritosDoBanco>('/peritos') : []
  tarefasDoBanco = tarefas
  // A cópia das perícias do servidor é trocada inteira: quem entra depois, na mesma aba, não fica com o que a pessoa de
  // antes via (a leitura do laudo é só do Jurídico).
  const banco = lerComPericias()
  banco.pericias = (banco.pericias ?? []).filter((p) => !doServidor(p.processoId))
  for (const t of lista) receberEm(banco, t)
  gravar(banco)
}

/** As tarefas da perícia: as da semente, daqui, e as do servidor, que vieram na sincronização (modo misto). */
function tarefasDe(prefixos: RegExp, daqui: (banco: Banco, agora: Date) => Tarefa[]): Tarefa[] {
  const banco = lerComPericias()
  const daSemente = daqui({ ...banco, pericias: (banco.pericias ?? []).filter((p) => !doServidor(p.processoId)) }, agora())
  return servidorLigado() ? [...daSemente, ...tarefasDoBanco.filter((t) => prefixos.test(t.id))] : daSemente
}

/** A perícia do processo, ou o erro de quem não tem. */
function exigirPericia(banco: Banco, processoId: string): Pericia {
  const pericia = periciaDo(banco, processoId)
  if (!pericia) throw new Error('Este caso não tem perícia')
  return pericia
}

/** Lê o banco, acha a perícia do processo e aplica a mudança; grava e devolve a perícia na tela. */
async function mudar(processoId: string, mudanca: (n: NaPericia) => void, acharPericia = exigirPericia): Promise<PericiaNaTela> {
  await esperar()
  const banco = lerComPericias()
  const pericia = acharPericia(banco, processoId)
  mudanca({ mundo: banco, pericia, agora: agora() })
  gravar(banco)
  return naTela(banco, pericia, agora())
}

/** A perícia do resultado, ou o erro de quem não espera resultado. */
function exigirResultado(banco: Banco, processoId: string): Pericia {
  const pericia = periciaDoResultado(banco, processoId)
  if (!pericia) throw new Error('Esta perícia não espera resultado.')
  return pericia
}

/** POST /api/processos/:id/pericia/tentativas. A tentativa sem sucesso: o dia e o que aconteceu; a tarefa continua (CA1). */
export function registrarTentativa(processoId: string, t: { dia: string; oQueAconteceu: string }, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/tentativas', t)
  return mudar(processoId, (n) => mudancas.tentativa(n, t, quem))
}

/** A leitura de um PDF pela IA, como a tela recebe: o que ela leu, a marca de sugestão e, sem IA, o motivo (GGVP-139). */
export type LeituraPelaIa<T> = { lido: T | null; sugestao: SugestaoDaIa | null; motivo: string | null }

/** IA simulada da semente (CA2, CA3): lê data, hora, local e tipo do nome do arquivo; o perito não vem. */
export async function lerComprovante(processoId: string, nome: string): Promise<LidoDoComprovante> {
  // O chat (história própria) ainda lê pelo nome: no servidor, a leitura é pelo PDF, na tela de marcar.
  if (doServidor(processoId)) throw new Error('Suba o comprovante na tela de marcar a perícia.')
  await esperar()
  return leituraDoComprovante(exigirPericia(lerComPericias(), processoId), nome, hojeIso(agora()))
}

/**
 * POST /api/processos/:id/pericia/comprovante/leitura (GGVP-139 CA1): no servidor, a IA de verdade lê o PDF; na semente,
 * a leitura simulada. A pessoa confere antes de registrar.
 */
export async function lerComprovanteComIa(processoId: string, arquivo: Blob, nome: string): Promise<LeituraPelaIa<LidoDoComprovante>> {
  if (!doServidor(processoId)) return { lido: await lerComprovante(processoId, nome), sugestao: null, motivo: null }
  const f = new FormData()
  f.append('comprovante', arquivo, nome)
  return noBanco<LeituraPelaIa<LidoDoComprovante>>(`/processos/${processoId}/pericia/comprovante/leitura`, { method: 'POST', corpo: f })
}

/** POST /api/processos/:id/pericia/marcacao. Registra a perícia conferida (CA2, CA3, CA4); de novo, troca a data (CA8). */
export async function registrarMarcacao(
  processoId: string,
  m: { comprovante: ArquivoEnviado; lido: LidoDoComprovante; pedeDocumentoNovo: boolean },
  quem: string,
): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/marcacao', comArquivo('comprovante', m.comprovante.arquivo, m.comprovante.nome, { lido: m.lido, pedeDocumentoNovo: m.pedeDocumentoNovo }))
  return mudar(processoId, (n) => mudancas.marcacao(n, m, quem))
}

/** Marcada no Meu INSS sem o comprovante ainda (DP.E1): a tarefa espera, com lembrete diário (CA6). */
export function esperarComprovante(processoId: string, d: { pedeDocumentoNovo: boolean }, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/espera-do-comprovante', d)
  return mudar(processoId, (n) => mudancas.esperarComprovante(n, d, quem))
}

/** Remarcar (CA8, CA9): a data sai, a tentativa de marcar recomeça e a remarcação conta no limite (G15). */
export function remarcarPericia(processoId: string, motivo: string, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/remarcacao', { motivo })
  return mudar(processoId, (n) => mudancas.remarcacao(n, motivo, quem))
}

/** A advogada responsável, no limite (G15), autoriza mais uma remarcação, com justificativa: volta ao Jurídico administrativo. */
export function autorizarRemarcacao(processoId: string, justificativa: string, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/autorizacao', { justificativa })
  return mudar(processoId, (n) => mudancas.autorizacao(n, justificativa, quem))
}

/** A mensagem do lembrete da véspera, para conferir no Chatwoot (CA7). */
export async function obterLembrete(processoId: string): Promise<{ nome: string; telefone: string; mensagem: string; fichaId: string }> {
  const t = await obterPericia(processoId)
  if (!t?.pericia.marcacao) throw new Error('A perícia ainda não tem data')
  const { marcacao } = t.pericia
  return {
    nome: t.ficha.nome,
    telefone: t.ficha.telefone,
    fichaId: t.ficha.id,
    mensagem: mensagemDoLembrete({ nome: t.ficha.nome, tipo: marcacao.tipo, data: marcacao.data, hora: marcacao.hora, local: marcacao.local }, diaFalado(marcacao.data)),
  }
}

/** POST /api/processos/:id/pericia/lembrete. Enviado pelo Chatwoot depois de revisado pelo Jurídico (CA7, Q5). */
export function registrarLembrete(processoId: string, mensagem: string, quem = 'Jurídico administrativo'): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/lembrete', { mensagem })
  return mudar(processoId, (n) => mudancas.lembrete(n, mensagem, quem))
}

/** Chamado pela GGVP-31 (D2.03), pelo despacho da sênior (D3) e pelo pedido do juiz (D3a). Ponta para ligar na junção. */
export async function iniciarPericia(processoId: string, pedido: PedidoDePericia): Promise<Pericia> {
  await esperar()
  const banco = lerComPericias()
  const pericia = criarPericia(banco, processoId, pedido, agora())
  gravar(banco)
  return pericia
}

/** A vigília do INSS viu o agendamento liberado (D2.E1): a tarefa entra na Central do Jurídico administrativo (CA2). */
export async function liberarAgendamento(processoId: string): Promise<Pericia> {
  if (doServidor(processoId)) return (await naApi(processoId, '/liberacao')).pericia
  await esperar()
  const banco = lerComPericias()
  const pericia = exigirPericia(banco, processoId)
  mudancas.liberacao({ mundo: banco, pericia, agora: agora() })
  gravar(banco)
  return pericia
}

/** GET /api/processos/:id/pericia */
export async function obterPericia(processoId: string): Promise<PericiaNaTela | null> {
  if (doServidor(processoId)) return lerDaApi(processoId)
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  return pericia ? naTela(banco, pericia, agora()) : null
}

/** A etapa do caso em perícia, para a ficha do cliente (CA1). Sem perícia, nada. */
export function etapaDaPericia(processoId: string): string | null {
  const banco = lerComPericias()
  const pericia = periciaDo(banco, processoId)
  return pericia ? etapaEmPericia(pericia, hojeIso(agora())) : null
}

/**
 * "O que acontece agora", com o contexto que a IA já sabe do caso (pedido do Lucas no cartão da GGVP-49, 02/10). IA
 * simulada: o texto sai do dado da perícia. Sem nome de gênero: o primeiro nome do cliente.
 */
export function oQueAconteceAgora(t: PericiaNaTela): string {
  const { pericia, ficha } = t
  const primeiro = ficha.nome.split(' ')[0]
  const tipo = NOMES_DO_TIPO[pericia.tipo]
  const depois =
    `Se a perícia pedir documento novo, a Documentação reúne até ${DIAS_ANTES_DOCUMENTOS} dias antes; até ${DIAS_ANTES_PREPARO} dias antes, ` +
    `o Jurídico administrativo liga para ${primeiro} com a orientação, e na véspera ${primeiro} recebe o lembrete.`
  if (t.situacao === 'aguardando-inss') {
    return (
      `O pedido está registrado. Assim que o INSS liberar o agendamento (D2.E1), a tarefa «Marcar a perícia» entra na Central do ` +
      `Jurídico administrativo, que marca a ${tipo} de ${primeiro} pelo Meu INSS (senha no cofre, G9). ${depois}`
    )
  }
  const r = pericia.resultado?.registrado
  if (t.situacao === 'concluida' && r) {
    const hoje = hojeIso(agora())
    return (
      `O resultado da ${tipo} de ${primeiro} foi ${r.favoravel ? 'favorável' : 'desfavorável'}, registrado por ${r.quem} em ${dataCurta(hojeIso(new Date(r.quando)), hoje)}: ` +
      `${COMO_SEGUE[pericia.origem]}${r.manifestarAte ? `, até ${dataCurta(r.manifestarAte, hoje)} (${DIAS_PARA_MANIFESTAR} dias, G12)` : ''}.`
    )
  }
  if (t.situacao === 'aguardando-resultado') {
    const m = pericia.marcacao!
    return (
      `${primeiro} compareceu à ${tipo} de ${dataCurta(m.data, hojeIso(agora()))}. Agora o caso espera o perito e o resultado (DP.E3, DP.E4): ` +
      `a advogada responsável acompanha ${pericia.instancia === 'inss' ? 'no GERID' : 'no processo'} e confere o resultado (DP.08).`
    )
  }
  if (t.jaPassou) {
    return `A ${tipo} de ${primeiro} já passou: o Jurídico administrativo registra se ${primeiro} compareceu. Se faltou, a perícia volta para remarcar e conta no limite (G15).`
  }
  if (t.situacao === 'na-advogada') {
    return (
      `A perícia passou do limite de ${LIMITE_DE_REMARCACOES_DA_PERICIA} remarcações: a advogada responsável decide se vale mais uma (G15). ` +
      `Se autorizar, a tarefa de marcar volta para o Jurídico administrativo.`
    )
  }
  if (t.situacao === 'aguardando-comprovante') {
    return (
      `A ${tipo} de ${primeiro} já foi marcada no Meu INSS, mas o comprovante ainda não saiu (DP.E1). O Jurídico administrativo recebe ` +
      `um lembrete por dia até subir o comprovante; o sistema lê data, hora, local e tipo. ${depois}`
    )
  }
  if (t.situacao === 'agendada' && pericia.marcacao && t.prazos) {
    const m = pericia.marcacao
    const hoje = hojeIso(agora())
    const quando = `${diaFalado(m.data)}, às ${m.hora}, em ${m.local}`
    const como =
      m.origem === 'juizo'
        ? `O sistema leu a data na publicação do juízo e pôs na agenda e na ficha: ${quando}.`
        : `A ${tipo} de ${primeiro} está marcada para ${quando}; o sistema leu o comprovante e pôs na agenda e na ficha.`
    const documentos = pericia.pedeDocumentoNovo ? ` A Documentação reúne o que a perícia pede até ${dataCurta(t.prazos.documentosAte, hoje)}.` : ''
    const o = pericia.orientacao
    const orientacao = !o
      ? ''
      : o.bloqueio
        ? ' A orientação montada pela IA foi bloqueada pela verificação e pede revisão.'
        : o.modo === 'perfil' && t.perfil
          ? ` O perfil de ${t.perfil.perito.nome} está na base e a orientação já segue esse perfil (DP.05).`
          : ' A orientação padrão já está montada (DP.05).'
    const p = pericia.preparacao
    const preparo = p
      ? ` ${primeiro} já recebeu a orientação ${p.canal === 'chatwoot' ? 'pelo Chatwoot' : 'na ligação'}, em ${dataCurta(hojeIso(new Date(p.quando)), hoje)};`
      : ` Até ${dataCurta(t.prazos.preparoAte, hoje)}, o Jurídico administrativo liga para ${primeiro} com a orientação;`
    return `${como}${documentos}${orientacao}${preparo} na véspera, ${dataCurta(t.prazos.vespera, hoje)}, sai o lembrete.`
  }
  const como =
    pericia.instancia === 'inss'
      ? `pelo Meu INSS (senha no cofre, G9), tentando todo dia até conseguir, e sobe o comprovante: o sistema lê data, hora, local e tipo`
      : `com o juízo, e registra a data e o local que vierem do processo`
  return `O Jurídico administrativo marca a ${tipo} de ${primeiro} ${como}. ${depois}`
}

/** O chat acha a perícia para marcar do cliente que a mensagem cita (GGVP-53, CA5). Sem ela, nada. */
export function periciaParaMarcarDaFicha(fichaId: string): { processoId: string; beneficio: string } | null {
  const banco = lerComPericias()
  const pericia = (banco.pericias ?? []).find((p) => p.fichaId === fichaId && podeMarcar(p))
  return pericia ? { processoId: pericia.processoId, beneficio: naTela(banco, pericia, agora()).beneficio } : null
}

/** Uma linha do chat da Central (Figma 2107:892): o cliente, a ação, o porquê curto e o prazo. */
export type ItemDoChat = { cliente: string; acao: string; sub: string; href: string }

/** "Quais perícias eu tenho para marcar?" (Figma 2107:892): as tarefas de marcar e remarcar, com o porquê curto. */
export function periciasParaMarcar(): ItemDoChat[] {
  return tarefasDoJuridicoAdm()
    .filter((t) => t.codigo === 'DP.02')
    .map((t) => {
      const p = lerComPericias().pericias!.find((x) => `pericia-marcar-${x.id}` === t.id)!
      const porque =
        p.remarcacoes > 0
          ? `o cliente faltou · ${p.remarcacoes}ª remarcação (limite G15)`
          : esperaOInss(p.origem)
            ? 'o INSS já liberou o agendamento'
            : ORIGENS[p.origem].rotulo
      return { cliente: t.cliente!.nome, acao: t.acao, sub: `${porque} · ${t.prazo}`, href: t.href! }
    })
}

/** As tarefas da perícia na Central do Jurídico administrativo (CA2): "<nome> · Marcar perícia", liberadas. */
export function tarefasDoJuridicoAdm(): Tarefa[] {
  return tarefasDe(/^pericia-(marcar|comprovante|orientar|presenca|comparecimento|lembrete)-/, tarefasDoJuridicoAdmEm)
}

/** As da advogada responsável: a perícia que passou do limite de remarcações (CA9, G15) e o resultado. Nunca a sênior. */
export function tarefasDaAdvogadaNaPericia(): Tarefa[] {
  return tarefasDe(/^pericia-(limite|resultado)-/, tarefasDaAdvogadaEm)
}

const PASSO_NA_AGENDA = { comprovante: 'DP.02 · Marcar a perícia no INSS', juizo: 'DP.04 · Data do juízo, lida da publicação' }

/** A perícia marcada na agenda (CA2): categoria "Perícias", com o passo e o caso. Ligado em dados/agenda.ts. */
export function eventosDasPericias(banco: Banco, hoje: string): EventoDaAgenda[] {
  const pericias = banco.pericias ?? semear(structuredClone(banco))
  return pericias.flatMap((p): EventoDaAgenda[] => {
    const achado = fichaDoProcesso(banco, p.processoId)
    if (!p.marcacao || !achado) return []
    const m = p.marcacao
    const tipo = NOMES_DO_TIPO[p.tipo]
    return [
      {
        id: `pericia:${p.id}`,
        data: m.data,
        hora: m.hora,
        duracao: 60,
        titulo: achado.ficha.nome,
        oQue: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        categoria: 'pericias',
        responsavel: 'Jurídico administrativo',
        passo: PASSO_NA_AGENDA[m.origem],
        estado: m.comparecimento ? (m.comparecimento.compareceu ? 'realizado' : 'faltou') : m.data < hoje ? 'confirmar' : 'agendado',
        fichaId: achado.ficha.id,
        remarcacoes: p.remarcacoes,
        processoId: p.processoId,
        local: m.local,
      },
    ]
  })
}

// GGVP-56 · Reunir o que a perícia pede: a Documentação reúne, cobra todo dia até 10 dias antes e conclui.

/** A falta de um item, com justificativa (CA5). */
export function justificarFalta(processoId: string, itemId: string, justificativa: string, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/faltas', { itemId, justificativa })
  return mudar(processoId, (n) => mudancas.falta(n, itemId, justificativa, quem))
}

/** Concluir (CA5, CA6): cada item anexado ou justificado e as conferências; grava quem e quando e volta ao Jurídico administrativo. */
export function concluirDocumentos(processoId: string, c: { conferidas: string[] }, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/documentos/conclusao', c)
  return mudar(processoId, (n) => mudancas.conclusaoDosDocumentos(n, c, quem))
}

/** O que o laudo deve abordar, sugerido pela IA com as perguntas do roteiro do benefício (CA7). A Documentação confere. */
export async function abordarSugeridoNaPericia(processoId: string): Promise<string> {
  const banco = lerComPericias()
  const achado = fichaDoProcesso(banco, processoId)
  const roteiro = achado ? roteiroDoCaso(banco, achado.processo.beneficio) : undefined
  const perguntas = roteiro ? emVigor(roteiro).itens.filter((i) => i.tipo === 'obrigatorio' && i.pergunta).map((i) => `• ${i.pergunta}`) : []
  return perguntas.length > 0 ? `O relatório médico precisa responder:\n${perguntas.join('\n')}` : ''
}

/** O pedido ao médico (CA7): só o que o documento deve abordar; o servidor recusa diagnóstico, CID, grau, conclusão e frase pronta (G20). */
export function pedirAoMedicoNaPericia(processoId: string, abordar: string, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/pedido-ao-medico', { abordar })
  return mudar(processoId, (n) => mudancas.pedidoAoMedico(n, abordar, quem))
}

/** A mensagem de cobrança do que falta, com o pedido ao médico quando há, para conferir no Chatwoot. */
export async function obterCobrancaDaPericia(processoId: string): Promise<{ nome: string; telefone: string; mensagem: string; fichaId: string }> {
  const t = await obterPericia(processoId)
  if (!t?.documentos) throw new Error('Esta perícia não pede documento novo.')
  const hoje = hojeIso(agora())
  const primeiro = t.ficha.nome.split(' ')[0]
  const ate = t.prazos?.documentosAte
  const pedido = t.pericia.documentos!.pedidosAoMedico.at(-1)
  const quais = t.documentos.faltando.map((i) => i.nome.toLowerCase()).join('; ')
  const de = t.pericia.marcacao ? ` de ${dataCurta(t.pericia.marcacao.data, hoje)}` : ''
  const mensagem =
    `Olá, ${primeiro}! Aqui é do escritório GGV. Para a sua ${NOMES_DO_TIPO[t.pericia.tipo]}${de}, ainda precisamos de: ${quais}. ` +
    `Mande foto por aqui ou traga ao escritório${ate ? ` até ${dataCurta(ate, hoje)}` : ''}.` +
    (pedido ? `\n\nPara o laudo, leve ao seu médico este pedido; ele responde com as palavras dele:\n${pedido.abordar}\n\n` : ' ') +
    'Qualquer dúvida, é só responder esta mensagem.'
  return { nome: t.ficha.nome, telefone: t.ficha.telefone, mensagem, fichaId: t.ficha.id }
}

/** A cobrança do dia, enviada pelo Chatwoot depois de conferida (Lucas, 02/10: a Documentação cobra, todo dia). */
export function registrarCobrancaDaPericia(processoId: string, mensagem: string, quem = 'Documentação'): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/cobranca', { mensagem })
  return mudar(processoId, (n) => mudancas.cobranca(n, mensagem, quem))
}

/** "Adiar": a cobrança de hoje fica para amanhã. */
export function adiarCobrancaDaPericia(processoId: string, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/cobranca/adiamento')
  return mudar(processoId, (n) => mudancas.adiamentoDaCobranca(n, quem))
}

/** Passou dos 10 dias antes com documento faltando: a advogada responsável registra o que decidiu (G15). */
export function decidirFaltaDaPericia(processoId: string, texto: string, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/decisao-da-falta', { texto })
  return mudar(processoId, (n) => mudancas.decisaoDaFalta(n, texto, quem))
}

/** As tarefas da Documentação na Central do Atendimento: reunir e, quando é dia, cobrar (CA1, CA2, CA3). */
export function tarefasDaDocumentacaoNaPericia(): Tarefa[] {
  return tarefasDe(/^pericia-(documentos|cobrar)-/, tarefasDaDocumentacaoEm)
}

/** Passou dos 10 dias antes com documento faltando e sem decisão: a advogada responsável decide (G15). */
export function tarefasDeDecidirDocumentoDaPericia(): Tarefa[] {
  return tarefasDe(/^pericia-falta-/, tarefasDeDecidirDocumentoEm)
}

// GGVP-61 · A orientação da perícia, padrão ou pelo perfil do perito (DP.05, sem tela própria).

const nomeCurto = (nome: string) => nome.replace(/\s*\(exemplo\)$/, '')

/** DP.05: a IA monta a orientação quando a data é registrada (regras/periciaNoCaso.ts). `pedido` é o teste dos pedidos maliciosos (CA10). */
export function montarOrientacao(banco: Banco, pericia: Pericia, quando: Date, pedido?: string): OrientacaoDaPericia {
  return montarOrientacaoNoCaso(banco, pericia, quando, pedido)
}

/** A pergunta de um clique (CA6): a equipe liga o perito quando a informação chega; a orientação sai de novo pelo perfil. */
export function ligarPerito(processoId: string, peritoId: string, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/perito', { peritoId })
  return mudar(processoId, (n) => mudancas.perito(n, peritoId, quem))
}

/** Os peritos que a pergunta de um clique oferece: os do mesmo tipo da perícia (CA6). */
export function peritosParaLigar(tipo: TipoDePericia, processoId = ''): { id: string; nome: string; especialidade: string }[] {
  if (doServidor(processoId)) return peritosDoBanco.filter((p) => p.tipo === tipo).map(({ id, nome, especialidade }) => ({ id, nome, especialidade }))
  return peritosDo(lerComPericias())
    .filter((p) => p.tipo === tipo)
    .map(({ id, nome, especialidade }) => ({ id, nome, especialidade }))
}

/** Os processos com o perito, para a janela da jurimetria (Figma 2184:2). */
export function processosComOPerito(peritoId: string): { processoId: string; cliente: string; sub: string }[] {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  return (banco.pericias ?? [])
    .filter((p) => p.peritoId === peritoId)
    .map((p) => {
      const t = naTela(banco, p, agora())
      const m = p.marcacao
      return { processoId: p.processoId, cliente: t.ficha.nome, sub: m ? `perícia ${dataCurta(m.data, hoje)}, ${m.hora} · ${m.local}` : NOMES_DA_SITUACAO_CURTA[t.situacao] }
    })
}

const NOMES_DA_SITUACAO_CURTA: Record<SituacaoDaPericia, string> = {
  'aguardando-inss': 'esperando o INSS',
  marcar: 'para marcar',
  'aguardando-comprovante': 'esperando o comprovante',
  agendada: 'agendada',
  'na-advogada': 'com a advogada',
  'aguardando-resultado': 'esperando o resultado',
  concluida: 'resultado registrado',
}

/** A recusa do chat fica registrada (CA11, G11): quem pediu, quando e o quê. */
export function registrarRecusaDoChat(texto: string, quem: string) {
  const banco = ler()
  ;(banco.recusasDoChat ??= []).push({ quando: agora().toISOString(), quem, texto })
  gravar(banco)
}

/** O que a recusa registrou, para a auditoria. */
export function recusasDoChat(): { quando: string; quem: string; texto: string }[] {
  return ler().recusasDoChat ?? []
}

/**
 * "Dica para a perícia" no chat (Figma 2186:857): o resumo da orientação do cliente citado, o perito e a tarefa. Só
 * responde e orienta. Os números da jurimetria vêm do sistema; com amostra pequena, "amostra insuficiente" (G22).
 */
export async function dicaParaAPericia(texto: string): Promise<{ texto: string; itens: ItemDoChat[] } | null> {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const pericia = (banco.pericias ?? []).find((p) => {
    const ficha = banco.fichas.find((f) => f.id === p.fichaId)!
    return new RegExp(`\\b${ficha.nome.split(' ')[0]}\\b`, 'i').test(texto) && p.orientacao
  })
  if (!pericia?.orientacao || !pericia.marcacao) return null
  const t = naTela(banco, pericia, agora())
  const primeiro = t.ficha.nome.split(' ')[0]
  const m = pericia.marcacao
  const tarefa: ItemDoChat = {
    cliente: t.ficha.nome,
    acao: 'Orientar para a perícia',
    sub: `${diaFalado(m.data)}, ${m.hora} · ${m.local}${t.prazos ? ` · ligar até ${dataCurta(t.prazos.preparoAte, hoje)}` : ''}`,
    href: `/casos/${pericia.processoId}/pericia/orientar`,
  }
  if (pericia.orientacao.modo === 'perfil' && t.perfil) {
    const j = t.perfil.jurimetria
    const numeros = numerosDaJurimetria(j, hojeIso(agora()))
    return {
      texto:
        `Pelo perfil de ${nomeCurto(t.perfil.perito.nome)} (${numeros}), peça para ${primeiro} levar ${t.perfil.pediu.join(' e ')}. ` +
        `O perito costuma perguntar ${t.perfil.perguntou.join(' e ')}. Na ligação: conte a ${primeiro} como é a perícia e lembre de responder com calma e com sinceridade.`,
      itens: [
        { cliente: t.perfil.perito.nome, acao: 'Ver o perfil do perito', sub: numeros, href: `/casos/${pericia.processoId}/pericia?perito=1` },
        tarefa,
      ],
    }
  }
  return {
    texto: `A orientação de ${primeiro} é a padrão: ${pericia.orientacao.motivo}. Ela já traz data, local, o que levar e como é a ${NOMES_DO_TIPO[pericia.tipo]}.`,
    itens: [tarefa],
  }
}

// GGVP-62 · Preparar o cliente: o Jurídico administrativo revisa a orientação e passa ao cliente (DP.06).

/**
 * POST /api/processos/:id/pericia/orientacao/sugestao (GGVP-139 CA2): no servidor, o texto que a IA escreveu, já
 * verificado (G11, G20); na semente, nada: fica a orientação que o código montou.
 */
export async function sugerirOrientacao(processoId: string): Promise<{ texto: string | null; sugestao: SugestaoDaIa | null; motivo: string | null }> {
  if (!doServidor(processoId)) return { texto: null, sugestao: null, motivo: null }
  return noBanco(`/processos/${processoId}/pericia/orientacao/sugestao`, { method: 'POST' })
}

/**
 * POST /api/processos/:id/pericia/orientacao. Só com "Revisei a orientação" (CA3). O servidor verifica de novo o texto,
 * editado ou não (CA4); com instrução proibida, recusa e registra a tentativa (CA6). Guarda o texto, o canal e a data
 * (CA2, CA7). O Chatwoot é simulado (GGVP-102).
 */
export async function enviarOrientacao(
  processoId: string,
  o: { texto: string; canal: CanalDaOrientacao; revisei: boolean },
  quem: string,
): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/orientacao', o)
  await esperar()
  const banco = lerComPericias()
  const pericia = exigirPericia(banco, processoId)
  const motivo = mudancas.orientacao({ mundo: banco, pericia, agora: agora() }, o, quem)
  gravar(banco)
  if (motivo) throw new Error(motivo)
  return naTela(banco, pericia, agora())
}

/**
 * "O Pedro me ligou. O que eu falo?" (Figma 2107:1091): a próxima tarefa do cliente na Central do Jurídico
 * administrativo e, com a orientação pronta, o resumo dela (CA8). Só responde e orienta: não executa nada.
 */
export function clienteLigou(texto: string): { texto: string; itens?: ItemDoChat[] } {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const ficha = banco.fichas.find((f) => (banco.pericias ?? []).some((p) => p.fichaId === f.id) && new RegExp(`\\b${f.nome.split(' ')[0]}\\b`, 'i').test(texto))
  if (!ficha) return { texto: 'Diga o nome do cliente que ligou: eu mostro a próxima tarefa e a orientação.' }
  const primeiro = ficha.nome.split(' ')[0]
  const tarefa = tarefasDoJuridicoAdm().find((t) => t.cliente?.id === ficha.id)
  const pericia = banco.pericias!.filter((p) => p.fichaId === ficha.id).at(-1)!
  const m = pericia.marcacao
  if (!tarefa) {
    const feita = pericia.preparacao
    return {
      texto: feita
        ? `${primeiro} já recebeu a orientação em ${dataCurta(hojeIso(new Date(feita.quando)), hoje)} (${feita.canal === 'chatwoot' ? 'pelo Chatwoot' : 'na ligação'}). Se for dúvida, repasse o que está guardado no caso; se a data mudou, a tarefa volta.`
        : `${primeiro} não tem tarefa sua agora na perícia. A situação está na página do processo.`,
      itens: [{ cliente: ficha.nome, acao: 'Ver a perícia', sub: m ? `perícia ${dataCurta(m.data, hoje)}, ${m.hora}` : NOMES_DA_SITUACAO_CURTA[situacaoDaPericia(pericia)], href: `/casos/${pericia.processoId}/pericia` }],
    }
  }
  if (tarefa.codigo === 'DP.06' && m) {
    return {
      texto:
        `A próxima tarefa é sua: orientar ${primeiro} para a perícia de ${dataCurta(m.data, hoje)}. A orientação da IA está pronta com data, local, o que levar e como é a ${NOMES_DO_TIPO[pericia.tipo]}: ` +
        `${diaFalado(m.data)}, às ${m.hora}, em ${m.local}; levar ${O_QUE_LEVAR[pericia.tipo]}. Nunca oriente a esconder ou mudar a situação real (G11).`,
      itens: [{ cliente: ficha.nome, acao: tarefa.acao, sub: `perícia ${dataCurta(m.data, hoje)} · ${pericia.orientacao?.bloqueio ? 'orientação bloqueada: revisar' : 'orientação da IA pronta'}`, href: tarefa.href! }],
    }
  }
  return {
    texto: `A próxima tarefa é sua: ${tarefa.acao.toLowerCase()} de ${primeiro}. A orientação sai quando a perícia tiver data.`,
    itens: [{ cliente: ficha.nome, acao: tarefa.acao, sub: `${tarefa.detalhe} · ${tarefa.prazo}`, href: tarefa.href! }],
  }
}

/** A perícia do cliente em poucas palavras, para o chat da Central do Atendimento (GGVP-111, CA7): a data marcada ou a situação. */
export function periciaDoCliente(fichaId: string): string | undefined {
  const banco = lerComPericias()
  const pericia = (banco.pericias ?? []).filter((p) => p.fichaId === fichaId).at(-1)
  if (!pericia) return undefined
  const m = pericia.marcacao
  return m ? `perícia ${dataCurta(m.data, hojeIso(agora()))}, ${m.hora}` : NOMES_DA_SITUACAO_CURTA[situacaoDaPericia(pericia)]
}

// GGVP-66 · Comparecimento e remarcação (DP.07).

/** A confirmação de presença (CA7): confirmou ou não, com a observação; fica registrada. Não pode ir: é remarcar (CA9). */
export function confirmarPresenca(processoId: string, c: { confirmou: boolean; observacao?: string }, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/presenca', c)
  return mudar(processoId, (n) => mudancas.presenca(n, c, quem))
}

/** Depois do dia e da hora (CA1): compareceu, espera o resultado (CA5); faltou, volta "Remarcar perícia" (CA2, CA3, G15). */
export function registrarComparecimento(processoId: string, r: { compareceu: boolean; justificativa?: string }, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/comparecimento', r)
  return mudar(processoId, (n) => mudancas.comparecimento(n, r, quem))
}

// GGVP-70 · Conferir o resultado e decidir o próximo passo (DP.08, DP.10).

/** GET /api/processos/:id/pericia/resultado */
export async function obterResultado(processoId: string): Promise<PericiaNaTela | null> {
  if (doServidor(processoId)) return lerDaApi(processoId, '/resultado')
  const banco = lerComPericias()
  const pericia = periciaDoResultado(banco, processoId)
  return pericia ? naTela(banco, pericia, agora()) : null
}

/** A vigília do GERID (ou a publicação do laudo) viu o resultado (DP.E4): a tarefa da advogada fica urgente (CA1). Ponta do Mateus. */
export function resultadoNoGerid(processoId: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/resultado/disponivel')
  return mudar(processoId, (n) => mudancas.resultadoDisponivel(n), exigirResultado)
}

/** IA simulada da semente: o resumo do laudo, para a advogada conferir (CA5). */
export async function lerLaudoDaPericia(processoId: string, nome: string): Promise<LeituraDoLaudo> {
  if (doServidor(processoId)) throw new Error('Suba o laudo na tela do resultado.')
  await esperar()
  const banco = lerComPericias()
  const pericia = exigirResultado(banco, processoId)
  return leituraDoLaudoNoCaso(pericia, naTela(banco, pericia, agora()).beneficio, nome)
}

/**
 * POST /api/processos/:id/pericia/laudo/leitura (GGVP-139 CA3): no servidor, a IA de verdade lê o laudo e resume; na
 * semente, a leitura simulada. Quem decide o resultado é a advogada.
 */
export async function lerLaudoComIa(processoId: string, arquivo: Blob, nome: string): Promise<LeituraPelaIa<LeituraDoLaudo>> {
  if (!doServidor(processoId)) return { lido: await lerLaudoDaPericia(processoId, nome), sugestao: null, motivo: null }
  const f = new FormData()
  f.append('laudo', arquivo, nome)
  const r = await noBanco<{ leitura: LeituraDoLaudo | null; sugestao: SugestaoDaIa | null; motivo: string | null }>(`/processos/${processoId}/pericia/laudo/leitura`, { method: 'POST', corpo: f })
  return { lido: r.leitura, sugestao: r.sugestao, motivo: r.motivo }
}

/** POST /api/processos/:id/pericia/resultado (CA2 a CA6): a regra está em regras/periciaNoCaso.ts. */
export async function registrarResultado(
  processoId: string,
  r: { laudo: ArquivoEnviado; favoravel?: boolean; novaPericia?: boolean; conferidas: string[]; chamadaIaId?: string },
  quem: string,
): Promise<PericiaNaTela> {
  if (doServidor(processoId))
    return naApi(processoId, '/resultado', comArquivo('laudo', r.laudo.arquivo, r.laudo.nome, { favoravel: r.favoravel, novaPericia: r.novaPericia, conferidas: r.conferidas, chamadaIaId: r.chamadaIaId }))
  return mudar(processoId, (n) => void mudancas.resultado(n, r, quem))
}

/**
 * "Quais perícias temos esta semana?" (Figma 2107:667): as perícias marcadas de hoje a 6 dias. Cada item abre a página do
 * processo, com a perícia em destaque, e não a Agenda (CA9).
 */
export function periciasDaSemana(): { texto: string; itens: ItemDoChat[] } {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const ate = somarDias(hoje, 6)
  const itens = (banco.pericias ?? [])
    .filter((p) => p.marcacao && !p.marcacao.comparecimento && p.marcacao.data >= hoje && p.marcacao.data <= ate)
    .sort((a, b) => `${a.marcacao!.data}${a.marcacao!.hora}`.localeCompare(`${b.marcacao!.data}${b.marcacao!.hora}`))
    .map((p): ItemDoChat => {
      const t = naTela(banco, p, agora())
      const m = p.marcacao!
      const tipo = NOMES_DO_TIPO[p.tipo]
      const onde = p.instancia === 'inss' ? 'INSS' : `judicial${t.perfil ? `, ${nomeCurto(t.perfil.perito.nome)}` : ''}`
      return {
        cliente: t.ficha.nome,
        acao: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        sub: `${onde} · ${dataCurta(m.data, hoje)}, ${m.hora}${p.preparacao ? ' · orientação passada' : ''}`,
        href: `/casos/${p.processoId}/pericia`,
      }
    })
  if (itens.length === 0) return { texto: `Nenhuma perícia marcada até ${dataCurta(ate, hoje)}.`, itens }
  return {
    texto:
      `${itens.length === 1 ? 'Uma perícia' : `${itens.length} perícias`} até ${dataCurta(ate, hoje)}. Cada uma abre o processo do cliente, com a perícia em destaque. ` +
      'A orientação ao cliente é do Jurídico administrativo; a conferência do resultado é sua (DP.08).',
    itens,
  }
}

/**
 * "Como o Dr. A. Prado costuma avaliar problemas de coluna?" (Figma 2186:2): os números do sistema, com a amostra (G22), e o
 * que a IA resume dos laudos; as perícias e as conferências com o perito. Sem perito citado, nada.
 */
export function comoOPeritoAvalia(texto: string): { texto: string; itens: ItemDoChat[] } | null {
  const banco = lerComPericias()
  const hoje = hojeIso(agora())
  const perito = peritosDo(banco).find((p) => new RegExp(`\\b${nomeCurto(p.nome).split(' ').at(-1)}\\b`, 'i').test(texto))
  if (!perito) return null
  const perfil = perfilDoPerito(perito)
  const j = perfil.jurimetria
  const geral = numerosDaJurimetria(j, hoje)
  const doAssunto = perfil.porAssunto.find((a) => new RegExp(`\\b${a.assunto.split(' ')[0]}`, 'i').test(texto))
  const assunto = !doAssunto
    ? ''
    : ` Em ${doAssunto.assunto}: ${numerosDaJurimetria(doAssunto.jurimetria, hoje)} (G22).`
  const pericias = (banco.pericias ?? []).filter((p) => p.peritoId === perito.id)
  const itens = pericias.map((p): ItemDoChat => {
    const t = naTela(banco, p, agora())
    const m = p.marcacao
    if (t.situacao === 'aguardando-resultado' || t.situacao === 'concluida') {
      return { cliente: t.ficha.nome, acao: 'Conferir resultado da perícia', sub: `perícia de ${m ? dataCurta(m.data, hoje) : '—'} com ${nomeCurto(perito.nome)}`, href: `/casos/${p.processoId}/pericia/resultado` }
    }
    const tipo = NOMES_DO_TIPO[p.tipo]
    return {
      cliente: t.ficha.nome,
      acao: tipo.charAt(0).toUpperCase() + tipo.slice(1),
      sub: `${m ? `${diaFalado(m.data)}, ${m.hora} · ${m.local}` : NOMES_DA_SITUACAO_CURTA[t.situacao]} · com ${nomeCurto(perito.nome)}`,
      href: `/casos/${p.processoId}/pericia`,
    }
  })
  return {
    texto: `Pelo acervo, ${nomeCurto(perito.nome)} tem ${geral}.${assunto} Costuma perguntar ${perfil.perguntou.join(' e ')}. Os números vêm do sistema; eu só resumo os laudos.`,
    itens: [
      ...(pericias[0] ? [{ cliente: nomeCurto(perito.nome), acao: 'Ver o perfil do perito', sub: `${geral} · o que costuma perguntar`, href: `/casos/${pericias[0].processoId}/pericia?perito=1` }] : []),
      ...itens,
    ],
  }
}

// GGVP-73 · Atualizar o perfil do perito (DP.09, sem tela própria).

/** A IA roda de novo sobre o laudo registrado: o mesmo laudo não se duplica no perfil (CA5). */
export function atualizarPerfilComOLaudo(processoId: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/laudo/perfil')
  return mudar(processoId, (n) => mudancas.perfilComOLaudo(n), exigirResultado)
}

/** A pergunta de um clique (CA6): ligado o perito, o laudo sai da espera e entra no perfil dele. */
export function ligarPeritoDoLaudo(processoId: string, peritoId: string, quem: string): Promise<PericiaNaTela> {
  if (doServidor(processoId)) return naApi(processoId, '/laudo/perito', { peritoId })
  return mudar(processoId, (n) => mudancas.peritoDoLaudo(n, peritoId, quem), (banco, id) => {
    const pericia = periciaDoResultado(banco, id)
    if (pericia?.resultado?.noPerfil !== 'aguardando-perito') throw new Error('Este laudo não espera o perito.')
    return pericia
  })
}
