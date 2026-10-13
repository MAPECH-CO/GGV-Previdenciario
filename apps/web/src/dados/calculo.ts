// A ficha real vem da API; nunca recebe o CNIS da demonstração. O registro antigo segue apenas no exemplo.
// A memória por vínculos/carência ainda não tem persistência por caso no servidor.
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { dataPrevistaIso, exigeCalculo, pontosFalados, registroValido, tempoFalado } from '../regras/calculo.ts'
import { cnisDoCaso } from './beneficio.ts'
import { agendamentoDoServidor, agora, esperar, evento, gravar, ler, noBanco } from './servidor.ts'
import type { Agendamento, Calculo, Cnis, Ficha, RegistroDoCalculo } from './tipos.ts'

/** Quem calcula: o advogado do setor de atendimento (Lucas, 01/10). */
export const QUEM_ADVOGADO_DO_ATENDIMENTO = 'Você (Advogado do atendimento)'

export type DadosDoCalculo = { ficha: Ficha; agendamento: Agendamento; cnis?: Cnis; exige: boolean }

function achar(fichas: Ficha[], agendamentoId: string): { ficha: Ficha; agendamento: Agendamento } | null {
  for (const ficha of fichas) {
    const agendamento = ficha.agendamentos.find((a) => a.id === agendamentoId)
    if (agendamento) return { ficha, agendamento }
  }
  return null
}

/** GET /api/entrevistas/:id/calculo. O CNIS do caso, com a origem e a data de extração (CA4). */
export async function obterCalculo(agendamentoId: string): Promise<DadosDoCalculo | null> {
  const real = agendamentoDoServidor(agendamentoId)
  const fichas = real ? [await noBanco<Ficha>(`/fichas/${agendamentoId.slice(0, 36)}`)] : ler().fichas
  const achado = achar(fichas, agendamentoId)
  if (!achado) return null
  return { ...achado, cnis: real ? undefined : cnisDoCaso(achado.ficha.id), exige: exigeCalculo(achado.ficha.beneficioDefinido?.beneficio) }
}

const resumo = (c: Calculo, hoje: string) =>
  `${tempoFalado(c.tempo)}, ${pontosFalados(c.pontos)} pontos, ${c.regra}; ${c.podeAposentar ? 'já pode se aposentar' : `ainda não pode se aposentar: previsto para ${dataCurta(c.dataPrevista!, hoje)}`}`

/**
 * POST /api/entrevistas/:id/calculo. Registra o tempo, os pontos, a regra e quem conferiu (CA5); refazer guarda o
 * anterior (CA6); "ainda não" leva a data prevista para "Registrar o motivo" (CA2, D1.14).
 */
export async function registrarCalculo(agendamentoId: string, registro: RegistroDoCalculo): Promise<{ ficha: Ficha }> {
  await esperar()
  const hoje = hojeIso(agora())
  if (!registroValido(registro, hoje)) throw new Error('Cálculo incompleto ou inválido')
  if (agendamentoDoServidor(agendamentoId)) {
    throw new Error('Salvar vínculos e carência no caso ainda não está disponível.')
  }
  const banco = ler()
  const achado = achar(banco.fichas, agendamentoId)
  if (!achado) throw new Error('Entrevista não encontrada')
  const { ficha } = achado
  if (!exigeCalculo(ficha.beneficioDefinido?.beneficio)) throw new Error('O benefício deste caso não exige cálculo')
  const cnis = cnisDoCaso(ficha.id)
  if (!cnis) throw new Error('Sem CNIS no caso')
  const anterior = ficha.calculos?.at(-1)
  const calculo: Calculo = {
    tempo: registro.tempo,
    pontos: registro.pontos,
    regra: registro.regra,
    podeAposentar: registro.podeAposentar,
    ...(!registro.podeAposentar && { dataPrevista: dataPrevistaIso(registro.dataPrevista)! }),
    quem: QUEM_ADVOGADO_DO_ATENDIMENTO,
    quando: agora().toISOString(),
    cnisOrigem: cnis.origem,
    cnisExtraidoEm: cnis.extraidoEm,
  }
  ficha.calculos = [...(ficha.calculos ?? []), calculo]
  ficha.historico.push(
    evento(
      anterior
        ? `Refez o cálculo de tempo e pontos. Antes: ${resumo(anterior, hoje)}. Agora: ${resumo(calculo, hoje)}`
        : `Calculou tempo e pontos sobre o CNIS: ${resumo(calculo, hoje)}`,
      QUEM_ADVOGADO_DO_ATENDIMENTO,
    ),
  )
  const tarefa = banco.tarefas.find((t) => t.id === `calcular-${ficha.id}`)
  if (tarefa) tarefa.concluida = true
  gravar(banco)
  return { ficha }
}
