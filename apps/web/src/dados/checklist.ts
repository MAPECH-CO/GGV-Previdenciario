// EXEMPLO. Servidor de exemplo do checklist do benefício (GGVP-91), sobre o mesmo banco de servidor.ts. Os documentos
// são os que a leitura arquivou (GGVP-81). A lista de cada benefício é configuração do escritório (GGVP-104): aqui só a do
// LOAS, com que o portal nasce. Ligar no servidor: trocar o corpo de cada função por fetch no endpoint da spec da ggvp-91.
import { bloqueioDoAcidente, complementares, type TabelaDoAcidente } from '../regras/acidente.ts'
import { juntar, montarChecklist, type Checklist, type Condicao, type DocumentoDoCaso, type ListaDoBeneficio } from '../regras/checklist.ts'
import { acidenteDoCaso } from './acidente.ts'
import { nomeBeneficio } from './catalogos.ts'
import { contratos } from './contrato.ts'
import { leiturasDo } from './leitura.ts'
import { tiposDaSemente } from './parecer.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

/**
 * A lista do LOAS: o critério 7 do cartão GGVP-91 (ficha de grupo familiar e as três declarações condicionais), o que
 * levar do LOAS do cartão GGVP-21 (RG e CPF de todos da casa, comprovante de renda e CadÚnico) e o comprovante de
 * residência do Figma 10:466. Vale também para o mandado de segurança de LOAS.
 */
const LOAS: ListaDoBeneficio = {
  obrigatorios: ['rg', 'cpf', 'comprovante-residencia', 'comprovante-renda', 'cadunico', 'grupo-familiar'],
  condicionais: [
    { tipo: 'declaracao-moradia', quando: 'moradia' },
    { tipo: 'declaracao-uniao-estavel', quando: 'uniao-estavel' },
    { tipo: 'declaracao-separacao', quando: 'separacao-de-fato' },
  ],
}

/** O kit do Auxílio-Acidente do Figma 10:264 (GGVP-47): RG e CPF, CNIS e o laudo; o contrato entra sozinho, e a prova do acidente vem da tabela por circunstância. */
const AUXILIO_ACIDENTE: ListaDoBeneficio = { obrigatorios: ['rg', 'cpf', 'cnis', 'laudo'], condicionais: [] }

/** A configuração do escritório de exemplo: o LOAS e o Auxílio-Acidente têm lista aprovada (CA6, CA10). */
export const LISTAS_DE_DOCUMENTOS: Record<string, ListaDoBeneficio> = { 'loas-idoso': LOAS, 'loas-deficiente': LOAS, 'auxilio-acidente': AUXILIO_ACIDENTE }

/**
 * Os complementares do Auxílio-Acidente por circunstância (GGVP-47): resposta do Lucas de 01/10, que fecha a Q19. O Lucas
 * fixou a CAT, o PPP, o boletim (desejável em todas) e a regra do condicional; a ficha do pronto-socorro e os exames seguem a
 * lista da história como obrigatórios, e o prontuário como condicional da internação ou cirurgia. Levar ao Lucas: conferir.
 */
const PROVAS_DO_ACIDENTE = (cat: boolean, ppp: boolean, prontoSocorro: boolean) => [
  ...(cat ? [{ tipo: 'cat', exigencia: 'obrigatorio' as const }] : []),
  ...(ppp ? [{ tipo: 'ppp', exigencia: 'obrigatorio' as const }] : []),
  { tipo: 'boletim-ocorrencia', exigencia: 'desejavel' as const },
  ...(prontoSocorro ? [{ tipo: 'ficha-pronto-socorro', exigencia: 'obrigatorio' as const }] : []),
  { tipo: 'prontuario', exigencia: 'condicional' as const },
  { tipo: 'exame-imagem-epoca', exigencia: 'obrigatorio' as const },
  { tipo: 'exame-pos-alta', exigencia: 'obrigatorio' as const },
]

