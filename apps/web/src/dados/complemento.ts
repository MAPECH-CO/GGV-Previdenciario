// EXEMPLO. Servidor de exemplo da pendência de complemento ao médico do cliente (GGVP-20 abre, GGVP-29 conduz), sobre o
// mesmo banco de servidor.ts. A pendência nasce do parecer Insuficiente ou Contraditório e é uma só por caso: um parecer
// novo atualiza o que pedir; o Suficiente encerra. O laço é o da cobrança (GGVP-101, G15). Ligar no servidor: trocar o
// corpo de cada função por fetch no endpoint da design (seção GGVP-29) e mandar pelo Chatwoot de verdade (GGVP-102).
import {
  CANAIS,
  RESULTADOS,
  TENTATIVAS_DE_COBRANCA,
  ateQuando,
  motivoParaNaoCobrar,
  motivoParaNaoDecidir,
  naSenior,
  proximaTentativa,
  urgente,
  type CanalDaCobranca,
  type DecisaoDaSenior,
  type EstadoDaCobranca,
  type PrazoExterno,
  type TentativaDeCobranca,
} from '../regras/cobranca.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { mensagemDoComplemento, orientacaoAoMedico, type SituacaoDoParecer } from '../regras/parecer.ts'
import { nomeBeneficio } from './catalogos.ts'
import { cobrancasDo } from './cobranca.ts'
import { previaDoComplemento, type PreviaDoComplemento } from './parecer.ts'
import { QUEM, agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Ficha, Processo, Tarefa } from './tipos.ts'

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
  ficha: Ficha
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

export const complementosDo = (banco: Banco): Complemento[] => (banco.complementos ??= [])

/** O complemento em aberto do caso, se há. */
export const complementoAberto = (banco: Banco, processoId: string) => complementosDo(banco).find((c) => c.processoId === processoId && !c.encerrado)

/** O prazo externo do caso: o da cobrança em aberto do processo (o juiz ou o INSS). */
const prazoDoCaso = (banco: Banco, processoId: string) => cobrancasDo(banco).find((c) => c.processoId === processoId && !c.encerrada && c.prazo)?.prazo

/** O parecer Insuficiente ou Contraditório abre a pendência, ou atualiza a que já está aberta (GGVP-20, CA5). */
export function abrirComplemento(banco: Banco, dados: Omit<Complemento, 'encerrado' | 'tentativas' | 'decisoes' | 'prazo' | 'adiadaPara'>) {
  const aberto = complementoAberto(banco, dados.processoId)
  if (aberto) Object.assign(aberto, { parecer: dados.parecer, abordar: dados.abordar, perguntas: dados.perguntas, quem: dados.quem })
  else {
    const prazo = prazoDoCaso(banco, dados.processoId)
    complementosDo(banco).push({ ...dados, tentativas: [], decisoes: [], ...(prazo && { prazo }) })
  }
}

/** O parecer Suficiente encerra a pendência (GGVP-29, CA5). */
export function encerrarComplemento(banco: Banco, processoId: string, quando: string) {
  const aberto = complementoAberto(banco, processoId)
  if (aberto) aberto.encerrado = { quando, porque: 'parecer-suficiente' }
}

/** O laço do complemento na forma da cobrança (GGVP-101). */
const estado = (c: Complemento): EstadoDaCobranca => ({
  abertaEm: hojeIso(new Date(c.abertaEm)),
  tentativas: c.tentativas ?? [],
  decisoes: c.decisoes ?? [],
  ...(c.prazo && { prazo: c.prazo }),
  ...(c.adiadaPara && { adiadaPara: c.adiadaPara }),
})

function montar(banco: Banco, c: Complemento): ComplementoNaTela | null {
  const ficha = banco.fichas.find((f) => f.id === c.fichaId)
  const processo = ficha?.processos.find((p) => p.id === c.processoId)
  if (!ficha || !processo) return null
  const hoje = hojeIso(agora())
  const laco = estado(c)
  const situacao: SituacaoDoComplemento = c.encerrado ? 'encerrado' : naSenior(laco, hoje) ? 'na-senior' : 'aberto'
  const beneficio = nomeBeneficio(processo.beneficio)
  const previa = previaDoComplemento(banco, c.processoId)
  return {
    complemento: c,
    situacao,
    ficha,
    processo,
    beneficio,
    orientacao: orientacaoAoMedico({ nome: ficha.nome, beneficio, abordar: c.abordar }),
    mensagem: mensagemDoComplemento({ nome: ficha.nome, beneficio, perguntas: c.perguntas, ate: ateQuando(hoje, c.prazo), hoje }),
    proxima: proximaTentativa(laco),
    tentativa: laco.tentativas.length + 1,
    urgente: situacao === 'aberto' && urgente(laco, hoje),
    motivoParado: c.encerrado ? 'O complemento já foi encerrado.' : motivoParaNaoCobrar(laco, hoje),
    ...(previa && { previa }),
  }
}

