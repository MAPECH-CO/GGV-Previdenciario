// O caso numa linha só (GGVP-86): regras puras, sem React. Etapas, fase, identificação, prazos da fase, ordem da linha e
// números da jurimetria são código com teste (G19); o servidor de exemplo e, depois, o de verdade usam as mesmas.
import { formatarCnj, formatarNb, validarCnj, validarNb } from '../campos.ts'

/** As cinco etapas do caso, na ordem do BPMN (CA1). */
export type IdEtapa = 'entrevista' | 'inss' | 'justica' | 'vigilia' | 'desfecho'

export const ETAPAS_DO_CASO: { id: IdEtapa; rotulo: string; diagrama: string; descricao: string }[] = [
  { id: 'entrevista', rotulo: 'Entrevista', diagrama: 'D1', descricao: 'entrevista, benefício e documentos' },
  { id: 'inss', rotulo: 'INSS', diagrama: 'D2', descricao: 'via administrativa no INSS' },
  { id: 'justica', rotulo: 'Justiça', diagrama: 'D3', descricao: 'judicialização' },
  { id: 'vigilia', rotulo: 'Vigília', diagrama: 'D3a', descricao: 'vigília e exigências do juiz' },
  { id: 'desfecho', rotulo: 'Desfecho', diagrama: 'D3b', descricao: 'desfecho do mérito' },
]

/** Feita, a atual, ainda não chegou, ou não se aplica a este caso (apagada). */
export type EstadoDaEtapa = 'feita' | 'atual' | 'futura' | 'nao-se-aplica'

export type Fase = 'administrativa' | 'judicial'

/** A etapa em que o caso está, pelo texto da etapa do processo ("Judicial · exigência", "Administrativo · perícia"...). */
export function etapaAtual(etapa: string): IdEtapa {
  const t = etapa.toLowerCase()
  if (t.startsWith('judicial')) {
    if (/senten[cç]a|ac[oó]rd[aã]o|recurso|presta[cç][aã]o de contas|rpv|precat[oó]rio|tr[aâ]nsito/.test(t)) return 'desfecho'
    if (/peti[cç][aã]o|despacho|ajuiz|protocolo/.test(t)) return 'justica'
    return 'vigilia'
  }
  if (t.startsWith('administrativo') || /deferido|indeferido|inss/.test(t)) return 'inss'
  return 'entrevista'
}

/** Judicial quando a etapa é judicial ou o número é CNJ (CA12, CA13). */
export function faseDoCaso(p: { etapa: string; numero?: string }): Fase {
  return etapaAtual(p.etapa) === 'justica' || p.etapa.toLowerCase().startsWith('judicial') || (p.numero !== undefined && validarCnj(p.numero))
    ? 'judicial'
    : 'administrativa'
}

/**
 * O estado de cada etapa (CA1). Antes da atual, feita; depois, ainda não chegou. Não se aplicam: a Justiça, a vigília e
 * o desfecho do mérito quando o INSS deferiu; o INSS quando o caso foi direto à Justiça.
 */
export function estadosDasEtapas(atual: IdEtapa, o: { deferidoNoInss?: boolean; semInss?: boolean } = {}): Record<IdEtapa, EstadoDaEtapa> {
  const ordem = ETAPAS_DO_CASO.map((e) => e.id)
  const a = ordem.indexOf(atual)
  const estados = Object.fromEntries(ordem.map((id, i) => [id, i < a ? 'feita' : i === a ? 'atual' : 'futura'])) as Record<IdEtapa, EstadoDaEtapa>
  if (o.deferidoNoInss && atual === 'inss') for (const id of ['justica', 'vigilia', 'desfecho'] as const) estados[id] = 'nao-se-aplica'
  if (o.semInss && a > ordem.indexOf('inss')) estados.inss = 'nao-se-aplica'
  return estados
}

const ETAPA_DO_DIAGRAMA: Record<string, IdEtapa> = { D1: 'entrevista', D2: 'inss', D3: 'justica', D3a: 'vigilia', D3b: 'desfecho', D4: 'desfecho' }

/** A etapa de um passo do BPMN ("D2.05", "D3a.E2"); o D4 (acervo) vem depois do desfecho. Perícia (DP) e passo sem código: null. */
export function etapaDoPasso(passo: string | null | undefined): IdEtapa | null {
  const diagrama = /^(D\d[ab]?)\./.exec(passo ?? '')?.[1]
  return (diagrama && ETAPA_DO_DIAGRAMA[diagrama]) || null
}

const ETAPA_DA_FASE: Record<string, IdEtapa> = { atendimento: 'entrevista', administrativa: 'inss', judicial: 'justica', encerrado: 'desfecho' }

/**
 * A etapa de um caso do servidor (GGVP-146, parte 5): a mais adiantada entre os passos abertos (etapas e tarefas); sem
 * nenhum, a da fase. O caso deferido no INSS fica na etapa do INSS.
 */
export function etapaAtualDoCaso(fase: string, passosAbertos: (string | null)[], desfecho: string | null): IdEtapa {
  const ordem = ETAPAS_DO_CASO.map((e) => e.id)
  const abertas = passosAbertos.map(etapaDoPasso).filter((e): e is IdEtapa => e !== null)
  if (abertas.length) return abertas.reduce((a, b) => (ordem.indexOf(b) > ordem.indexOf(a) ? b : a))
  if (desfecho === 'deferido') return 'inss'
  return ETAPA_DA_FASE[fase] ?? 'entrevista'
}

