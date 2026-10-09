// EXEMPLO. Servidor de exemplo da preparação da conversa (GGVP-32), sobre o mesmo banco de servidor.ts. O resumo é o que
// a ficha de atendimento diz, juntado pelo portal (não é IA). Ligar no servidor: trocar o corpo de cada função por fetch no
// endpoint indicado, sobre o contrato da design.md (change ggvp-6).
import { dataCurta, hojeIso, idadeEm } from '../regras/datas.ts'
import { atencaoCurta, pontosDeAtencao } from '../regras/preparacao.ts'
import { tarefasAdvogada } from './advogada.ts'
import { nomeBeneficio } from './catalogos.ts'
import { chamarApi } from '../api.ts'
import { agora, doServidor, ler } from './servidor.ts'
import type { Agendamento, Ficha, Preparacao, RespostasDaSegundaFicha, Tarefa } from './tipos.ts'

/** O resumo da ficha de atendimento (CA3): junta o que a ficha diz, sem concluir nada. É regra, não IA (GGVP-133). */
export function resumoDaFicha(ficha: Ficha, hoje: string): string {
  const f = ficha.fichaAtendimento
  if (!ficha.fichaAtendimentoPreenchida) return 'A ficha de atendimento ainda não foi preenchida: não há o que resumir.'
  if (!f) return 'Ficha preenchida antes do portal: leia a ficha em papel na pasta do cliente.'
  const idade = ficha.nascimento ? idadeEm(ficha.nascimento, hoje) : ficha.idade
  return [
    idade !== undefined ? `${idade} anos` : '',
    f.ultimaAtividade ? `última atividade: ${f.ultimaAtividade}` : '',
    f.semTrabalharDesde ? `sem trabalhar desde ${f.semTrabalharDesde}` : '',
    f.pedidosAoInss ? `já pediu ao INSS: ${f.pedidosAoInss}` : '',
    f.pessoasNaCasa ? `${f.pessoasNaCasa} ${f.pessoasNaCasa === 1 ? 'pessoa' : 'pessoas'} na casa` : '',
    ficha.beneficioInteresse && ficha.beneficioInteresse !== 'nao-sei' ? `procura ${nomeBeneficio(ficha.beneficioInteresse)}` : 'ainda não sabe o benefício',
  ]
    .filter(Boolean)
    .join(' · ')
}

function acharAgendamento(fichas: Ficha[], id: string): { ficha: Ficha; agendamento: Agendamento } | null {
  for (const ficha of fichas) {
    const agendamento = ficha.agendamentos.find((a) => a.id === id)
    if (agendamento) return { ficha, agendamento }
  }
  return null
}

/**
 * GGVP-125, bloco 3c: nas fichas do servidor, a seção médica da segunda ficha vem do servidor ao abrir a tela, só para o
 * Jurídico e com a leitura registrada; fica só na tela, nunca na cópia do navegador.
 */
async function comSecaoMedica(ficha: Ficha): Promise<Ficha> {
  if (!ficha.segundaFicha || !doServidor(ficha.id)) return ficha
  const r = await chamarApi<{ medicos: Partial<RespostasDaSegundaFicha>; lida: boolean }>(`/fichas/${ficha.id}/segunda-ficha`)
  if (!r.ok || r.dados.lida) return ficha
  return { ...ficha, segundaFicha: { ...ficha.segundaFicha, respostas: { ...ficha.segundaFicha.respostas, ...r.dados.medicos } } }
}

/** GET /api/entrevistas/:id/preparacao. Nulo quando o compromisso não existe. */
export async function obterPreparacao(agendamentoId: string): Promise<Preparacao | null> {
  const achado = acharAgendamento(ler().fichas, agendamentoId)
  if (!achado) return null
  const hoje = hojeIso(agora())
  const { agendamento } = achado
  const ficha = await comSecaoMedica(achado.ficha)
  const primeiroContato = [...ficha.contatos].sort((a, b) => a.data.localeCompare(b.data))[0]
  return { ficha, agendamento, resumo: resumoDaFicha(ficha, hoje), pontos: pontosDeAtencao(ficha, hoje), primeiroContato }
}

/**
 * GET /api/central/advogada. As tarefas do Jurídico que o portal criou, com os pontos de atenção no detalhe do "Preparar
 * entrevista" (CA1), e as de exemplo do Figma.
 */
export function tarefasDaAdvogada(): Tarefa[] {
  const { fichas, tarefas } = ler()
  const hoje = hojeIso(agora())
  const doJuridico = tarefas
    .filter((t) => t.setor === 'Jurídico' && !t.concluida)
    .map((t): Tarefa => {
      if (t.acao !== 'Preparar entrevista') return t
      const achado = acharAgendamento(fichas, t.id.replace(/^preparar-/, ''))
      if (!achado) return t
      const { ficha, agendamento: a } = achado
      return {
        ...t,
        detalhe: [
          nomeBeneficio(ficha.beneficioInteresse) || 'benefício a definir',
          `entrevista ${a.data === hoje ? 'hoje' : dataCurta(a.data, hoje)} ${a.hora}`,
          ficha.fichaAtendimento ? 'ficha já lida pela IA' : 'ficha em papel',
          atencaoCurta(pontosDeAtencao(ficha, hoje)),
        ].join(' · '),
        urgente: a.data === hoje,
      }
    })
  return [...doJuridico, ...tarefasAdvogada]
}