/** O complemento aberto do caso; sem aberto, o último. */
function doCaso(banco: Banco, processoId: string): ComplementoNaTela | null {
  const todos = complementosDo(banco).filter((c) => c.processoId === processoId)
  const c = todos.find((x) => !x.encerrado) ?? todos.at(-1)
  return c ? montar(banco, c) : null
}

/** GET /api/processos/:id/complemento */
export async function obterComplemento(processoId: string): Promise<ComplementoNaTela | null> {
  const banco = ler()
  const tela = doCaso(banco, processoId)
  gravar(banco)
  return tela
}

function abertoOuErro(banco: Banco, processoId: string): ComplementoNaTela {
  const atual = doCaso(banco, processoId)
  if (!atual) throw new Error('Complemento não encontrado')
  if (atual.situacao === 'encerrado') throw new Error('O complemento já foi encerrado')
  return atual
}

/** POST /api/processos/:id/complemento/tentativas. O laço da cobrança: a segunda sem resposta sobe para a sênior (CA3, G15). */
export async function registrarTentativaDoComplemento(processoId: string, registro: TentativaDoComplemento): Promise<ComplementoNaTela> {
  await esperar()
  const banco = ler()
  const atual = abertoOuErro(banco, processoId)
  if (atual.motivoParado) throw new Error(atual.motivoParado)
  const { complemento, ficha } = atual
  const hoje = hojeIso(agora())
  complemento.tentativas = [...(complemento.tentativas ?? []), { dia: hoje, canal: registro.canal, resultado: registro.resultado, quem: QUEM }]
  ficha.historico.push(
    evento(`Complemento ao médico: ${complemento.tentativas.length}ª tentativa por ${CANAIS[registro.canal]} (${RESULTADOS[registro.resultado]})`),
  )
  gravar(banco)
  return montar(banco, complemento)!
}

/** POST /api/processos/:id/complemento/decisoes. Só a sênior, no limite: nova tentativa com prazo e justificativa (CA3, G15). */
export async function decidirComplemento(processoId: string, decisao: DecisaoDoComplemento, quem: { perfil?: string; nome: string }): Promise<ComplementoNaTela> {
  await esperar()
  if (!quem.perfil?.startsWith('senior')) throw new Error('Só a sênior decide o complemento que passou do limite.')
  const banco = ler()
  const atual = abertoOuErro(banco, processoId)
  if (atual.situacao !== 'na-senior') throw new Error('O complemento ainda não passou do limite.')
  const hoje = hojeIso(agora())
  const motivo = motivoParaNaoDecidir({ opcao: 'nova-tentativa', justificativa: decisao.justificativa, prazo: decisao.prazo }, hoje)
  if (motivo) throw new Error(motivo)
  const { complemento, ficha } = atual
  complemento.decisoes = [
    ...(complemento.decisoes ?? []),
    { opcao: 'nova-tentativa', justificativa: decisao.justificativa.trim(), prazo: decisao.prazo, quando: agora().toISOString(), quem: quem.nome },
  ]
  complemento.adiadaPara = decisao.prazo
  ficha.historico.push(evento(`Complemento ao médico: a sênior decidiu nova tentativa até ${dataCurta(decisao.prazo, hoje)}. Justificativa: ${decisao.justificativa.trim()}`, quem.nome))
  gravar(banco)
  return montar(banco, complemento)!
}

const pontos = (n: number) => `${n} ${n === 1 ? 'ponto' : 'pontos'} para o médico abordar`

/** "Pedir complemento ao médico" na Central do Atendimento: uma por caso com a pendência aberta, com a tentativa e o lembrete. */
export function tarefasDeComplemento(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  const tarefas = complementosDo(banco)
    .filter((c) => !c.encerrado)
    .flatMap((c) => {
      const tela = montar(banco, c)
      if (!tela) return []
      const { ficha, beneficio, situacao, tentativa, proxima } = tela
      return [
        {
          id: `complemento-${c.processoId}`,
          codigo: 'D1.21M',
          cliente: { id: ficha.id, nome: ficha.nome },
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
      ]
    })
  gravar(banco)
  return tarefas
}

/** "Decidir complemento" na Central da Advogada: o complemento que passou do limite chega à sênior (CA3, G15). */
export function tarefasDeDecidirComplemento(): Tarefa[] {
  const banco = ler()
  const tarefas = complementosDo(banco)
    .filter((c) => !c.encerrado)
    .flatMap((c) => {
      const tela = montar(banco, c)
      if (!tela || tela.situacao !== 'na-senior') return []
      return [
        {
          id: `decidir-complemento-${c.processoId}`,
          codigo: 'D1.21M',
          cliente: { id: tela.ficha.id, nome: tela.ficha.nome },
          acao: 'Decidir complemento',
          detalhe: `${tela.beneficio} · ${TENTATIVAS_DE_COBRANCA} tentativas sem o relatório · nova tentativa ou dispensa do parecer (G15, G17)`,
          prazo: 'hoje',
          urgente: true,
          href: `/casos/${c.processoId}/complemento`,
          processoId: c.processoId,
        },
      ]
    })
  gravar(banco)
  return tarefas
}
