// EXEMPLO. Tarefas da Central do Atendimento, com os textos do protótipo do Figma (frame 11:2) e as
// pessoas de exemplo.ts (nomes com "Exemplo"). Servem só para desenhar a tela até a API existir. O "Confirmar
// agendamento" da Josefa (D1.04) saiu daqui: nasce da agenda (GGVP-21, dados/confirmacao.ts).
import type { Tarefa } from './tipos.ts'

const cliente = (id: string, nome: string) => ({ id, nome })

export const tarefasAtendimento: Tarefa[] = [
  {
    id: 't1',
    codigo: 'DP.03',
    cliente: cliente('maria-exemplo', 'Maria Exemplo'),
    acao: 'Cobrar documento',
    detalhe: 'Auxílio por incapacidade temporária · perícia 02/10 · laudo médico que a perícia pede',
    prazo: 'vence hoje',
    urgente: true,
  },
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
    id: 't7',
    codigo: 'D1.02',
    cliente: cliente('rita-exemplo', 'Rita Exemplo'),
    acao: 'Conferir documento',
    detalhe: 'BPC/LOAS · 2 documentos lidos, conferência humana · recebido no balcão (scanner + IA)',
    prazo: 'hoje',
    urgente: true,
  },
  {
    id: 't8',
    codigo: 'D1.24',
    cliente: cliente('sebastiao-exemplo', 'Sebastião Exemplo'),
    acao: 'Liberar ao Jurídico',
    detalhe: 'Auxílio-acidente · parecer Suficiente (G17) · conferir a documentação',
    prazo: 'amanhã',
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
    id: 't10',
    codigo: 'DP.03',
    cliente: cliente('maria-exemplo', 'Maria Exemplo'),
    acao: 'Reunir documentos da perícia',
    detalhe: 'Auxílio por incapacidade temporária · perícia em 02/10',
    prazo: 'até 01/10',
  },
  {
    id: 't11',
    codigo: 'D1.18',
    cliente: null,
    contexto: 'Vários clientes',
    acao: 'Conferir documento',
    detalhe: 'links para cada documento · fila do scanner: 3 lidos pela IA',
    prazo: 'hoje',
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
