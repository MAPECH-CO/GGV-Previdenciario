// EXEMPLO. Servidor de exemplo da definição do benefício (GGVP-51), sobre o mesmo banco de servidor.ts. A sugestão vem
// do acervo simulado (acervo.ts) e os requisitos numéricos do código (G19). Não cria processo, contrato nem kit: o caso
// fica com um benefício só (CA8). Ligar no servidor: trocar o corpo de cada função por fetch no endpoint da design.md.
import { beneficioCitado, requisitosDoBeneficio } from '../regras/beneficio.ts'
import { exigeCalculo } from '../regras/calculo.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import { sugerirPeloAcervo } from './acervo.ts'
import { BENEFICIOS, nomeBeneficio } from './catalogos.ts'
import { cnisDeExemplo } from './exemplo.ts'
import { QUEM_ADVOGADA, agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Agendamento, Cnis, DecisaoDoBeneficio, Ficha, Gravacao, SugestaoDoBeneficio, TarefaEncaminhada, Vinculo } from './tipos.ts'

/** EXEMPLO. O CNIS anexado ao caso. Ligar no servidor: o arquivo da pasta do caso, lido na renovação da senha ou no balcão. */
export function cnisDoCaso(fichaId: string): Cnis | undefined {
  return cnisDeExemplo().find((c) => c.fichaId === fichaId)
}

/** Os dados dos requisitos numéricos (CA7): o CNIS, o "sem trabalhar desde" da entrevista e a data de nascimento. */
export type DadosDosRequisitos = { vinculos?: Vinculo[]; semTrabalharDesde?: string; nascimento?: string }

export type Definicao = {
  ficha: Ficha
  agendamento: Agendamento
  /** A entrevista já foi transcrita: sem ela, a IA não tem o que comparar. */
  transcrita: boolean
  sugestao?: SugestaoDoBeneficio
  dados: DadosDosRequisitos
}

function acharEntrevista(banco: Banco, agendamentoId: string): { ficha: Ficha; agendamento: Agendamento; gravacao?: Gravacao } | null {
  for (const ficha of banco.fichas) {
    const agendamento = ficha.agendamentos.find((a) => a.id === agendamentoId)
    if (agendamento) {
      const gravacao = banco.gravacoes.filter((g) => g.agendamentoId === agendamentoId && g.transcricao === 'pronta').at(-1)
      return { ficha, agendamento, gravacao }
    }
  }
  return null
}

function analisar(ficha: Ficha, gravacao: Gravacao | undefined, hoje: string): { sugestao?: SugestaoDoBeneficio; dados: DadosDosRequisitos } {
  const dados: DadosDosRequisitos = {
    vinculos: cnisDoCaso(ficha.id)?.vinculos,
    semTrabalharDesde: gravacao?.extraidas.find((e) => e.id === 'desde')?.valor,
    nascimento: ficha.nascimento,
  }
  if (!gravacao) return { dados }
  const citado = beneficioCitado(gravacao.trechos)
  const texto = [...gravacao.trechos.map((t) => t.texto), ...gravacao.extraidas.map((e) => e.valor), nomeBeneficio(ficha.beneficioInteresse)].join(' ')
  const acervo = sugerirPeloAcervo(texto)
  const sugerido = acervo?.sugerido ?? citado
  if (!sugerido) return { dados }
  return {
    dados,
    sugestao: {
      citado,
      sugerido,
      alternativa: acervo?.alternativa,
      base: acervo?.base ?? [],
      porque: acervo?.porque ?? 'A IA não achou casos parecidos no acervo.',
      requisitos: requisitosDoBeneficio(sugerido, dados, hoje),
    },
  }
}

/** GET /api/entrevistas/:id/beneficio. Nulo quando o compromisso não existe. Só o Jurídico vê a sugestão e a base. */
export async function obterDefinicao(agendamentoId: string): Promise<Definicao | null> {
  const achado = acharEntrevista(ler(), agendamentoId)
  if (!achado) return null
  const { ficha, agendamento, gravacao } = achado
  return { ficha, agendamento, transcrita: gravacao !== undefined, ...analisar(ficha, gravacao, hojeIso(agora())) }
}

/**
 * POST /api/entrevistas/:id/beneficio. Guarda o benefício final, quem decidiu, o citado, a sugestão e os casos consultados
 * (CA6); recusar a sugestão vai ao histórico (CA3); trocar substitui, com o anterior no histórico (CA8).
 */
