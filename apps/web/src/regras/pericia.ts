// Perícia (épico GGVP-10): regras puras, sem React. Prazo e número são código com teste (G19); o servidor de exemplo e,
// depois, o de verdade usam as mesmas. Os nomes seguem os do servidor do Mateus (tabela `pericia`, perfil `juridico_adm`).
import { dataParaIso } from '../campos.ts'
import { somarDias } from './agenda.ts'
import { taxaComCasos } from './caso.ts'
import { dataCurta, hojeIso } from './datas.ts'
import { problemaG20 } from './parecer.ts'

export type TipoDePericia = 'medica' | 'social'
export type Instancia = 'inss' | 'juizo'
/** Quem pediu a perícia: D2 (decisão da advogada no D2.03 ou exigência do INSS), D3 (despacho da sênior) ou D3a (juiz). */
export type OrigemDaPericia = 'd2-necessidade' | 'd2-exigencia' | 'd3-despacho' | 'd3a-juiz'

export const NOMES_DO_TIPO: Record<TipoDePericia, string> = { medica: 'perícia médica', social: 'avaliação social' }
export const NOMES_DA_INSTANCIA: Record<Instancia, string> = { inss: 'INSS', juizo: 'Juízo' }

/** De onde a perícia veio: o rótulo do que veio preenchido (CA3), o passo de origem e como o caso mostra "Em perícia" (CA1). */
export const ORIGENS: Record<OrigemDaPericia, { rotulo: string; passo: string; caso: string }> = {
  'd2-necessidade': { rotulo: 'D2 · necessidade inicial', passo: 'D2.03', caso: 'pedido ao INSS (D2)' },
  'd2-exigencia': { rotulo: 'D2 · exigência do INSS', passo: 'D2.05', caso: 'exigência do INSS (D2)' },
  'd3-despacho': { rotulo: 'D3 · despacho da sênior', passo: 'D3.03', caso: 'despacho da sênior (D3)' },
  'd3a-juiz': { rotulo: 'D3a · pedido do juiz', passo: 'D3a.01', caso: 'pedido do juiz (D3a)' },
}

/** O D2 espera o INSS liberar o agendamento (D2.E1) antes de a tarefa aparecer; D3 e D3a já nascem liberados (CA2). */
export const esperaOInss = (origem: OrigemDaPericia) => origem.startsWith('d2')

/** Tentativa de marcar: uma por dia (Lucas, 02/10: "tem que ser diário"). */
export const DIAS_ENTRE_TENTATIVAS = 1
/** Os documentos da perícia ficam prontos até 10 dias antes dela (Lucas, 02/10, GGVP-56). */
export const DIAS_ANTES_DOCUMENTOS = 10
/** A preparação do cliente acontece até 3 dias antes da perícia (Lucas, 02/10, GGVP-56). */
export const DIAS_ANTES_PREPARO = 3

/** Os prazos que a data da perícia define: documentos, preparação, lembrete e o dia seguinte. */
export function prazosDaPericia(data: string) {
  return {
    documentosAte: somarDias(data, -DIAS_ANTES_DOCUMENTOS),
    preparoAte: somarDias(data, -DIAS_ANTES_PREPARO),
    vespera: somarDias(data, -1),
    diaSeguinte: somarDias(data, 1),
  }
}

/** O dia da próxima tentativa de marcar: o da liberação, ou o dia seguinte à última tentativa sem sucesso. */
export function proximaTentativa(tentativas: { dia: string }[], liberadaNoDia: string): string {
  const ultima = tentativas.map((t) => t.dia).sort().at(-1)
  return ultima ? somarDias(ultima, DIAS_ENTRE_TENTATIVAS) : liberadaNoDia
}

/** O prazo como a Central lê: "hoje", "amanhã", "atrasada desde 05/10" ou "até 12/10". */
export function prazoFalado(dia: string, hoje: string): { texto: string; urgente: boolean } {
  if (dia === hoje) return { texto: 'hoje', urgente: true }
  if (dia < hoje) return { texto: `atrasada desde ${dataCurta(dia, hoje)}`, urgente: true }
  if (dia === somarDias(hoje, 1)) return { texto: 'amanhã', urgente: false }
  return { texto: `até ${dataCurta(dia, hoje)}`, urgente: false }
}

