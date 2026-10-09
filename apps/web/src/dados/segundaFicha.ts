// EXEMPLO. Servidor de exemplo da análise da ficha e da segunda ficha, de auxílio acidentário (GGVP-28), sobre o mesmo
// banco de servidor.ts. A leitura da ficha em papel (scanner e IA) é simulada. Ligar no servidor: trocar o corpo de cada
// função por fetch no endpoint indicado, sobre o contrato da design.md (change ggvp-6). O conteúdo médico nunca vai para
// o histórico.
import { nomeSemSobrescrever } from '../regras/arquivos.ts'
import { dataCurta, hojeIso } from '../regras/datas.ts'
import {
  CAMPOS_MEDICOS,
  emBrancoDaSegunda,
  normalizarDatas,
  respostasVazias,
  segundaFichaValida,
  semDadosMedicos,
} from '../regras/segundaFicha.ts'
import { registrarNoCofre } from './cofre.ts'
import { leituraDaSegundaFicha } from './exemplo.ts'
import { CLIENTE_NO_TABLET } from './fichaAtendimento.ts'
import { QUEM_ADVOGADA, agendamentoDoServidor, agora, doServidor, esperar, evento, gravar, ler, noBanco, receber, type Banco } from './servidor.ts'
import type { Agendamento, Arquivo, Ficha, RespostasDaSegundaFicha, TarefaEncaminhada } from './tipos.ts'

function acharAgendamento(banco: Banco, id: string): { ficha: Ficha; agendamento: Agendamento } {
  for (const ficha of banco.fichas) {
    const agendamento = ficha.agendamentos.find((a) => a.id === id)
    if (agendamento) return { ficha, agendamento }
  }
  throw new Error('Entrevista não encontrada')
}

/** Uma pendência do Atendimento ligada à entrevista, com prazo no horário dela. Não repete a que já está aberta. */
export function pendenciaDoAtendimento(
  banco: Banco,
  ficha: Ficha,
  a: Agendamento,
  t: { id: string; codigo: string; acao: string; detalhe: string; href: string },
): TarefaEncaminhada {
  const hoje = hojeIso(agora())
  const aberta = banco.tarefas.find((x) => x.id === t.id && !x.concluida)
  if (aberta) return aberta
  const tarefa: TarefaEncaminhada = {
    ...t,
    cliente: { id: ficha.id, nome: ficha.nome },
    prazo: a.data === hoje ? `até ${a.hora}` : `até ${dataCurta(a.data, hoje)} ${a.hora}`,
    urgente: a.data === hoje,
    setor: 'Atendimento',
  }
  banco.tarefas.push(tarefa)
  return tarefa
}

/**
 * POST /api/entrevistas/:id/analise. "Pode ser auxílio acidentário?" fica na ficha com a autora e o horário e no
 * histórico (CA4); "Sim" abre a pendência "Preencher segunda ficha" do Atendimento (CA1).
 */
export async function registrarAnalise(agendamentoId: string, d: { acidentario: boolean }): Promise<{ tarefas: TarefaEncaminhada[] }> {
  await esperar()
  if (typeof d.acidentario !== 'boolean') throw new Error('Análise inválida')
  if (agendamentoDoServidor(agendamentoId)) {
    const r = await noBanco<{ abertas: TarefaEncaminhada[]; ficha: Ficha; tarefas: TarefaEncaminhada[] }>(`/entrevistas/${agendamentoId}/analise`, {
      method: 'POST',
      corpo: d,
    })
    receber(r)
    return { tarefas: r.abertas }
  }
  const banco = ler()
  const { ficha, agendamento: a } = acharAgendamento(banco, agendamentoId)
  const quando = agora().toISOString()
  ficha.analise = { acidentario: d.acidentario, quem: QUEM_ADVOGADA, quando }
  ficha.historico.push(
    evento(d.acidentario ? 'Analisou a ficha: pode ser auxílio acidentário' : 'Analisou a ficha: não é auxílio acidentário', QUEM_ADVOGADA),
  )
  const tarefas: TarefaEncaminhada[] = []
  if (d.acidentario && !ficha.segundaFicha) {
    tarefas.push(
      pendenciaDoAtendimento(banco, ficha, a, {
        id: `segunda-ficha-${a.id}`,
        codigo: 'D1.07',
        acao: 'Preencher segunda ficha',
        detalhe: 'FICHA DE ATENDIMENTO AUXILIO ACIDENTE em papel, preenchida pela cliente e escaneada antes da entrevista',
        href: `/clientes/${ficha.id}/segunda-ficha`,
      }),
    )
  }
  // Sem senha no cofre, o Atendimento renova antes da entrevista (GGVP-36, CA1 e CA4).
  if (ficha.senhaGov.situacao !== 'no-cofre') {
    tarefas.push(
      pendenciaDoAtendimento(banco, ficha, a, {
        id: `renovar-senha-${a.id}`,
        codigo: 'D1.08',
        acao: 'Renovar senha do gov.br',
        detalhe: 'com o cliente, antes da entrevista · a senha vai direto ao cofre',
        href: `/entrevista/${a.id}/renovar-senha`,
      }),
    )
  }
  gravar(banco)
  return { tarefas }
}

