// EXEMPLO. Tarefas de exemplo da Central da Advogada, com os textos do protótipo do Figma (frame 59:449) e só as
// pessoas de exemplo.ts (nomes com "Exemplo"). As do Figma com gente que não está na semente ficaram de fora. As tarefas
// que o portal cria (Preparar entrevista, Cadastrar lead...) vêm do servidor de exemplo (preparacao.ts).
import type { Tarefa } from './tipos.ts'

const cliente = (id: string, nome: string) => ({ id, nome })

export const tarefasAdvogada: Tarefa[] = [
  {
    id: 'a1',
    codigo: 'D2.03',
    cliente: cliente('maria-exemplo', 'Maria Exemplo'),
    acao: 'Decidir perícia',
    detalhe: 'Auxílio por Incapacidade Temporária · protocolo feito hoje',
    prazo: 'hoje',
  },
  {
    id: 'a2',
    codigo: 'D1.21M',
    cliente: cliente('antonio-exemplo', 'Antônio Exemplo'),
    acao: 'Analisar laudo novo',
    detalhe: 'Aposentadoria por Incapacidade Permanente · enviado pelo Atendimento em 29/09 · resumo e comparação da IA prontos',
    prazo: 'hoje',
    urgente: true,
  },
  {
    id: 'a3',
    codigo: 'D3a.02',
    cliente: cliente('antonio-exemplo', 'Antônio Exemplo'),
    acao: 'Analisar exigência do juiz',
    detalhe: 'Aposentadoria por Incapacidade Permanente · Vara Federal de Santo Amaro · definir setor e prova (G5)',
    prazo: 'vence em 2 dias',
    urgente: true,
  },
  {
    id: 'a4',
    codigo: 'D2.05',
    cliente: cliente('pedro-exemplo', 'Pedro Exemplo'),
    acao: 'Responder exigência do INSS',
    detalhe: 'LOAS Idoso · conferir a resposta preparada pela IA',
    prazo: 'vence em 2 dias',
    urgente: true,
  },
  {
    id: 'a5',
    codigo: 'D3b.02',
    cliente: cliente('lucia-exemplo', 'Lúcia Exemplo'),
    acao: 'Prestação de contas: dar o OK',
    detalhe: 'Pensão por Morte · honorários sugeridos pela IA · OK para avisar o cliente (G8)',
    prazo: 'sem prazo',
  },
]

/** Quantas tarefas a aba "Tarefas do setor" mostra no protótipo. */
export const totalTarefasSetorAdvogada = 12

export const exemploChatAdvogada = 'Ex.: “quais documentos eu verifico antes da perícia da Maria Exemplo?”'

export const sugestoesChatAdvogada = ['Resumo do caso', 'Criar tarefa', 'Perícias da semana', 'Como o perito avalia?', 'Gerar peça']