/** "Em perícia" ligado ao diagrama de origem (CA1); com a data, ela entra junto ("na ficha", GGVP-53 CA2). */
export function etapaEmPericia(
  p: { origem: OrigemDaPericia; tipo: TipoDePericia; marcacao?: { data: string; hora: string }; resultado?: { registrado?: { favoravel: boolean } } },
  hoje: string,
): string {
  // Com o resultado registrado, ele sobe no card do caso (GGVP-70, CA2).
  const r = p.resultado?.registrado
  if (r) return `Resultado da perícia · ${ORIGENS[p.origem].caso} · ${NOMES_DO_TIPO[p.tipo]} ${r.favoravel ? 'favorável' : 'desfavorável'}`
  const quando = p.marcacao ? ` em ${dataCurta(p.marcacao.data, hoje)}, ${p.marcacao.hora}` : ''
  return `Em perícia · ${ORIGENS[p.origem].caso} · ${NOMES_DO_TIPO[p.tipo]}${quando}`
}

/**
 * Limite de remarcações da perícia (G15). O cartão diz "a definir" (GGVP-53 CA9, GGVP-66 CA3): fica 2, como o da agenda
 * (Pedro, 05/10) e o padrão do servidor do Mateus. Parâmetro; levar ao Lucas.
 */
export const LIMITE_DE_REMARCACOES_DA_PERICIA = 2

/** Passou do limite: a perícia sai do Jurídico administrativo e sobe para a advogada responsável, nunca para a sênior (CA9). */
export const passouDoLimite = (p: { remarcacoes: number; autorizadas?: number }) =>
  p.remarcacoes > LIMITE_DE_REMARCACOES_DA_PERICIA + (p.autorizadas ?? 0)

export type SituacaoDaPericia = 'aguardando-inss' | 'marcar' | 'aguardando-comprovante' | 'agendada' | 'na-advogada' | 'aguardando-resultado' | 'concluida'

/** Onde a perícia está, para o cartão "Perícias" e para a tela do passo. */
export function situacaoDaPericia(p: {
  liberadaEm?: string
  esperaComprovante?: unknown
  marcacao?: { comparecimento?: { compareceu: boolean } }
  remarcacoes?: number
  autorizadas?: number
  resultado?: { registrado?: unknown }
}): SituacaoDaPericia {
  // O resultado registrado pela advogada fecha a perícia (GGVP-70): volta para quem pediu.
  if (p.resultado?.registrado) return 'concluida'
  // Compareceu (GGVP-66, CA5): espera o perito e o resultado (DP.E3, DP.E4).
  if (p.marcacao) return p.marcacao.comparecimento?.compareceu ? 'aguardando-resultado' : 'agendada'
  if (!p.liberadaEm) return 'aguardando-inss'
  if (passouDoLimite({ remarcacoes: p.remarcacoes ?? 0, autorizadas: p.autorizadas })) return 'na-advogada'
  return p.esperaComprovante ? 'aguardando-comprovante' : 'marcar'
}

export const NOMES_DA_SITUACAO: Record<SituacaoDaPericia, string> = {
  'aguardando-inss': 'Esperando o INSS',
  marcar: 'Para marcar',
  'aguardando-comprovante': 'Esperando o comprovante',
  agendada: 'Agendada',
  'na-advogada': 'Com a advogada',
  'aguardando-resultado': 'Esperando o resultado',
  concluida: 'Concluída',
}

export const MINIMO_DO_QUE_ACONTECEU = 5

/** A tentativa sem sucesso pede o dia e o que aconteceu (CA1). O dia não é futuro. Sem problema, null. */
export function motivoParaNaoRegistrarTentativa(t: { dia: string | null; oQueAconteceu: string }, hoje: string): string | null {
  if (!t.dia) return 'Informe o dia da tentativa (dd/mm/aaaa).'
  if (t.dia > hoje) return 'O dia da tentativa não pode ser no futuro.'
  if (t.oQueAconteceu.trim().length < MINIMO_DO_QUE_ACONTECEU) return 'Diga o que aconteceu na tentativa.'
  return null
}

/** O que o sistema leu do comprovante do INSS (CA2). O perito não vem no comprovante. */
export type LidoDoComprovante = { data: string; hora: string; local: string; modalidade: string; tipo: TipoDePericia }

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * "Registrar a perícia" só habilita com as decisões respondidas e o comprovante anexado (CA3, CA4). A leitura conferida
 * não pode ter data passada. Sem problema, null.
 */
export function motivoParaNaoRegistrarMarcacao(
  m: { comprovante?: string; lido?: { data: string | null; hora: string; local: string }; pedeDocumentoNovo?: boolean },
  hoje: string,
): string | null {
  if (!m.comprovante) return 'Anexe o comprovante do INSS (PDF).'
  if (!m.lido) return 'Espere a leitura do comprovante.'
  if (!m.lido.data || m.lido.data < hoje) return 'Confira a data da perícia: ela não pode ser passada.'
  if (!HORA.test(m.lido.hora)) return 'Confira a hora da perícia.'
  if (m.lido.local.trim().length < 3) return 'Confira o local da perícia.'
  if (m.pedeDocumentoNovo === undefined) return 'Responda se a perícia pede documento novo.'
  return null
}

