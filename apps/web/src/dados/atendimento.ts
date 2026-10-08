// EXEMPLO. Tarefas da Central do Atendimento, com os textos do protótipo do Figma (frame 11:2) e as
// pessoas de exemplo.ts (nomes com "Exemplo"). Servem só para desenhar a tela até a API existir. O "Confirmar
// agendamento" da Josefa (D1.04) saiu daqui: nasce da agenda (GGVP-21, dados/confirmacao.ts). Os "Conferir documento" da
// Rita e da fila do scanner (D1.18) também: nascem da leitura da IA (GGVP-81, dados/leitura.ts). E o "Liberar ao
// Jurídico" do Sebastião (D1.24) nasce da fila da Documentação (GGVP-18, dados/liberacao.ts).
import type { Tarefa } from './tipos.ts'

const cliente = (id: string, nome: string) => ({ id, nome })

export const tarefasAtendimento: Tarefa[] = [
  // O "Cobrar documento" e o "Reunir documentos da perícia" fixos da Maria (DP.03) saíram: nascem da perícia (épico GGVP-10,
  // dados/pericia.ts), para a Documentação.
  {
    id: 't5',
    codigo: 'D2.06',
    cliente: cliente('marta-exemplo', 'Marta Exemplo'),
    acao: 'Agendar ida ao banco',
    detalhe: 'BPC/LOAS · benefício deferido',
  },
  {
    id: 't6',
    codigo: 'D1.01',
    cliente: null,
    contexto: 'Balcão',
    acao: 'Receber quem chegou',
    detalhe: 'agora',
    href: '/balcao',
  },
  {
    id: 't9',
    codigo: 'D3a.03',
    cliente: cliente('antonio-exemplo', 'Antônio Exemplo'),
    acao: 'Cumprir exigência do juiz',
    detalhe: 'Aposentadoria por incapacidade permanente · 2 tentativas · CTPS e notas do produtor',
    prazo: 'vence 30/09',
    urgente: true,
  },
  {
    id: 't12',
    codigo: 'D2.05d',
    cliente: cliente('pedro-exemplo', 'Pedro Exemplo'),
    acao: 'Responder a exigência do INSS',
    detalhe: 'BPC · idoso · documento pedido pelo INSS · texto aprovado pela advogada (G6)',
    prazo: 'vence em 2 dias',
    urgente: true,
  },
  {
    id: 't13',
    codigo: 'D3b.03',
    cliente: cliente('lucia-exemplo', 'Lúcia Exemplo'),
    acao: 'Avisar a cliente do resultado',
    detalhe: 'Pensão por morte · procedente · o aviso só sai depois do OK da advogada (G8)',
    prazo: 'hoje',
    urgente: true,
  },
]

/** Quantas tarefas a aba "Tarefas do setor" mostra no protótipo. */
export const totalTarefasSetorAtendimento = 9

export const exemploChatAtendimento = 'Ex.: “a Josefa me ligou, qual é a próxima tarefa dela?”'

export const sugestoesChatAtendimento = [
  'O cliente me ligou: qual a próxima tarefa?',
  'Subir laudo novo',
  'Documentos que faltam',
  'Pedir uma peça',
]
