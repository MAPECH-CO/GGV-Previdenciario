// EXEMPLO. Servidor de exemplo do contrato do caso (GGVP-65 em diante), sobre o mesmo banco de servidor.ts. Um contrato por
// processo: o kit, o preenchimento, a assinatura, a conferência e a cópia. Ligar no servidor: trocar o corpo de cada função
// por fetch no endpoint indicado na spec da história, sobre o mesmo contrato. ZapSign, Drive, Chatwoot e IA são simulados.
import { hojeIso } from '../regras/datas.ts'
import { SEM_CONDICOES, montarKit, modeloPorId, type CondicoesDoKit, type KitMontado } from '../regras/contrato.ts'
import { BENEFICIOS, nomeBeneficio } from './catalogos.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

// Espelho do contrato (Zod) da spec de cada história; vai para packages/contratos/contrato.ts.

/** Onde o contrato do caso está: preparar (D1.16) e, nas histórias seguintes, assinar, conferir e entregar a cópia. */
export type EtapaDoContrato = 'preparar'

export type Contrato = {
  processoId: string
  fichaId: string
  etapa: EtapaDoContrato
  /** O que o caso diz e muda o kit do LOAS (GGVP-65, CA2 e CA8). */
  condicoes: CondicoesDoKit
  /** Guardado no caso; nulo quando o benefício não tem kit na tabela. */
  kit: KitMontado | null
  /** Data e hora ISO em que o caso fechou. */
  abertoEm: string
}

export type ContratoDoCaso = { ficha: Ficha; processo: Processo; contrato: Contrato }

/**
 * Os contratos da semente, só com processos que já existem em exemplo.ts: a Cleide fechou a Aposentadoria PCD e o contrato
 * está para preparar (Figma step_D1.16 `10:143`).
 */
export function contratosDeExemplo(fichas: Ficha[], hoje: string): Contrato[] {
  const novo = (processoId: string, etapa: EtapaDoContrato): Contrato | null => {
    const ficha = fichas.find((f) => f.processos.some((p) => p.id === processoId))
    const processo = ficha?.processos.find((p) => p.id === processoId)
    if (!ficha || !processo) return null
    return { processoId, fichaId: ficha.id, etapa, condicoes: SEM_CONDICOES, kit: montarKit(processo.beneficio), abertoEm: `${hoje}T09:00:00.000Z` }
  }
  return [novo('cleide-exemplo-1', 'preparar')].filter((c): c is Contrato => c !== null)
}

/** Os contratos do banco, começando da semente quando o banco ainda não tem. */
export function contratos(banco: Banco): Contrato[] {
  banco.contratos ??= contratosDeExemplo(banco.fichas, hojeIso(agora()))
  return banco.contratos
}

function achar(banco: Banco, processoId: string): ContratoDoCaso | null {
  const contrato = contratos(banco).find((c) => c.processoId === processoId)
  const ficha = banco.fichas.find((f) => f.id === contrato?.fichaId)
  const processo = ficha?.processos.find((p) => p.id === processoId)
  return contrato && ficha && processo ? { ficha, processo, contrato } : null
}

const TITULOS: Record<EtapaDoContrato, { codigo: string; acao: string; rota: string }> = {
  preparar: { codigo: 'D1.16', acao: 'Preparar contrato', rota: 'preparar' },
}

/** A tarefa do Atendimento em cada etapa do contrato (título da lista fixa: "nome · Preparar contrato"). */
export function tarefasDoContrato(): Tarefa[] {
  const banco = ler()
  return contratos(banco).flatMap((c): Tarefa[] => {
    const achado = achar(banco, c.processoId)
    const titulo = TITULOS[c.etapa]
    if (!achado || !titulo) return []
    const { ficha, processo } = achado
    const modelo = c.kit ? modeloPorId(c.kit.modelo).nome : ''
    return [
      {
        id: `contrato-${c.processoId}`,
        codigo: titulo.codigo,
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: titulo.acao,
        detalhe: [nomeBeneficio(processo.beneficio), c.kit ? `kit ${c.kit.nome} · ${modelo}` : 'benefício sem kit cadastrado'].join(' · '),
        prazo: processo.prazo ?? 'hoje',
        urgente: processo.urgente,
        href: `/contrato/${c.processoId}/${titulo.rota}`,
        processoId: c.processoId,
      },
    ]
  })
}