/** O que levar, pelo tipo da perícia: vai no lembrete da véspera (CA7) e na orientação (GGVP-61, CA7). */
export const O_QUE_LEVAR: Record<TipoDePericia, string> = {
  medica: 'documento com foto, carteira de trabalho, laudos, exames, receitas e atestados',
  social: 'documento com foto de quem mora na casa, o CadÚnico e os comprovantes de renda e de despesas',
}

/** O lembrete da véspera (CA7): data, hora, local e o que levar, em linguagem simples. Vai pelo Chatwoot, revisado (Q5). */
export function mensagemDoLembrete(d: { nome: string; tipo: TipoDePericia; data: string; hora: string; local: string }, diaFalado: string): string {
  const primeiro = d.nome.split(' ')[0]
  const onde = d.tipo === 'social' ? `A visita da assistente social é na sua casa (${d.local}).` : `O local é ${d.local}.`
  return (
    `Olá, ${primeiro}! Aqui é do escritório GGV. Lembrete: a sua ${NOMES_DO_TIPO[d.tipo]} é amanhã, ${diaFalado}, às ${d.hora}. ${onde} ` +
    `Leve ${O_QUE_LEVAR[d.tipo]}. Chegue com antecedência. Qualquer dúvida, é só responder esta mensagem.`
  )
}

/** A falta de um item da perícia é registrada com justificativa (GGVP-56, CA5). */
export const MINIMO_DA_FALTA = 5

/**
 * "Concluir" só habilita com cada item anexado ou com a falta justificada, e com as conferências marcadas (GGVP-56, CA5).
 * Sem problema, null.
 */
export function motivoParaNaoConcluirDocumentos(d: { faltando: number; conferidas: string[]; exigidas: string[] }): string | null {
  if (d.faltando > 0) return d.faltando === 1 ? 'Falta 1 item: anexe ou registre a falta com justificativa.' : `Faltam ${d.faltando} itens: anexe ou registre a falta com justificativa.`
  if (!d.exigidas.every((c) => d.conferidas.includes(c))) return 'Marque as conferências.'
  return null
}

/** A cobrança da perícia é diária e vai até 10 dias antes dela (Lucas, 02/10): hoje ainda não cobrou e não passou do limite. */
export function cobrarHoje(cobrancas: { dia: string }[], hoje: string, documentosAte?: string): boolean {
  return !cobrancas.some((c) => c.dia === hoje) && !passouDoLimiteDosDocumentos(hoje, documentosAte)
}

/** Passou dos 10 dias antes da perícia com documento faltando: sobe para a advogada responsável (G15, por ser perícia). */
export const passouDoLimiteDosDocumentos = (hoje: string, documentosAte?: string) => documentosAte !== undefined && hoje > documentosAte

// GGVP-61 · A orientação da perícia, padrão ou pelo perfil do perito.

/**
 * A jurimetria do perito (G22, Lucas em 06/10 e Pedro em 07/10, no lugar do mínimo de 10 laudos de 02/10): não há amostra
 * mínima, toda amostra conta, e toda porcentagem aparece com o número de laudos e a data da base.
 */
export type Jurimetria = { laudos: number; favoraveis: number; taxa: number; diasAteOLaudo: number }

/** Os laudos favoráveis do perito, pela regra única do G22 (`taxaComCasos`): "71% · 24 de 34 laudos · base de 07/10". */
export function numerosDaJurimetria(j: Jurimetria, base: string): string {
  return j.laudos ? taxaComCasos(j.favoraveis, j.laudos, base, 'laudos') : 'nenhum laudo no acervo'
}

/** Os números vêm do sistema, não do modelo (G19, G22): contagem, taxa favorável e tempo médio até o laudo. */
export function jurimetria(laudos: { resultado: 'favoravel' | 'desfavoravel'; dias: number }[]): Jurimetria {
  const favoraveis = laudos.filter((l) => l.resultado === 'favoravel').length
  const n = laudos.length
  return {
    laudos: n,
    favoraveis,
    taxa: n ? Math.round((favoraveis / n) * 100) : 0,
    diasAteOLaudo: n ? Math.round(laudos.reduce((s, l) => s + l.dias, 0) / n) : 0,
  }
}

