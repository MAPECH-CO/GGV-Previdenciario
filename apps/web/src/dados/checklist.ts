// EXEMPLO. Servidor de exemplo do checklist do benefício (GGVP-91), sobre o mesmo banco de servidor.ts. Os documentos
// são os que a leitura arquivou (GGVP-81). A lista de cada benefício é configuração do escritório (GGVP-104): aqui só a do
// LOAS, com que o portal nasce. Ligar no servidor: trocar o corpo de cada função por fetch no endpoint da spec da ggvp-91.
import {
  complementaresDoCaso,
  contratoAssinadoDo,
  documentosDoCaso,
  juntar,
  montarChecklist,
  type ChecklistDoCaso,
  type ChecklistNaCopia,
  type Condicao,
  type ConferenciaDoChecklist,
  type ListaDoBeneficio,
} from '../regras/checklist.ts'
import { acidenteDoCaso } from './acidente.ts'
import { criancaDoCaso, ehInfantil } from './infantil.ts'
import { nomeBeneficio } from './catalogos.ts'
import { contratos } from './contrato.ts'
import { leiturasDo } from './leitura.ts'
import { doBancoOuNulo, tiposDaSemente } from './parecer.ts'
import { agora, doServidor, esperar, evento, gravar, ler, noBanco, receber, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'
import type { Cobranca } from '../regras/cobranca.ts'

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

export { TABELA_DO_ACIDENTE } from '../regras/checklist.ts'

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
  return contratoAssinadoDo(contratos(banco).find((c) => c.processoId === processo.id), processo.etapa)
}

export type { ChecklistDoCaso, ConferenciaDoChecklist } from '../regras/checklist.ts'

function montar(banco: Banco, processoId: string): ChecklistDoCaso | null {
  const ficha = banco.fichas.find((f) => f.processos.some((p) => p.id === processoId))
  const processo = ficha?.processos.find((p) => p.id === processoId)
  if (!ficha || !processo) return null
  // Bloco 5c: o caso do servidor tem o checklist calculado lá, com o kit do escritório, o acidente e a criança do banco.
  if (doServidor(processoId)) {
    const calculado = banco.checklistsDoServidor?.find((c) => c.processoId === processoId)
    if (!calculado) return null
    const { processoId: _, ...resto } = calculado
    return { ficha, processo, ...resto }
  }
  const entrevista = DA_ENTREVISTA[processoId] ?? { condicoes: [], documentos: [] }
  const checklist = montarChecklist({
    lista: listas[processo.beneficio],
    condicoes: entrevista.condicoes,
    daEntrevista: entrevista.documentos,
    // Os documentos médicos da semente do parecer (GGVP-20) também estão na pasta do caso (GGVP-47).
    documentos: documentosDoCaso(ficha, leiturasDo(banco).filter((l) => l.fichaId === ficha.id), processoId, tiposDaSemente(processoId)),
    contratoAssinado: contratoAssinado(banco, processo),
    ...complementaresDoCaso({
      beneficio: processo.beneficio,
      infantil: ehInfantil(ficha, processo),
      acidente: acidenteDoCaso(banco, processo.id),
      crianca: criancaDoCaso(banco, processo.id),
    }),
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
  if (doServidor(processoId)) return doBancoOuNulo<ChecklistDoCaso>(`/processos/${processoId}/checklist`)
  const banco = ler()
  const resultado = montar(banco, processoId)
  gravar(banco)
  return resultado
}

/** POST /api/processos/:id/checklist/conferencia. A situação é a calculada, nunca a marcada à mão (CA5). */
export async function conferirChecklist(processoId: string): Promise<ConferenciaDoChecklist> {
  if (doServidor(processoId)) {
    // A situação é calculada no servidor; a cópia recebe a ficha, o checklist e a cobrança que a conferência abriu.
    const r = await noBanco<{ conferencia: ConferenciaDoChecklist; ficha: Ficha; checklists: ChecklistNaCopia[]; cobrancas: Cobranca[] }>(
      `/processos/${processoId}/checklist/conferencia`,
      { method: 'POST' },
    )
    receber(r)
    return r.conferencia
  }
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
