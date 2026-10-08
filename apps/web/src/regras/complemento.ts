// A pendência de complemento ao médico do cliente (GGVP-20 abre, GGVP-29 conduz). Regra pura: o servidor de exemplo e o
// servidor de verdade (GGVP-132) usam a mesma. A pendência é uma só por caso: um parecer novo atualiza o que pedir; o
// Suficiente encerra. O laço é o da cobrança (GGVP-101, G15).
import type { Ficha, Processo, Tarefa } from '../dados/tipos.ts'
import {
  TENTATIVAS_DE_COBRANCA,
  ateQuando,
  motivoParaNaoCobrar,
  naSenior,
  proximaTentativa,
  urgente,
  type CanalDaCobranca,
  type DecisaoDaSenior,
  type EstadoDaCobranca,
  type PrazoExterno,
  type TentativaDeCobranca,
} from './cobranca.ts'
import { dataCurta, hojeIso } from './datas.ts'
import { mensagemDoComplemento, orientacaoAoMedico, type SituacaoDoParecer } from './parecer.ts'
import type { PreviaDoComplemento } from './parecerDoCaso.ts'

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
  /** O laço da cobrança (GGVP-101, G15): as tentativas do Atendimento e as decisões da sênior (GGVP-29, CA3). */
  tentativas?: TentativaDeCobranca[]
  decisoes?: DecisaoDaSenior[]
  /** O prazo do juiz ou do INSS do caso: com ele, o limite é o prazo e a tarefa é urgente (resposta do Lucas, Q2). */
  prazo?: PrazoExterno
  /** aaaa-mm-dd: o novo prazo da sênior vale para a próxima tentativa, como na cobrança (GGVP-101). */
  adiadaPara?: string
  encerrado?: { quando: string; porque: 'parecer-suficiente' }
}

export type SituacaoDoComplemento = 'aberto' | 'na-senior' | 'encerrado'

/** O complemento como a tela do Atendimento recebe: o resultado e o que falta pedir, nunca o conteúdo clínico (CA6). */
export type ComplementoNaTela = {
  complemento: Complemento
  situacao: SituacaoDoComplemento
  ficha: Pick<Ficha, 'id' | 'nome' | 'telefone'>
  processo: Processo
  beneficio: string
  /** A orientação para levar ao médico (CA1, CA2). */
  orientacao: string
  /** A mensagem pronta do Chatwoot. */
  mensagem: string
  /** aaaa-mm-dd: o próximo lembrete. */
  proxima: string
  /** O número da próxima tentativa. */
  tentativa: number
  urgente: boolean
  /** Por que o Atendimento não pode tentar agora; pode, null. */
  motivoParado: string | null
  /** O que a IA viu no documento novo, em perguntas (resposta do Lucas, Q4). */
  previa?: PreviaDoComplemento
}

/** "Ligar" ou o envio pelo Chatwoot (CA3). */
export type TentativaDoComplemento = { canal: CanalDaCobranca; resultado: TentativaDeCobranca['resultado'] }

/** A decisão da sênior no limite: nova tentativa com prazo (G15). A dispensa do parecer é da GGVP-33. */
export type DecisaoDoComplemento = { justificativa: string; /** aaaa-mm-dd */ prazo: string }

export type DadosDoPedido = Omit<Complemento, 'encerrado' | 'tentativas' | 'decisoes' | 'prazo' | 'adiadaPara'>

/** O parecer Insuficiente ou Contraditório abre a pendência, ou atualiza a que já está aberta (GGVP-20, CA5). */
export function abrirNaLista(lista: Complemento[], dados: DadosDoPedido, prazo?: PrazoExterno): Complemento[] {
  const aberto = lista.find((c) => c.processoId === dados.processoId && !c.encerrado)
  if (aberto) {
    Object.assign(aberto, { parecer: dados.parecer, abordar: dados.abordar, perguntas: dados.perguntas, quem: dados.quem })
    return lista
  }
  return [...lista, { ...dados, tentativas: [], decisoes: [], ...(prazo && { prazo }) }]
}

/** O parecer Suficiente encerra a pendência (GGVP-29, CA5). */
export function encerrarNaLista(lista: Complemento[], processoId: string, quando: string): Complemento[] {
  const aberto = lista.find((c) => c.processoId === processoId && !c.encerrado)
  if (aberto) aberto.encerrado = { quando, porque: 'parecer-suficiente' }
  return lista
}