/**
 * POST /api/fichas/:id/segunda-ficha/leitura (o aviso do n8n). A imagem vai para Documentos pessoais (CA6); a seção
 * médica vai direto ao Jurídico e não volta para a tela do Atendimento (CA8); a senha do Meu INSS vai ao cofre (CA7).
 */
export async function lerSegundaFichaEmPapel(fichaId: string): Promise<{ arquivo: Arquivo; respostas: RespostasDaSegundaFicha; senhaLida: boolean }> {
  if (doServidor(fichaId)) {
    // GGVP-125, bloco 3c: o servidor guarda a seção médica lida à parte, só para o Jurídico; a imagem ainda fica na pasta
    // de exemplo daqui, até o Drive entrar.
    const r = await noBanco<{ arquivo: Arquivo; respostas: RespostasDaSegundaFicha; senhaLida: boolean; ficha: Ficha }>(`/fichas/${fichaId}/segunda-ficha/leitura`, {
      method: 'POST',
      corpo: {},
    })
    receber(r)
    const banco = ler()
    banco.fichas.find((f) => f.id === fichaId)!.arquivos.push(r.arquivo)
    gravar(banco)
    return { arquivo: r.arquivo, respostas: r.respostas, senhaLida: r.senhaLida }
  }
  await esperar()
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const hoje = hojeIso(agora())
  const arquivo: Arquivo = {
    nome: nomeSemSobrescrever(
      `Ficha de atendimento AUXILIO ACIDENTE - ${ficha.nome} - ${hoje}.pdf`,
      ficha.arquivos.filter((x) => x.local === 'pessoais').map((x) => x.nome),
    ),
    tipo: 'ficha-acidente',
    local: 'pessoais',
    data: hoje,
    origem: 'scanner',
    repetido: false,
    aguardaLeitura: false,
  }
  ficha.arquivos.push(arquivo)
  const leitura = leituraDaSegundaFicha()
  const respostas = { ...respostasVazias(), ...leitura.respostas }
  banco.leiturasMedicas = banco.leiturasMedicas.filter((l) => l.fichaId !== fichaId)
  banco.leiturasMedicas.push({ fichaId, medicos: Object.fromEntries(CAMPOS_MEDICOS.map((c) => [c, respostas[c]])) })
  if (leitura.senhaLida) {
    ficha.senhaGov = { situacao: 'no-cofre', conferir: true, atualizadaEm: agora().toISOString(), por: 'Leitura da ficha em papel (IA)' }
    registrarNoCofre(banco, ficha.id, 'leu-do-papel', 'Leitura da ficha em papel (IA)')
  }
  ficha.historico.push(
    evento(
      `A segunda ficha em papel (auxílio acidente) passou no scanner e a IA leu os campos; a imagem ficou em Documentos pessoais${leitura.senhaLida ? ' e a senha do Meu INSS foi para o cofre, para conferir' : ''}`,
    ),
  )
  gravar(banco)
  return { arquivo, respostas: semDadosMedicos(respostas), senhaLida: leitura.senhaLida }
}

/**
 * PUT /api/fichas/:id/segunda-ficha. Valida de novo; no papel, a seção médica é a que a IA leu e foi direto ao Jurídico
 * (CA8); no tablet, a que o cliente preencheu. Conclui a pendência "Preencher segunda ficha" e libera a entrevista (CA3).
 */
export async function salvarSegundaFicha(fichaId: string, respostas: RespostasDaSegundaFicha, origem: 'papel' | 'tablet'): Promise<{ ficha: Ficha }> {
  if (!doServidor(fichaId)) await esperar()
  const hoje = hojeIso(agora())
  const r = normalizarDatas({ ...respostasVazias(), ...respostas })
  if (!segundaFichaValida(r, hoje) || (origem !== 'papel' && origem !== 'tablet')) throw new Error('Segunda ficha inválida')
  if (doServidor(fichaId)) {
    const salva = await noBanco<{ ficha: Ficha; tarefas: TarefaEncaminhada[] }>(`/fichas/${fichaId}/segunda-ficha`, { method: 'PUT', corpo: { respostas, origem } })
    return { ficha: receber(salva)! }
  }
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  // No papel, o Atendimento não vê a seção médica: vale a que a IA leu ou, ao salvar de novo, a que já estava guardada.
  const guardada = ficha.segundaFicha && Object.fromEntries(CAMPOS_MEDICOS.map((c) => [c, ficha.segundaFicha!.respostas[c]]))
  const medicos = origem === 'papel' ? (banco.leiturasMedicas.find((l) => l.fichaId === fichaId)?.medicos ?? guardada) : undefined
  const final = medicos ? { ...r, ...medicos } : r
  ficha.segundaFicha = { data: ficha.segundaFicha?.data ?? hoje, origem, respostas: final, emBranco: emBrancoDaSegunda(final) }
  banco.leiturasMedicas = banco.leiturasMedicas.filter((l) => l.fichaId !== fichaId)
  for (const t of banco.tarefas) if (t.cliente?.id === ficha.id && t.acao === 'Preencher segunda ficha') t.concluida = true
  ficha.historico.push(
    evento(`Salvou a segunda ficha (auxílio acidentário, ${origem === 'tablet' ? 'tablet' : 'papel, conferida'})`, origem === 'tablet' ? CLIENTE_NO_TABLET : undefined),
  )
  gravar(banco)
  return { ficha }
}
