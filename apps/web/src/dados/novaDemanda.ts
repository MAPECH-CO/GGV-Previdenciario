// EXEMPLO. Servidor de exemplo da nova demanda de quem já é cliente (GGVP-124), sobre o mesmo banco de servidor.ts. Ligar no
// servidor: trocar o corpo de cada função por fetch no endpoint da spec ggvp-124. O processo novo e o kit nascem no
// "Fechou com o escritório?" (registrarFechamento), pelo clienteFechou.
import { formatarTelefone } from '../campos.ts'
import { hojeIso } from '../regras/datas.ts'
import { demandaAberta, motivoParadoDaDemanda, precisaLigar } from '../regras/novaDemanda.ts'
import { BENEFICIOS, nomeBeneficio } from './catalogos.ts'
import { QUEM, QUEM_ADVOGADA, agora, doServidor, esperar, evento, gravar, ler, noBanco, receber } from './servidor.ts'
import type { Demanda, EnvioDaDemanda, Ficha, Tarefa, TarefaEncaminhada } from './tipos.ts'

export const NOMES_DOS_TIPOS: Record<Demanda['tipo'], string> = { 'outro-pedido': 'outro pedido', 'tentar-de-novo': 'tentar de novo depois de perder' }

/**
 * POST /api/fichas/:id/demandas. A demanda nasce na mesma ficha, sem cadastro novo (CA1); recurso e defesa não abrem demanda
 * (CA8). O benefício dela passa a ser o de interesse da ficha, o que o "Fechou com o escritório?" usa.
 */
export async function abrirDemanda(fichaId: string, envio: EnvioDaDemanda): Promise<{ ficha: Ficha; demanda: Demanda }> {
  if (doServidor(fichaId)) {
    // GGVP-125, bloco 3b: quem abriu (Atendimento ou advogada) vem da sessão, no servidor.
    const r = await noBanco<{ demanda: Demanda; ficha: Ficha; tarefas: TarefaEncaminhada[] }>(`/fichas/${fichaId}/demandas`, {
      method: 'POST',
      corpo: { pretende: envio.pretende, beneficio: envio.beneficio, tipo: envio.tipo },
    })
    return { ficha: receber(r)!, demanda: r.demanda }
  }
  await esperar()
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const beneficio = BENEFICIOS.some((b) => b.id === envio.beneficio) ? envio.beneficio : ''
  const parado = motivoParadoDaDemanda({ tipo: envio.tipo, pretende: envio.pretende, beneficio }, ficha)
  if (parado || envio.tipo === 'recurso-ou-defesa') throw new Error(parado ?? 'Recurso e defesa seguem no mesmo processo')
  banco.seq += 1
  const quem = envio.abertaPor === 'advogada' ? QUEM_ADVOGADA : QUEM
  const demanda: Demanda = {
    id: `demanda-${ficha.id}-${banco.seq}`,
    pretende: envio.pretende.trim(),
    beneficio,
    tipo: envio.tipo,
    abertaPor: envio.abertaPor,
    data: hojeIso(agora()),
    quem,
    situacao: 'aberta',
  }
  ficha.demandas = [...(ficha.demandas ?? []), demanda]
  ficha.beneficioInteresse = beneficio
  ficha.historico.push(
    evento(`Nova demanda (${NOMES_DOS_TIPOS[demanda.tipo]}): ${demanda.pretende} · ${nomeBeneficio(beneficio)}. Na mesma ficha, sem cadastro novo`, quem),
  )
  gravar(banco)
  return { ficha, demanda }
}

/** A tarefa do Atendimento quando a advogada abre a nova demanda: ligar para o cliente e marcar a entrevista (CA9). */
export function tarefasDeNovaDemanda(): Tarefa[] {
  return ler()
    .fichas.filter(precisaLigar)
    .map((ficha) => {
      const d = demandaAberta(ficha)!
      return {
        id: `ligar-${d.id}`,
        codigo: 'D1.01',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Ligar para o cliente',
        detalhe: [
          `nova demanda da advogada: ${NOMES_DOS_TIPOS[d.tipo]}`,
          nomeBeneficio(d.beneficio),
          ficha.telefone ? formatarTelefone(ficha.telefone) : 'sem telefone',
        ].join(' · '),
        prazo: 'hoje',
        href: `/clientes/${ficha.id}/nova-demanda`,
      }
    })
}
