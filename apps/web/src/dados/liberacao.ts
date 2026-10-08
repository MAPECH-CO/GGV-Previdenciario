// EXEMPLO. Servidor de exemplo da liberação do caso ao Jurídico (GGVP-18), sobre o mesmo banco de servidor.ts. Entra na
// fila da Documentação o caso com o checklist conferido completo e o que a semente já traz na etapa "liberar ao Jurídico".
// O parecer médico é o registro da GGVP-20 (dados/parecer.ts). Ligar no servidor: trocar o corpo de cada função por fetch no
// endpoint da spec da ggvp-18; o perfil vem do login, não da tela.
import { somarDias } from '../regras/agenda.ts'
import { dataCurta, hojeIso, hora } from '../regras/datas.ts'
import { PERFIS, diasNaFila, idade, parecerEmOrdem, precisaDeParecer, travaDaLiberacao, type Parecer, type Perfil } from '../regras/liberacao.ts'
import { checklistDoCaso, type ChecklistDoCaso } from './checklist.ts'
import { parecerParaOPortao } from './parecer.ts'
import { QUEM, QUEM_ADVOGADA, agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Tarefa } from './tipos.ts'

/** Quem libera, sem login ainda. */
export const QUEM_DOCUMENTACAO = 'Você (Documentação · ADM)'

const QUEM_POR_PERFIL: Record<Perfil, string> = { documentacao: QUEM_DOCUMENTACAO, atendimento: QUEM, juridico: QUEM_ADVOGADA }

/** Quem liberou e quando (CA6). */
export type Liberacao = { processoId: string; fichaId: string; quem: string; quando: string }

/** "Liberar ao Jurídico": o perfil de quem aperta e as duas conferências da pessoa (CA4, CA7). */
export type PedidoDeLiberacao = { perfil: Perfil; conferiChecklist: boolean; conferiAssinaturas: boolean }

export type CasoParaLiberar = ChecklistDoCaso & {
  parecer?: Parecer
  /** O benefício está na matriz de laudos: pede parecer "Suficiente" (G17). */
  precisaParecer: boolean
  liberacao?: Liberacao
  /** aaaa-mm-dd: desde quando o caso espera a Documentação (CA5). */
  naFilaDesde?: string
}

/** A etapa da semente de quem já espera a liberação. */
const ETAPA_DA_FILA = 'Documentação · liberar ao Jurídico'

function montar(banco: Banco, processoId: string): CasoParaLiberar | null {
  const caso = checklistDoCaso(banco, processoId)
  if (!caso) return null
  const liberacao = banco.liberacoes?.find((l) => l.processoId === processoId)
  const completa = caso.conferencia?.completo ? hojeIso(new Date(caso.conferencia.quando)) : undefined
  // ponytail: a semente não guarda desde quando o caso espera; 2 dias, como o "amanhã" do Figma 11:2.
  const naFilaDesde = completa ?? (caso.processo.etapa === ETAPA_DA_FILA ? somarDias(hojeIso(agora()), -2) : undefined)
  return { ...caso, parecer: parecerParaOPortao(banco, processoId), precisaParecer: precisaDeParecer(caso.processo.beneficio), liberacao, naFilaDesde }
}

/** GET /api/processos/:id/liberacao */
export async function obterLiberacao(processoId: string): Promise<CasoParaLiberar | null> {
  const banco = ler()
  const caso = montar(banco, processoId)
  gravar(banco)
  return caso
}

/** POST /api/processos/:id/liberacao. Só a Documentação · ADM; a tentativa de outro perfil é recusada e registrada (CA4). */
export async function liberarAoJuridico(processoId: string, pedido: PedidoDeLiberacao): Promise<Liberacao> {
  await esperar()
  const banco = ler()
  const caso = montar(banco, processoId)
  if (!caso) throw new Error('Caso não encontrado')
  const ficha = banco.fichas.find((f) => f.id === caso.ficha.id)!
  if (pedido.perfil !== 'documentacao') {
    const perfil = PERFIS[pedido.perfil] ?? 'desconhecido'
    ficha.historico.push(evento(`Tentou liberar o caso ao Jurídico e foi recusado: o perfil ${perfil} não libera; só a Documentação · ADM`, QUEM_POR_PERFIL[pedido.perfil] ?? QUEM))
    gravar(banco)
    throw new Error('Só a Documentação · ADM libera o caso ao Jurídico')
  }
  if (caso.liberacao) throw new Error('O caso já foi liberado ao Jurídico')
  const trava = travaDaLiberacao({
    checklist: caso.checklist,
    beneficio: caso.processo.beneficio,
    nomeBeneficio: caso.beneficio,
    parecer: caso.parecer,
    conferiChecklist: pedido.conferiChecklist === true,
    conferiAssinaturas: pedido.conferiAssinaturas === true,
  })
  if (trava) throw new Error(trava)
  const liberacao: Liberacao = { processoId, fichaId: ficha.id, quem: QUEM_DOCUMENTACAO, quando: agora().toISOString() }
  banco.liberacoes = [...(banco.liberacoes ?? []), liberacao]
  const processo = ficha.processos.find((p) => p.id === processoId)!
  processo.etapa = 'Jurídico · conferência antes do INSS'
  processo.proximaAcao = 'aguardar a conferência da sênior (D2.01)'
  ficha.historico.push(evento('Caso liberado ao Jurídico pela Documentação', QUEM_DOCUMENTACAO))
  gravar(banco)
  return liberacao
}

const parecerCurto = (c: CasoParaLiberar) =>
  !c.precisaParecer ? 'parecer: não se aplica' : parecerEmOrdem(c.processo.beneficio, c.parecer) ? 'parecer Suficiente (G17)' : 'parecer pendente (G17)'

/** "Liberar ao Jurídico" na Central do Atendimento, onde a Documentação trabalha, com a idade na fila (CA5). */
export function tarefasDeLiberar(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  const tarefas = banco.fichas.flatMap((ficha) =>
    ficha.processos.flatMap((p) => {
      const caso = montar(banco, p.id)
      if (!caso?.naFilaDesde || caso.liberacao) return []
      const dias = diasNaFila(caso.naFilaDesde, hoje)
      return [
        {
          id: `liberar-${p.id}`,
          codigo: 'D1.24',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Liberar ao Jurídico',
          detalhe: `${caso.beneficio} · ${parecerCurto(caso)} · conferir a documentação`,
          prazo: `na fila ${idade(dias)}`,
          urgente: dias >= 2,
          href: `/casos/${p.id}/liberar`,
          processoId: p.id,
        },
      ]
    }),
  )
  gravar(banco)
  return tarefas
}

/** "Conferir antes do INSS" na Central da Advogada: o caso liberado pela Documentação entra na fila da sênior (CA1). */
export function tarefasDaFilaDaSenior(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  return (banco.liberacoes ?? []).flatMap((l) => {
    const caso = checklistDoCaso(banco, l.processoId)
    if (!caso) return []
    const dia = hojeIso(new Date(l.quando))
    return [
      {
        id: `conferir-inss-${l.processoId}`,
        codigo: 'D2.01',
        cliente: { id: caso.ficha.id, nome: caso.ficha.nome },
        acao: 'Conferir antes do INSS',
        detalhe: `${caso.beneficio} · liberado pela Documentação ${dia === hoje ? 'hoje' : dataCurta(dia, hoje)} às ${hora(l.quando)}`,
        prazo: 'hoje',
        href: `/processos/${l.processoId}`,
        processoId: l.processoId,
      },
    ]
  })
}