/** O laço do complemento na forma da cobrança (GGVP-101). */
export const estadoDoLaco = (c: Complemento): EstadoDaCobranca => ({
  abertaEm: hojeIso(new Date(c.abertaEm)),
  tentativas: c.tentativas ?? [],
  decisoes: c.decisoes ?? [],
  ...(c.prazo && { prazo: c.prazo }),
  ...(c.adiadaPara && { adiadaPara: c.adiadaPara }),
})

/** O complemento como a tela recebe, com a orientação, a mensagem, a próxima tentativa e o que pode agora. */
export function complementoNaTela(
  c: Complemento,
  d: { ficha: Pick<Ficha, 'id' | 'nome' | 'telefone'>; processo: Processo; beneficio: string; hoje: string; previa?: PreviaDoComplemento },
): ComplementoNaTela {
  const laco = estadoDoLaco(c)
  const situacao: SituacaoDoComplemento = c.encerrado ? 'encerrado' : naSenior(laco, d.hoje) ? 'na-senior' : 'aberto'
  const { ficha, beneficio, hoje } = d
  return {
    complemento: c,
    situacao,
    ficha,
    processo: d.processo,
    beneficio,
    orientacao: orientacaoAoMedico({ nome: ficha.nome, beneficio, abordar: c.abordar }),
    mensagem: mensagemDoComplemento({ nome: ficha.nome, beneficio, perguntas: c.perguntas, ate: ateQuando(hoje, c.prazo), hoje }),
    proxima: proximaTentativa(laco),
    tentativa: laco.tentativas.length + 1,
    urgente: situacao === 'aberto' && urgente(laco, hoje),
    motivoParado: c.encerrado ? 'O complemento já foi encerrado.' : motivoParaNaoCobrar(laco, hoje),
    ...(d.previa && { previa: d.previa }),
  }
}

/** O complemento aberto do caso; sem aberto, o último. */
export const doProcesso = (lista: Complemento[], processoId: string) => {
  const todos = lista.filter((c) => c.processoId === processoId)
  return todos.find((x) => !x.encerrado) ?? todos.at(-1)
}

const pontos = (n: number) => `${n} ${n === 1 ? 'ponto' : 'pontos'} para o médico abordar`

/**
 * As tarefas do complemento aberto: "Pedir complemento ao médico" na Central do Atendimento, com a tentativa e o lembrete,
 * e "Decidir complemento" para a sênior quando passa do limite (CA3, G15).
 */
export function tarefasDoComplemento(tela: ComplementoNaTela, hoje: string): { pedir: Tarefa; decidir?: Tarefa } {
  const { complemento: c, ficha, beneficio, situacao, tentativa, proxima } = tela
  const cliente = { id: ficha.id, nome: ficha.nome }
  return {
    pedir: {
      id: `complemento-${c.processoId}`,
      codigo: 'D1.21M',
      cliente,
      acao: 'Pedir complemento ao médico',
      detalhe: [
        beneficio,
        `parecer ${c.parecer === 'contraditorio' ? 'Contraditório' : 'Insuficiente'}`,
        pontos(c.perguntas.length),
        situacao === 'na-senior' ? 'passou do limite: na sênior (G15)' : `${tentativa}ª tentativa`,
      ].join(' · '),
      prazo: situacao === 'na-senior' ? 'na sênior' : proxima <= hoje ? 'hoje' : dataCurta(proxima, hoje),
      urgente: tela.urgente,
      href: `/casos/${c.processoId}/complemento`,
      processoId: c.processoId,
    },
    ...(situacao === 'na-senior' && {
      decidir: {
        id: `decidir-complemento-${c.processoId}`,
        codigo: 'D1.21M',
        cliente,
        acao: 'Decidir complemento',
        detalhe: `${beneficio} · ${TENTATIVAS_DE_COBRANCA} tentativas sem o relatório · nova tentativa ou dispensa do parecer (G15, G17)`,
        prazo: 'hoje',
        urgente: true,
        href: `/casos/${c.processoId}/complemento`,
        processoId: c.processoId,
      },
    }),
  }
}

export type { CanalDaCobranca }