export const TABELA_DO_ACIDENTE: TabelaDoAcidente = {
  trabalho: PROVAS_DO_ACIDENTE(true, false, true),
  trajeto: PROVAS_DO_ACIDENTE(true, false, true),
  // Na doença ocupacional o nexo pode vir pelo NTEP: o PPP é obrigatório, e não há pronto-socorro.
  ocupacional: PROVAS_DO_ACIDENTE(true, true, false),
  transito: PROVAS_DO_ACIDENTE(false, false, true),
  domestico: PROVAS_DO_ACIDENTE(false, false, true),
}

const SEM_CIRCUNSTANCIA = 'Marque a circunstância do acidente: o que é obrigatório depende dela.'

let listas = LISTAS_DE_DOCUMENTOS

/** Para o teste: o escritório monta ou muda a lista na configuração (CA10). Sem argumento, volta à de exemplo. */
export function configurarListas(novas: Record<string, ListaDoBeneficio> = LISTAS_DE_DOCUMENTOS) {
  listas = novas
}

/** O que a IA listou da entrevista e a advogada conferiu (GGVP-46), por caso: as condições e os documentos (CA7, CA8). */
export const DA_ENTREVISTA: Record<string, { condicoes: Condicao[]; documentos: string[] }> = {
  // A Rita mora na casa da irmã e o laudo prova a deficiência.
  'rita-exemplo-1': { condicoes: ['moradia'], documentos: ['laudo'] },
  // A exigência do juiz: provar o trabalho rural (D1.23 na semente).
  'antonio-exemplo-1': { condicoes: [], documentos: ['notas-produtor', 'certidao'] },
}

/**
 * O contrato do caso já foi assinado (GGVP-72, GGVP-77): da leitura em diante. Caso sem contrato no portal, aberto antes dele,
 * vale a etapa do processo: assinado quando já saiu das etapas "Contrato · …".
 */
export function contratoAssinado(banco: Banco, processo: Processo): boolean {
  const contrato = contratos(banco).find((c) => c.processoId === processo.id)
  if (!contrato) return !processo.etapa.startsWith('Contrato ·')
  return ['leitura', 'conferir', 'copia', 'entregue'].includes(contrato.etapa)
}

/** As miniaturas da semente ("RG", "CNIS"...), com o tipo da lista única. */
const LEGADO: Record<string, string> = { RG: 'rg', CPF: 'cpf', 'Comp. residência': 'comprovante-residencia', CNIS: 'cnis', CTPS: 'ctps', Procuração: 'procuracao' }

/** Os documentos classificados do caso: Documentos pessoais, que valem para todo processo do cliente (CA9), a subpasta deste processo e a quarentena. */
function documentosDoCaso(banco: Banco, ficha: Ficha, processoId: string): DocumentoDoCaso[] {
  const leituras = leiturasDo(banco).filter((l) => l.fichaId === ficha.id)
  const legado = ficha.documentos.flatMap((d) => (LEGADO[d.nome] ? [{ tipo: LEGADO[d.nome] }] : []))
  const daPasta = ficha.arquivos
    .filter((a) => !a.aguardaLeitura && (a.local === 'pessoais' || a.local === processoId))
    .map((a) => {
      const lido = leituras.find((l) => l.arquivo === a.nome)
      return { tipo: a.tipo, semAssinatura: lido?.semAssinatura, dataEmBranco: lido?.dataEmBranco }
    })
  const quarentena = leituras.filter((l) => l.situacao === 'quarentena').map((l) => ({ tipo: l.tipo, quarentena: true }))
  // Os documentos médicos da semente do parecer (GGVP-20) também estão na pasta do caso (GGVP-47).
  const daSemente = tiposDaSemente(processoId).map((tipo) => ({ tipo }))
  return [...legado, ...daPasta, ...daSemente, ...quarentena]
}

/** Uma conferência do checklist: quem conferiu fica no histórico da ficha. */
export type ConferenciaDoChecklist = { processoId: string; quando: string; completo: boolean; faltam: string[] }

export type ChecklistDoCaso = {
  ficha: Ficha
  processo: Processo
  beneficio: string
  checklist: Checklist
  /** As condições do caso que puxaram declarações (CA7). */
  condicoes: Condicao[]
  /** A última conferência, se já houve. */
  conferencia?: ConferenciaDoChecklist
}