export async function definirBeneficio(agendamentoId: string, decisao: DecisaoDoBeneficio): Promise<{ ficha: Ficha; tarefa?: TarefaEncaminhada }> {
  await esperar()
  const motivo = decisao.motivoDaRecusa?.trim()
  const valida =
    decisao.conferi === true && decisao.beneficio !== 'nao-sei' && BENEFICIOS.some((b) => b.id === decisao.beneficio) && (motivo ?? '').length <= 500
  if (!valida) throw new Error('Escolha o benefício e confira a recomendação com a entrevista.')
  const banco = ler()
  const achado = acharEntrevista(banco, agendamentoId)
  if (!achado) throw new Error('Entrevista não encontrada')
  const { ficha, gravacao } = achado
  const { sugestao } = analisar(ficha, gravacao, hojeIso(agora()))
  const anterior = ficha.beneficioDefinido
  const recusou = sugestao !== undefined && decisao.beneficio !== sugestao.sugerido
  ficha.beneficioDefinido = {
    beneficio: decisao.beneficio,
    agendamentoId,
    quem: QUEM_ADVOGADA,
    quando: agora().toISOString(),
    citado: sugestao?.citado,
    sugerido: sugestao?.sugerido,
    fontes: sugestao?.base.map((c) => c.id) ?? [],
    recusouSugestao: recusou,
    ...(motivo && { motivoDaRecusa: motivo }),
  }
  if (anterior && anterior.beneficio !== decisao.beneficio) {
    ficha.historico.push(evento(`Trocou o benefício do caso: «${nomeBeneficio(anterior.beneficio)}» → «${nomeBeneficio(decisao.beneficio)}»`, QUEM_ADVOGADA))
  }
  const manteveOCitado = sugestao?.citado === decisao.beneficio
  ficha.historico.push(
    evento(`Definiu o benefício do caso (D1.12): ${nomeBeneficio(decisao.beneficio)}${manteveOCitado ? ' · o que citou na entrevista (G3)' : ''}`, QUEM_ADVOGADA),
  )
  if (recusou) {
    const comMotivo = motivo ? `: ${motivo}` : ''
    ficha.historico.push(
      evento(
        manteveOCitado
          ? `Manteve o que citou na entrevista; a IA sugeria ${nomeBeneficio(sugestao.sugerido)} (G3)${comMotivo}`
          : `Recusou a sugestão da IA (${nomeBeneficio(sugestao.sugerido)})${comMotivo}`,
        QUEM_ADVOGADA,
      ),
    )
  }
  const definir = banco.tarefas.find((t) => t.id === `definir-${ficha.id}`)
  if (definir) definir.concluida = true
  const tarefa = tarefaDoCalculo(banco, ficha, agendamentoId, decisao.beneficio)
  gravar(banco)
  return { ficha, tarefa }
}

/**
 * Benefício da lista "com cálculo": o advogado do atendimento recebe "Calcular tempo e pontos" (D1.13, GGVP-57),
 * obrigatório antes do fechamento. Trocar para um sem cálculo tira a tarefa aberta da fila.
 */
function tarefaDoCalculo(banco: Banco, ficha: Ficha, agendamentoId: string, beneficio: string): TarefaEncaminhada | undefined {
  const id = `calcular-${ficha.id}`
  const aberta = banco.tarefas.find((t) => t.id === id && !t.concluida)
  if (!exigeCalculo(beneficio)) {
    if (aberta) aberta.concluida = true
    return undefined
  }
  if (aberta) return aberta
  const cnis = cnisDoCaso(ficha.id)
  const hoje = hojeIso(agora())
  const tarefa: TarefaEncaminhada = {
    id,
    codigo: 'D1.13',
    cliente: { id: ficha.id, nome: ficha.nome },
    acao: 'Calcular tempo e pontos',
    detalhe: [
      nomeBeneficio(beneficio),
      cnis ? `CNIS ${cnis.origem === 'meu-inss' ? 'do Meu INSS' : 'impresso'} de ${dataCurta(cnis.extraidoEm, hoje)}` : 'sem CNIS no caso',
      'obrigatório antes do fechamento',
    ].join(' · '),
    prazo: 'antes do fechamento',
    href: `/entrevista/${agendamentoId}/calculo`,
    setor: 'Atendimento',
  }
  banco.tarefas.push(tarefa)
  return tarefa
}
