// EXEMPLO. Tarefas de exemplo da Central da Advogada, com os textos do protótipo do Figma (frame 59:449) e só as
// pessoas de exemplo.ts (nomes com "Exemplo"). As do Figma com gente que não está na semente ficaram de fora. As tarefas
// que o portal cria (Preparar entrevista, Cadastrar lead...) vêm do servidor de exemplo (preparacao.ts). O "Analisar laudo novo"
// do Antônio nasce do caso (parecer.ts, GGVP-20). Decidir perícia e as exigências do INSS e do juiz saíram daqui: vêm do
// servidor de verdade (GGVP-8 e GGVP-9), no topo da Central.
import type { Tarefa } from './tipos.ts'

const cliente = (id: string, nome: string) => ({ id, nome })

export const tarefasAdvogada: Tarefa[] = [
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
