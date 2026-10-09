// EXEMPLO. Servidor de exemplo da pendência de complemento ao médico do cliente (GGVP-20 abre, GGVP-29 conduz), sobre o
// mesmo banco de servidor.ts. A pendência nasce do parecer Insuficiente ou Contraditório e é uma só por caso: um parecer
// novo atualiza o que pedir; o Suficiente encerra. O laço é o da cobrança (GGVP-101, G15). Ligar no servidor: trocar o
// corpo de cada função por fetch no endpoint da design (seção GGVP-29). A orientação do caso do servidor já sai pelo
// Chatwoot do servidor (GGVP-146); a da semente, pelo simulado.
import { CANAIS, RESULTADOS, motivoParaNaoDecidir } from '../regras/cobranca.ts'
import {
  abrirNaLista,
  complementoNaTela,
  doProcesso,
  encerrarNaLista,
  tarefasDoComplemento,
  type Complemento,
  type ComplementoNaTela,
  type DadosDoPedido,
  type DecisaoDoComplemento,
  type TentativaDoComplemento,
} from '../regras/complemento.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { nomeBeneficio } from './catalogos.ts'
import { cobrancasDo } from './cobranca.ts'
import { doBancoOuNulo, doServidorAs, previaDoComplemento } from './parecer.ts'
import { QUEM, agora, doServidor, esperar, evento, gravar, ler, noBanco, type Banco } from './servidor.ts'
import type { Tarefa } from './tipos.ts'

export type { Complemento, ComplementoNaTela, DecisaoDoComplemento, SituacaoDoComplemento, TentativaDoComplemento } from '../regras/complemento.ts'

export const complementosDo = (banco: Banco): Complemento[] => (banco.complementos ??= [])

/** O complemento em aberto do caso, se há. */
export const complementoAberto = (banco: Banco, processoId: string) => complementosDo(banco).find((c) => c.processoId === processoId && !c.encerrado)

/** O prazo externo do caso: o da cobrança em aberto do processo (o juiz ou o INSS). */
const prazoDoCaso = (banco: Banco, processoId: string) => cobrancasDo(banco).find((c) => c.processoId === processoId && !c.encerrada && c.prazo)?.prazo

/** O parecer Insuficiente ou Contraditório abre a pendência, ou atualiza a que já está aberta (GGVP-20, CA5). */
export function abrirComplemento(banco: Banco, dados: DadosDoPedido) {
  banco.complementos = abrirNaLista(complementosDo(banco), dados, prazoDoCaso(banco, dados.processoId))
}

/** O parecer Suficiente encerra a pendência (GGVP-29, CA5). */
export function encerrarComplemento(banco: Banco, processoId: string, quando: string) {
  banco.complementos = encerrarNaLista(complementosDo(banco), processoId, quando)
}

function montar(banco: Banco, c: Complemento): ComplementoNaTela | null {
  const ficha = banco.fichas.find((f) => f.id === c.fichaId)
  const processo = ficha?.processos.find((p) => p.id === c.processoId)
  if (!ficha || !processo) return null
  const previa = previaDoComplemento(banco, c.processoId)
  return complementoNaTela(c, { ficha, processo, beneficio: nomeBeneficio(processo.beneficio), hoje: hojeIso(agora()), ...(previa && { previa }) })
}

/** O complemento aberto do caso; sem aberto, o último. */
function doCaso(banco: Banco, processoId: string): ComplementoNaTela | null {
  const c = doProcesso(complementosDo(banco), processoId)
  return c ? montar(banco, c) : null
}

/** GET /api/processos/:id/complemento */
export async function obterComplemento(processoId: string): Promise<ComplementoNaTela | null> {
  if (doServidor(processoId)) return doBancoOuNulo<ComplementoNaTela>(`/processos/${processoId}/complemento`)
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
  if (doServidor(processoId)) return noBanco<ComplementoNaTela>(`/processos/${processoId}/complemento/tentativas`, { method: 'POST', corpo: registro })
  await esperar()
  const banco = ler()
  const atual = abertoOuErro(banco, processoId)
  if (atual.motivoParado) throw new Error(atual.motivoParado)
  const { complemento } = atual
  const ficha = banco.fichas.find((f) => f.id === complemento.fichaId)!
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
  if (doServidor(processoId)) return noBanco<ComplementoNaTela>(`/processos/${processoId}/complemento/decisoes`, { method: 'POST', corpo: decisao })
  await esperar()
  if (!quem.perfil?.startsWith('senior')) throw new Error('Só a sênior decide o complemento que passou do limite.')
  const banco = ler()
  const atual = abertoOuErro(banco, processoId)
  if (atual.situacao !== 'na-senior') throw new Error('O complemento ainda não passou do limite.')
  const hoje = hojeIso(agora())
  const motivo = motivoParaNaoDecidir({ opcao: 'nova-tentativa', justificativa: decisao.justificativa, prazo: decisao.prazo }, hoje)
  if (motivo) throw new Error(motivo)
  const { complemento } = atual
  const ficha = banco.fichas.find((f) => f.id === complemento.fichaId)!
  complemento.decisoes = [
    ...(complemento.decisoes ?? []),
    { opcao: 'nova-tentativa', justificativa: decisao.justificativa.trim(), prazo: decisao.prazo, quando: agora().toISOString(), quem: quem.nome },
  ]
  complemento.adiadaPara = decisao.prazo
  ficha.historico.push(evento(`Complemento ao médico: a sênior decidiu nova tentativa até ${dataCurta(decisao.prazo, hoje)}. Justificativa: ${decisao.justificativa.trim()}`, quem.nome))
  gravar(banco)
  return montar(banco, complemento)!
}

/** "Pedir complemento ao médico" na Central do Atendimento: uma por caso com a pendência aberta, com a tentativa e o lembrete. */
export function tarefasDeComplemento(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  const tarefas = complementosDo(banco)
    .filter((c) => !c.encerrado)
    .flatMap((c) => {
      const tela = montar(banco, c)
      return tela ? [tarefasDoComplemento(tela, hoje).pedir] : []
    })
  gravar(banco)
  return [...tarefas, ...doServidorAs(banco, /^complemento-/)]
}

/** "Decidir complemento" na Central da Advogada: o complemento que passou do limite chega à sênior (CA3, G15). */
export function tarefasDeDecidirComplemento(): Tarefa[] {
  const banco = ler()
  const hoje = hojeIso(agora())
  const tarefas = complementosDo(banco)
    .filter((c) => !c.encerrado)
    .flatMap((c) => {
      const tela = montar(banco, c)
      const decidir = tela && tarefasDoComplemento(tela, hoje).decidir
      return decidir ? [decidir] : []
    })
  gravar(banco)
  return [...tarefas, ...doServidorAs(banco, /^decidir-complemento-/)]
}
