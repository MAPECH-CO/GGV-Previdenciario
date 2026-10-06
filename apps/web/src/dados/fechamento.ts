// EXEMPLO. Servidor de exemplo do fechamento depois da entrevista (GGVP-60), sobre o mesmo banco de servidor.ts. Ligar no
// servidor: trocar o corpo de cada função por fetch no endpoint da spec ggvp-60. Na junção com o contrato (GGVP-7),
// clienteFechou passa a ser o fecharContrato, que já cria o processo e o kit.
import { dataParaIso, formatarTelefone, normalizarData } from '../campos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import {
  TAMANHO_DO_DETALHE,
  entrevistaRealizada,
  motivoParadoDoFechamento,
  podeRegistrarOMotivo,
  precisaRegistrarFechamento,
  recontatoDevido,
  recontatoEmAberto,
} from '../regras/fechamento.ts'
import { BENEFICIOS, MOTIVOS_DE_NAO_FECHAR, nomeBeneficio, nomeMotivo } from './catalogos.ts'
import { QUEM, agora, esperar, evento, gravar, ler, type Banco } from './servidor.ts'
import type { Agendamento, EnvioDoFechamento, Ficha, PapelNoFechamento, ResultadoDoRecontato, Tarefa } from './tipos.ts'

const QUEM_NO_PAPEL: Record<PapelNoFechamento, string> = {
  atendimento: QUEM,
  'atendimento-senior': 'Você (Atendimento sênior)',
  'advogada-atendimento': 'Você (Advogada do atendimento)',
}

/** A tela do cálculo de tempo e pontos (D1.13, GGVP-57, grupo benefício). Até ela existir, cai em "ainda não construída". */
export const rotaDoCalculo = (ficha: Ficha) => {
  const entrevista = entrevistaRealizada(ficha)
  return entrevista ? `/entrevista/${entrevista.id}/calculo` : `/clientes/${ficha.id}`
}

/** O último cálculo de tempo e pontos (GGVP-57, grupo benefício). Ainda não existe aqui: a junção liga. */
export const ultimoCalculo = (_ficha: Ficha): string | undefined => undefined

function acharFicha(banco: Banco, fichaId: string): Ficha {
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  return ficha
}

/** Fecha na ficha: o lead vira cliente. Sem processo nem kit: isso é do fecharContrato, na junção com o contrato. */
function fecharNaFicha(ficha: Ficha, beneficio: string) {
  if (beneficio === 'nao-sei' || !BENEFICIOS.some((b) => b.id === beneficio)) throw new Error('Benefício fora do catálogo')
  const hoje = hojeIso(agora())
  const jaEraCliente = ficha.situacao === 'cliente'
  ficha.situacao = 'cliente'
  if (!jaEraCliente) ficha.desde = `${hoje.slice(5, 7)}/${hoje.slice(0, 4)}`
  ficha.historico.push(
    evento(
      jaEraCliente
        ? `Fechou ${nomeBeneficio(beneficio)}: caso novo na mesma ficha; segue para o kit do benefício (D1.15)`
        : `Fechou com o escritório: ${nomeBeneficio(beneficio)}; virou cliente e segue para o kit do benefício (D1.15)`,
    ),
  )
}

/**
 * O cliente fechou: chamada pela decisão "Fechou com o escritório?" (GGVP-60) e pela nova demanda (GGVP-124). Mesma forma do
 * fecharContrato do contrato (GGVP-7): na junção, o corpo vira o dele, que cria o processo e o kit.
 */
export async function clienteFechou(fichaId: string, beneficio: string): Promise<{ ficha: Ficha }> {
  await esperar()
  const banco = ler()
  const ficha = acharFicha(banco, fichaId)
  fecharNaFicha(ficha, beneficio)
  gravar(banco)
  return { ficha }
}

export type DadosDoFechamento = { ficha: Ficha; entrevista?: Agendamento }

/** GET /api/fichas/:id/fechamento */
export async function obterFechamento(fichaId: string): Promise<DadosDoFechamento | null> {
  const ficha = ler().fichas.find((f) => f.id === fichaId)
  return ficha ? { ficha, entrevista: entrevistaRealizada(ficha) } : null
}