export type ModoDaOrientacao = 'padrao' | 'perfil'

/**
 * A regra unificada (Lucas, 02/10): sabendo quem é o perito e tendo perfil no acervo, a orientação sai pelo perfil, seja
 * médica ou social, no INSS ou no juízo. Não sabendo, sai a padrão e registra o motivo (CA2, CA5, CA6).
 */
export function escolherOrientacao(p: { instancia: Instancia; peritoId?: string; peritoLido?: string; temPerfil: boolean }): { modo: ModoDaOrientacao; motivo?: string } {
  if (p.peritoId && p.temPerfil) return { modo: 'perfil' }
  if (p.peritoId) return { modo: 'padrao', motivo: 'o perito ainda não tem perfil no acervo' }
  if (p.peritoLido) return { modo: 'padrao', motivo: `o sistema não reconheceu o perito ${p.peritoLido}: ligue o perito certo na página do processo` }
  return { modo: 'padrao', motivo: p.instancia === 'inss' ? 'o comprovante do INSS não traz o perito: informe quando o nome chegar' : 'o perito ainda não foi nomeado' }
}

/** Instruções que a orientação nunca dá (G11): esconder, mudar, simular a situação real, mentir; e a frase pronta (G20). */
const REGRAS_G11: [RegExp, string][] = [
  [/\b(escond|ocult|omit)\w*/i, 'A orientação nunca manda esconder ou omitir a situação real (G11).'],
  [/\b(simul|fing|finj|disfar[cç])\w*/i, 'A orientação nunca manda simular ou fingir (G11).'],
  [/\bment(ir|ira)\b|\bmint(a|am)\b|\bmentira/i, 'A orientação nunca manda mentir (G11).'],
  [
    /\b(mud|alter|troqu|tir|retir|empreste|emprest)\w*\s+(\S+\s+){0,3}(a situa[cç][aã]o|da casa|a casa|m[oó]ve|carro|moto|eletro|geladeira|televis|tv\b|renda|quem mora)/i,
    'A orientação nunca manda mudar a situação real da casa (G11).',
  ],
  [/\b(diga|fale|responda|conte|repita)\s+(ao perito\s+|à perita\s+|à assistente social\s+|ao médico\s+)?que\b/i, 'Sem frase pronta para o cliente repetir (G20).'],
  [/\bexager[ea]\b|\baumente\b|\bpiore\b/i, 'A orientação nunca manda exagerar a situação (G11).'],
]

/**
 * A verificação antes de a orientação chegar ao Jurídico administrativo (CA4, CA8, CA10): G11 e G20 (sem diagnóstico, CID,
 * grau, conclusão nem frase pronta). Encontrou, bloqueia e pede revisão. Sem problema, null.
 */
export function problemaDaOrientacao(texto: string): string | null {
  return REGRAS_G11.find(([regra]) => regra.test(texto))?.[1] ?? problemaG20(texto)
}

const PEDIDO_PROIBIDO = /\b(escond|ocult|omit|simul|fing|finj|disfar[cç]|ment(ir|ira)\b|mint(a|am)\b|mentira|exager)|\b(mud|alter|tir|retir)\w*\s+(\S+\s+){0,3}(a situa[cç][aã]o|da casa|a casa|m[oó]ve|carro|geladeira|televis|renda)/i

/** O chat recusa pedir orientação para esconder, mudar ou simular a situação real (CA11, G11). Outro pedido, null. */
export function recusaDoChatNaPericia(texto: string): string | null {
  return PEDIDO_PROIBIDO.test(texto)
    ? 'Não posso orientar a esconder, mudar ou simular a situação real: isso é fraude e põe o processo e o escritório em risco (G11). O pedido ficou registrado.'
    : null
}

// GGVP-66 · Comparecimento e remarcação (DP.07).

/**
 * Até que hora da véspera a presença tem de estar confirmada (CA8). O cartão diz "a definir": fica 16h, parâmetro; levar ao
 * Lucas.
 */
export const HORA_DA_CONFIRMACAO = 16

/** Passou o dia e a hora da perícia: dá para registrar o comparecimento (CA1). */
export function periciaJaPassou(m: { data: string; hora: string }, agora: Date): boolean {
  const [ano, mes, dia] = m.data.split('-').map(Number)
  const [hora, minuto] = m.hora.split(':').map(Number)
  return agora.getTime() >= new Date(ano, mes - 1, dia, hora, minuto).getTime()
}

/**
 * A confirmação de presença (CA7, CA8): antes da véspera, ainda não; na véspera até 16h, a fazer; depois disso (e no dia),
 * atrasada: contatar o cliente.
 */
