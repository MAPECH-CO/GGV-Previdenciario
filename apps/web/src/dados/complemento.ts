// EXEMPLO. Servidor de exemplo da pendência de complemento ao médico do cliente (GGVP-20 abre, GGVP-29 conduz), sobre o
// mesmo banco de servidor.ts. A pendência nasce do parecer Insuficiente ou Contraditório e é uma só por caso: um parecer
// novo atualiza o que pedir; o Suficiente encerra. Ligar no servidor: trocar o corpo de cada função por fetch.
import type { SituacaoDoParecer } from '../regras/parecer.ts'
import { nomeBeneficio } from './catalogos.ts'
import { ler, type Banco } from './servidor.ts'
import type { Tarefa } from './tipos.ts'

export type Complemento = {
  processoId: string
  fichaId: string
  /** Data e hora ISO em que o parecer abriu a pendência. */
  abertaEm: string
  /** O parecer que pediu: Insuficiente ou Contraditório. */
  parecer: Exclude<SituacaoDoParecer, 'suficiente'>
  /** O que o documento deve abordar, confirmado pela advogada (G20). */
  abordar: string
  /** As perguntas ao médico dos itens que faltam (GGVP-29, CA1). */
  perguntas: string[]
  /** Quem confirmou o pedido. */
  quem: string
  encerrado?: { quando: string; porque: 'parecer-suficiente' }
}

export const complementosDo = (banco: Banco): Complemento[] => (banco.complementos ??= [])

/** O complemento em aberto do caso, se há. */
export const complementoAberto = (banco: Banco, processoId: string) => complementosDo(banco).find((c) => c.processoId === processoId && !c.encerrado)

/** O parecer Insuficiente ou Contraditório abre a pendência, ou atualiza a que já está aberta (GGVP-20, CA5). */
export function abrirComplemento(banco: Banco, dados: Omit<Complemento, 'encerrado'>) {
  const aberto = complementoAberto(banco, dados.processoId)
  if (aberto) Object.assign(aberto, { parecer: dados.parecer, abordar: dados.abordar, perguntas: dados.perguntas, quem: dados.quem })
  else complementosDo(banco).push(dados)
}

/** O parecer Suficiente encerra a pendência (GGVP-29, CA5). */
export function encerrarComplemento(banco: Banco, processoId: string, quando: string) {
  const aberto = complementoAberto(banco, processoId)
  if (aberto) aberto.encerrado = { quando, porque: 'parecer-suficiente' }
}

/** "Pedir complemento ao médico" na Central do Atendimento: uma por caso com a pendência aberta. */
export function tarefasDeComplemento(): Tarefa[] {
  const banco = ler()
  return complementosDo(banco)
    .filter((c) => !c.encerrado)
    .flatMap((c) => {
      const ficha = banco.fichas.find((f) => f.id === c.fichaId)
      const processo = ficha?.processos.find((p) => p.id === c.processoId)
      if (!ficha || !processo) return []
      return [
        {
          id: `complemento-${c.processoId}`,
          codigo: 'D1.21M',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Pedir complemento ao médico',
          detalhe: `${nomeBeneficio(processo.beneficio)} · parecer ${c.parecer === 'contraditorio' ? 'Contraditório' : 'Insuficiente'} · ${c.perguntas.length} ${c.perguntas.length === 1 ? 'ponto' : 'pontos'} para o médico abordar`,
          prazo: 'hoje',
          href: `/casos/${c.processoId}/complemento`,
          processoId: c.processoId,
        },
      ]
    })
}