function montar(banco: Banco, processoId: string): ChecklistDoCaso | null {
  const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === processoId))
  const processo = ficha?.processos.find((p) => p.id === processoId)
  if (!ficha || !processo) return null
  const entrevista = DA_ENTREVISTA[processoId] ?? { condicoes: [], documentos: [] }
  // No Auxílio-Acidente, a circunstância marcada traz os complementares e o bloqueio da categoria (GGVP-47).
  const acidente = processo.beneficio === 'auxilio-acidente' ? acidenteDoCaso(banco, processoId) : undefined
  const bloqueio = processo.beneficio !== 'auxilio-acidente' ? undefined : acidente ? bloqueioDoAcidente(acidente) : SEM_CIRCUNSTANCIA
  const checklist = montarChecklist({
    lista: listas[processo.beneficio],
    condicoes: entrevista.condicoes,
    daEntrevista: entrevista.documentos,
    documentos: documentosDoCaso(banco, ficha, processoId),
    contratoAssinado: contratoAssinado(banco, processo),
    ...(acidente && { complementares: complementares(TABELA_DO_ACIDENTE, acidente) }),
    ...(bloqueio && { bloqueio }),
  })
  const conferencia = banco.checklists?.filter((c) => c.processoId === processoId).at(-1)
  return { ficha, processo, beneficio: nomeBeneficio(processo.beneficio), checklist, condicoes: entrevista.condicoes, conferencia }
}

/** O checklist do caso, já calculado, para outro arquivo do servidor de exemplo (liberação e cobrança). */
export function checklistDoCaso(banco: Banco, processoId: string): ChecklistDoCaso | null {
  return montar(banco, processoId)
}

/** GET /api/processos/:id/checklist */
export async function obterChecklist(processoId: string): Promise<ChecklistDoCaso | null> {
  const banco = ler()
  const resultado = montar(banco, processoId)
  gravar(banco)
  return resultado
}

/** POST /api/processos/:id/checklist/conferencia. A situação é a calculada, nunca a marcada à mão (CA5). */
export async function conferirChecklist(processoId: string): Promise<ConferenciaDoChecklist> {
  await esperar()
  const banco = ler()
  const caso = montar(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  const { checklist, beneficio, ficha } = caso
  const conferencia: ConferenciaDoChecklist = { processoId, quando: agora().toISOString(), completo: checklist.completo, faltam: checklist.faltam }
  banco.checklists = [...(banco.checklists ?? []), conferencia]
  const situacao = !checklist.temLista
    ? 'sem lista de documentos aprovada para o benefício'
    : checklist.bloqueio
      ? `travado: ${checklist.bloqueio}`
      : checklist.completo
      ? 'completo'
      : `incompleto; falta: ${juntar(checklist.faltam)}`
  ficha.historico.push(evento(`Conferiu o checklist do ${beneficio}: ${situacao}`))
  gravar(banco)
  return conferencia
}

/** "Conferir checklist" na Central do Atendimento: o caso cuja leitura terminou depois da última conferência (GGVP-81, CA4). */
export function tarefasDeConferirChecklist(): Tarefa[] {
  const banco = ler()
  const leituras = leiturasDo(banco)
  const tarefas = banco.fichas.flatMap((ficha) => {
    const daFicha = leituras.filter((l) => l.fichaId === ficha.id)
    // Primeiro a leitura: com documento a conferir, o checklist ainda espera.
    const ultimo = daFicha.map((l) => l.arquivadoEm ?? '').sort().at(-1)
    const processo = ficha.processos[0]
    if (!processo || !ultimo || daFicha.some((l) => l.situacao === 'a-conferir')) return []
    const caso = montar(banco, processo.id)
    if (!caso || (caso.conferencia && caso.conferencia.quando >= ultimo)) return []
    const recebidos = caso.checklist.itens.filter((i) => i.situacao === 'recebido').length
    return [
      {
        id: `checklist-${processo.id}`,
        codigo: 'D1.21',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Conferir checklist',
        detalhe: `${caso.beneficio} · ${recebidos} de ${caso.checklist.itens.length} itens recebidos · leitura arquivada`,
        prazo: 'hoje',
        href: `/casos/${processo.id}/checklist`,
        processoId: processo.id,
      },
    ]
  })
  gravar(banco)
  return tarefas
}