function marcarRecontato(banco: Banco, ficha: Ficha, dataIso: string): string {
  banco.seq += 1
  const id = `recontato-${ficha.id}-${banco.seq}`
  ficha.agendamentos.push({ id, data: dataIso, hora: '09:00', oQue: 'Recontatar lead', com: QUEM, tipo: 'telefone', duracao: 15 })
  return id
}

/** O lead arquivado sai das filas ativas: as tarefas abertas dele se encerram (CA7). */
function arquivar(banco: Banco, ficha: Ficha) {
  for (const t of banco.tarefas) if (t.cliente?.id === ficha.id && !t.concluida) t.concluida = true
}

const dataIso = (data: string) => dataParaIso(normalizarData(data))

/**
 * POST /api/fichas/:id/fechamento. "Fechou com o escritório?" é obrigatória (CA5). Sim: vira cliente e segue para o kit
 * (D1.15). Não: o motivo da lista é obrigatório (CA1, CA6, G16), com o detalhe opcional; a recusa do escritório só pelo
 * Atendimento sênior ou pela advogada do atendimento (CA11). Vale recontatar: a data vai à agenda e a tarefa nasce nesse
 * dia (CA2, CA8). Não vale: o lead é arquivado com o motivo e sai das filas ativas (CA7).
 */
export async function registrarFechamento(fichaId: string, envio: EnvioDoFechamento): Promise<{ ficha: Ficha }> {
  await esperar()
  const banco = ler()
  const ficha = acharFicha(banco, fichaId)
  const hoje = hojeIso(agora())
  const quando = agora().toISOString()
  const parado = motivoParadoDoFechamento(
    envio.fechou
      ? { fechou: true, motivo: '', detalhe: '', papel: 'atendimento', recontatar: false, data: '', beneficio: ficha.beneficioInteresse }
      : {
          fechou: false,
          motivo: MOTIVOS_DE_NAO_FECHAR.some((m) => m.id === envio.motivo) ? envio.motivo : '',
          detalhe: envio.detalhe ?? '',
          papel: envio.papel,
          recontatar: envio.recontatar !== null,
          data: envio.recontatar?.data ?? '',
          beneficio: ficha.beneficioInteresse,
        },
    hoje,
  )
  if (parado) throw new Error(parado)
  if (envio.fechou) {
    fecharNaFicha(ficha, ficha.beneficioInteresse!)
    ficha.fechamento = { situacao: 'fechou', papel: 'atendimento', quem: QUEM, quando }
  } else {
    const detalhe = envio.detalhe?.trim() || undefined
    const quem = QUEM_NO_PAPEL[envio.papel]
    const motivo = nomeMotivo(envio.motivo)
    if (envio.recontatar) {
      const em = dataIso(envio.recontatar.data)!
      ficha.fechamento = {
        situacao: 'recontatar',
        motivo: envio.motivo,
        ...(detalhe && { detalhe }),
        ...(envio.recontatar.espera && { espera: envio.recontatar.espera }),
        recontatarEm: em,
        recontatoId: marcarRecontato(banco, ficha, em),
        papel: envio.papel,
        quem,
        quando,
      }
      ficha.historico.push(evento(`Não fechou: ${motivo}${detalhe ? ` (${detalhe})` : ''}. Recontatar em ${dataCurta(em, hoje)}`, quem))
    } else {
      ficha.fechamento = { situacao: 'arquivado', motivo: envio.motivo, ...(detalhe && { detalhe }), papel: envio.papel, quem, quando }
      arquivar(banco, ficha)
      ficha.historico.push(evento(`Não fechou: ${motivo}${detalhe ? ` (${detalhe})` : ''}. Lead arquivado com o motivo (G16)`, quem))
    }
  }
  gravar(banco)
  return { ficha }
}

/**
 * POST /api/fichas/:id/recontato. O resultado do recontato: o caso volta ao cálculo refeito (D1.13), ganha uma nova data ou é
 * arquivado com o motivo (CA10).
 */