/** GET /api/processos/:id/contrato. Nulo quando o processo não tem contrato. */
export async function obterContrato(processoId: string): Promise<ContratoDoCaso | null> {
  return achar(ler(), processoId)
}

/**
 * POST /api/fichas/:id/processos. O cliente fechou: o processo nasce com o kit do benefício e o Atendimento recebe
 * "Preparar contrato" (CA1). Quem já é cliente e fecha outro benefício ganha processo e kit novos, mesmo com os mesmos
 * documentos (CA9). Chamado pela definição do benefício na entrevista e pela nova demanda (GGVP-124).
 */
export async function fecharContrato(fichaId: string, beneficio: string): Promise<ContratoDoCaso> {
  await esperar()
  if (beneficio === 'nao-sei' || !BENEFICIOS.some((b) => b.id === beneficio)) throw new Error('Benefício fora do catálogo')
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const hoje = hojeIso(agora())
  if (ficha.situacao === 'lead') {
    ficha.situacao = 'cliente'
    ficha.desde = `${hoje.slice(5, 7)}/${hoje.slice(0, 4)}`
  }
  let n = ficha.processos.length + 1
  while (ficha.processos.some((p) => p.id === `${fichaId}-${n}`)) n += 1
  const processo: Processo = { id: `${fichaId}-${n}`, beneficio, etapa: 'Contrato · preparar', proximaAcao: 'preparar o contrato', prazo: 'hoje' }
  ficha.processos.push(processo)
  const kit = montarKit(beneficio)
  const contrato: Contrato = { processoId: processo.id, fichaId, etapa: 'preparar', condicoes: SEM_CONDICOES, kit, abertoEm: agora().toISOString() }
  contratos(banco).push(contrato)
  ficha.historico.push(
    evento(
      kit
        ? `Fechou ${nomeBeneficio(beneficio)}: processo novo com o kit ${kit.nome} (${kit.documentos.length} documentos, ${modeloPorId(kit.modelo).nome})`
        : `Fechou ${nomeBeneficio(beneficio)}: processo novo, sem kit cadastrado para o benefício`,
    ),
  )
  gravar(banco)
  return { ficha, processo, contrato }
}

const ROTULOS_DAS_CONDICOES: Record<keyof CondicoesDoKit, string> = {
  representado: 'representado por genitor(a)',
  moradia: 'comprovante de residência em nome de outra pessoa',
  uniaoEstavel: 'união estável',
  separacaoDeFato: 'separação de fato',
}

/** PUT /api/processos/:id/contrato/condicoes. As condições do LOAS montam o kit de novo (CA2, CA8). */
export async function salvarCondicoes(processoId: string, condicoes: CondicoesDoKit): Promise<Contrato> {
  await esperar()
  const banco = ler()
  const achado = achar(banco, processoId)
  if (!achado) throw new Error('Contrato não encontrado')
  const { ficha, processo, contrato } = achado
  if (contrato.etapa !== 'preparar') throw new Error('O kit só muda antes de gerar o contrato')
  contrato.condicoes = { ...condicoes }
  contrato.kit = montarKit(processo.beneficio, condicoes)
  const marcadas = (Object.keys(ROTULOS_DAS_CONDICOES) as (keyof CondicoesDoKit)[]).filter((k) => condicoes[k]).map((k) => ROTULOS_DAS_CONDICOES[k])
  ficha.historico.push(evento(`Condições do kit de ${nomeBeneficio(processo.beneficio)}: ${marcadas.length ? marcadas.join(', ') : 'nenhuma'}`))
  gravar(banco)
  return contrato
}