export function confirmacaoDaPresenca(data: string, agora: Date): 'ainda-nao' | 'fazer' | 'atrasada' {
  const vespera = somarDias(data, -1)
  const hoje = hojeIso(agora)
  if (hoje < vespera) return 'ainda-nao'
  return hoje === vespera && agora.getHours() < HORA_DA_CONFIRMACAO ? 'fazer' : 'atrasada'
}

// GGVP-70 · Conferir o resultado e decidir o próximo passo (DP.08, DP.10).

/**
 * As conferências antes de registrar o resultado (Figma 1579:431; Lucas, 02/10: seguem como estão). Na avaliação social, o
 * parecer médico e a DII não se aplicam: ficam a leitura do laudo e a contradição com o benefício.
 */
export const CONFERENCIAS_DO_RESULTADO: Record<TipoDePericia, { id: string; rotulo: string }[]> = {
  medica: [
    { id: 'laudo', rotulo: 'Li o laudo na íntegra' },
    { id: 'parecer', rotulo: 'Parecer médico "Suficiente" confirmado por pessoa (G17)' },
    { id: 'dii', rotulo: 'DII compatível com carência e qualidade de segurado — calculado por código (G19)' },
    { id: 'beneficio', rotulo: 'Sem contradição com o benefício pedido (G18)' },
  ],
  social: [
    { id: 'laudo', rotulo: 'Li o laudo na íntegra' },
    { id: 'beneficio', rotulo: 'Sem contradição com o benefício pedido (G18)' },
  ],
}

/** "Registrar resultado" só com o laudo anexado, o resultado, a decisão do desfavorável e as conferências (CA5). Sem problema, null. */
export function motivoParaNaoRegistrarResultado(
  r: { laudo: boolean; favoravel?: boolean; novaPericia?: boolean; conferidas: string[] },
  exigidas: string[],
): string | null {
  if (!r.laudo) return 'Anexe o laudo ou o registro do GERID.'
  if (r.favoravel === undefined) return 'Informe se o resultado foi favorável ou desfavorável.'
  if (!r.favoravel && r.novaPericia === undefined) return 'Desfavorável: decida se vale pedir nova perícia.'
  if (exigidas.some((c) => !r.conferidas.includes(c))) return 'Marque as conferências antes de registrar.'
  return null
}

/** O prazo para manifestar sobre o laudo no judicial (G12): 15 dias corridos, o lado seguro (em dias úteis daria mais). */
export const DIAS_PARA_MANIFESTAR = 15
export const prazoParaManifestar = (desde: string) => somarDias(desde, DIAS_PARA_MANIFESTAR)

/**
 * A perícia pedida pelo juiz (D3a, resposta do Lucas de 02/10, GGVP-53): a data, a hora e o local que o juízo designou,
 * lidos da frase da publicação que fala da perícia ("perícia médica designada para 15/10/2026, às 10h30, na sala de
 * perícias…"). Sem data e hora válidas na frase, nada: o Jurídico administrativo registra quando a data sair.
 * ponytail: lê o formato do diário; a leitura pela IA entra se aparecer publicação em outro formato.
 */
export function dataDoJuizoNaPublicacao(texto: string): { data: string; hora: string; local: string } | null {
  for (const frase of texto.split(/\.(?=\s|$)/)) {
    const i = frase.search(/per[ií]cia/i)
    if (i < 0) continue
    const m = /(\d{2}\/\d{2}\/\d{4})\D{0,30}?\b(\d{1,2})(?:[hH](\d{2})?|:(\d{2}))/.exec(frase.slice(i))
    const data = m && dataParaIso(m[1])
    if (!m || !data) continue
    const hora = `${m[2].padStart(2, '0')}:${m[3] ?? m[4] ?? '00'}`
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) continue
    const local = /(?:local:?|\b(?:na|no|em))\s+(.+)/i.exec(frase.slice(i + m.index + m[0].length))?.[1].trim()
    return { data, hora, local: local || 'local indicado na publicação' }
  }
  return null
}

/** Como o diagrama de origem segue com o resultado (CA2, CA4, CA6). */
export const COMO_SEGUE: Record<OrigemDaPericia, string> = {
  'd2-necessidade': 'o D2 segue: completa a junção antes da vigília do INSS',
  'd2-exigencia': 'o D2 segue: volta à vigília do INSS (D2.04)',
  'd3-despacho': 'volta ao judicial (D3): manifestar sobre o laudo',
  'd3a-juiz': 'volta ao judicial (D3a): manifestar sobre o laudo',
}