export async function registrarRecontato(fichaId: string, r: ResultadoDoRecontato): Promise<{ ficha: Ficha }> {
  await esperar()
  const banco = ler()
  const ficha = acharFicha(banco, fichaId)
  const f = ficha.fechamento
  if (f?.situacao !== 'recontatar') throw new Error('Não há recontato marcado')
  const hoje = hojeIso(agora())
  const quando = agora().toISOString()
  if (r.resultado === 'nova-data') {
    const em = dataIso(r.data)
    if (!em || em < hoje) throw new Error('Data do recontato inválida')
    const feito = recontatoEmAberto(ficha)
    if (feito) feito.estado = 'remarcado'
    ficha.fechamento = { ...f, recontatarEm: em, ...(r.espera && { espera: r.espera }), recontatoId: marcarRecontato(banco, ficha, em), quem: QUEM, quando }
    ficha.contatos.push({ data: hoje, canal: 'Recontato', texto: `Ainda não quer seguir; novo recontato em ${dataCurta(em, hoje)}.` })
    ficha.historico.push(evento(`Recontatou: nova data em ${dataCurta(em, hoje)}`))
  } else {
    const feito = recontatoEmAberto(ficha)
    if (feito) feito.estado = 'realizado'
    if (r.resultado === 'calculo') {
      ficha.fechamento = { ...f, situacao: 'recalcular', quem: QUEM, quando }
      ficha.contatos.push({ data: hoje, canal: 'Recontato', texto: 'Quer seguir: o caso volta ao cálculo de tempo e pontos.' })
      ficha.historico.push(evento('Recontatou: o caso volta ao cálculo de tempo e pontos (D1.13)'))
    } else {
      const detalhe = r.detalhe?.trim() || undefined
      const valido = MOTIVOS_DE_NAO_FECHAR.some((m) => m.id === r.motivo) && podeRegistrarOMotivo(r.motivo, r.papel) && (detalhe?.length ?? 0) <= TAMANHO_DO_DETALHE
      if (!valido) throw new Error('Motivo inválido')
      const quem = QUEM_NO_PAPEL[r.papel]
      ficha.fechamento = { situacao: 'arquivado', motivo: r.motivo, ...(detalhe && { detalhe }), papel: r.papel, quem, quando }
      arquivar(banco, ficha)
      ficha.contatos.push({ data: hoje, canal: 'Recontato', texto: `Não vai seguir: ${nomeMotivo(r.motivo)}.` })
      ficha.historico.push(evento(`Recontatou e arquivou o lead: ${nomeMotivo(r.motivo)}${detalhe ? ` (${detalhe})` : ''} (G16)`, quem))
    }
  }
  gravar(banco)
  return { ficha }
}

/** As tarefas do Atendimento: "Registrar fechamento" depois da entrevista e "Recontatar lead" na data (CA5, CA8, CA9). */
export function tarefasDeFechamento(): Tarefa[] {
  const hoje = hojeIso(agora())
  return ler().fichas.flatMap((ficha): Tarefa[] => {
    const cliente = { id: ficha.id, nome: ficha.nome }
    if (precisaRegistrarFechamento(ficha)) {
      const entrevista = entrevistaRealizada(ficha)!
      return [
        {
          id: `fechamento-${ficha.id}`,
          codigo: 'D1.14',
          cliente,
          acao: 'Registrar fechamento',
          detalhe: [
            nomeBeneficio(ficha.beneficioInteresse) || 'benefício a definir',
            `entrevista em ${dataCurta(entrevista.data, hoje)}`,
            ...(ficha.fechamento?.situacao === 'recalcular' ? ['voltou do recontato ao cálculo'] : []),
          ].join(' · '),
          prazo: 'hoje',
          href: `/clientes/${ficha.id}/fechamento`,
        },
      ]
    }
    const { devido, atrasado } = recontatoDevido(ficha, hoje)
    if (!devido) return []
    return [
      {
        id: `recontato-${ficha.id}`,
        codigo: 'D1.14',
        cliente,
        acao: 'Recontatar lead',
        detalhe: [
          `motivo: ${nomeMotivo(ficha.fechamento?.motivo).toLowerCase()}`,
          `último cálculo: ${ultimoCalculo(ficha) ?? 'nenhum registrado'}`,
          ficha.telefone ? formatarTelefone(ficha.telefone) : 'sem telefone',
        ].join(' · '),
        prazo: atrasado ? `atrasado desde ${dataCurta(ficha.fechamento!.recontatarEm!, hoje)}` : 'hoje',
        urgente: atrasado,
        href: `/clientes/${ficha.id}/recontato`,
      },
    ]
  })
}