/** A perícia fica ligada à etapa que pediu (CA2): pedido ou exigência do INSS (D2), despacho (D3), juiz (D3a). */
export function etapaDaOrigem(origem: string): IdEtapa {
  if (origem.startsWith('d2')) return 'inss'
  if (origem === 'd3-despacho') return 'justica'
  return 'vigilia'
}

/** Como o caso se identifica (CA13): NB ou protocolo na fase administrativa, CNJ com processo judicial. */
export function identificacao(fase: Fase, p: { numero?: string; nb?: string; protocolo?: string }): { rotulo: string; valor: string } {
  if (fase === 'judicial') return { rotulo: 'Processo (CNJ)', valor: !p.numero ? 'número CNJ ainda não lido' : validarCnj(p.numero) ? formatarCnj(p.numero) : p.numero }
  if (p.nb && validarNb(p.nb)) return { rotulo: 'NB', valor: formatarNb(p.nb) }
  if (p.protocolo) return { rotulo: 'Protocolo', valor: p.protocolo }
  return { rotulo: 'NB', valor: 'sem NB nem protocolo ainda' }
}

export type TipoDePrazo = 'prazo' | 'vigilia-meu-inss' | 'vigilia-publicacoes'

/** Só os prazos da fase (CA12): a vigília do Meu INSS na administrativa; a das publicações só com processo judicial. */
export function prazosDaFase<T extends { tipo: TipoDePrazo }>(fase: Fase, prazos: T[]): T[] {
  return prazos.filter((p) => (p.tipo === 'vigilia-meu-inss' ? fase === 'administrativa' : p.tipo === 'vigilia-publicacoes' ? fase === 'judicial' : true))
}

/** A linha do processo em ordem cronológica (CA10). Mesma hora, mantém a ordem em que foi gravado. */
export function emOrdem<T extends { quando: string }>(eventos: T[]): T[] {
  return eventos
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.quando < b.e.quando ? -1 : a.e.quando > b.e.quando ? 1 : a.i - b.i))
    .map((x) => x.e)
}

/** Os setores acionados que ainda não subiram o card (CA3, D3a.03 e D3.04). */
export function setoresPendentes<T extends { setor: string; subiu?: unknown }>(lacos: T[]): string[] {
  return [...new Set(lacos.filter((l) => !l.subiu).map((l) => l.setor))]
}

/**
 * Toda porcentagem de jurimetria, num lugar só (G22; Lucas 06/10, Pedro 07/10): sem amostra mínima, com o número de casos
 * ao lado e a data da base. "58% · 7 de 12 casos · base de 07/10".
 */
export function taxaComCasos(favoraveis: number, casos: number, base: string, unidade = 'casos'): string {
  if (casos === 0) return 'sem casos no acervo'
  const nome = casos === 1 ? unidade.replace(/s$/, '') : unidade
  return `${Math.round((favoraveis / casos) * 100)}% · ${favoraveis} de ${casos} ${nome} · base de ${base.slice(8, 10)}/${base.slice(5, 7)}`
}

/** A jurimetria do juízo por benefício (CA6): contagem, procedentes e tempo médio até a sentença, do acervo. */
export function jurimetriaDoJuizo(decisoes: { beneficio: string; procedente: boolean; meses: number }[], base: string) {
  const porBeneficio = new Map<string, { procedentes: number; casos: number }>()
  for (const d of decisoes) {
    const x = porBeneficio.get(d.beneficio) ?? { procedentes: 0, casos: 0 }
    x.casos++
    if (d.procedente) x.procedentes++
    porBeneficio.set(d.beneficio, x)
  }
  return {
    casos: decisoes.length,
    porBeneficio: [...porBeneficio].map(([beneficio, x]) => ({ beneficio, ...x, texto: taxaComCasos(x.procedentes, x.casos, base) })),
    mesesAteASentenca: decisoes.length ? Math.round(decisoes.reduce((s, d) => s + d.meses, 0) / decisoes.length) : 0,
  }
}

/** Quem vê o quê no caso: o Jurídico vê tudo; o Financeiro vê valores, sem saúde nem estratégia; os outros, sem os dois. */
export type VisaoDoCaso = 'juridico' | 'financeiro' | 'atendimento'

const JURIDICO = ['advogada', 'senior', 'juridico-adm']

export function visaoDoPerfil(perfil: string | undefined): VisaoDoCaso {
  if (perfil && JURIDICO.includes(perfil)) return 'juridico'
  if (perfil === 'financeiro') return 'financeiro'
  return 'atendimento'
}

/** Os valores do caso, cada um com a sua regra (orquestrador, 08/10). */
export type TipoDeValor = 'causa' | 'renda-por-pessoa' | 'prestacao-de-contas'

/**
 * Valores só para o Financeiro e o Sócio. Exceções da advogada: o valor da causa e a renda por pessoa do LOAS; os valores da
 * prestação de contas só no caso dela e quando o caso está na prestação de contas. O chat segue a mesma regra.
 */
export function podeVerValor(perfil: string | undefined, tipo: TipoDeValor, o: { advogadaDoCaso: boolean; naPrestacaoDeContas: boolean }): boolean {
  if (perfil === 'financeiro' || perfil === 'socio') return true
  if (perfil !== 'advogada') return false
  return tipo === 'prestacao-de-contas' ? o.advogadaDoCaso && o.naPrestacaoDeContas : true
}
