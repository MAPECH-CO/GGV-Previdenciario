// Dados fictícios da Central do Atendimento, copiados do protótipo do Figma (frame 11:2).
// Servem só para desenhar a tela até a API existir. Nenhum nome ou caso é real.
import type { Tarefa } from './tipos.ts'

const cliente = (id: string, nome: string) => ({ id, nome })

export const tarefasAtendimento: Tarefa[] = [
  {
    id: 't1',
    codigo: 'DP.03',
    cliente: cliente('maria-das-gracas-oliveira', 'Maria das Graças Oliveira'),
    acao: 'Cobrar documento',
    detalhe: 'Auxílio por incapacidade temporária · perícia 02/10 · laudo médico que a perícia pede',
    prazo: 'vence hoje',
    urgente: true,
  },
  {
    id: 't2',
    codigo: 'D1.19',
    cliente: cliente('cleide-barros', 'Cleide Barros'),
    acao: 'Conferir contrato',
    detalhe: 'Aposentadoria PCD · a IA apontou 1 pendência',
    prazo: 'hoje',
  },
  {
    id: 't3',
    codigo: 'D1.17',
    cliente: cliente('nair-souza', 'Nair Souza'),
    acao: 'Colher assinatura',
    detalhe: 'Aposentadoria por idade · ZapSign enviado 26/09',
  },
  {
    id: 't4',
    codigo: 'D1.04',
    cliente: cliente('josefa-ramos', 'Josefa Ramos'),
    acao: 'Confirmar agendamento',
    detalhe: 'BPC/LOAS · entrevista hoje 15:30',
    prazo: '15:30',
  },
  {
    id: 't5',
    codigo: 'D2.06',
    cliente: cliente('marta-reis', 'Marta Reis'),
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
  },
  {
    id: 't7',
    codigo: 'D1.02',
    cliente: cliente('maria-souza', 'Maria Souza'),
    acao: 'Conferir documento',
    detalhe: 'BPC/LOAS · 2 documentos lidos, conferência humana · recebido no balcão (scanner + IA)',
    prazo: 'hoje',
    urgente: true,
  },
  {
    id: 't8',
    codigo: 'D1.24',
    cliente: cliente('sebastiao-nunes', 'Sebastião Nunes'),
    acao: 'Liberar ao Jurídico',
    detalhe: 'Auxílio-acidente · parecer Suficiente (G17) · conferir a documentação',
    prazo: 'amanhã',
  },
  {
    id: 't9',
    codigo: 'D3a.03',
    cliente: cliente('antonio-ferreira-lima', 'Antônio Ferreira Lima'),
    acao: 'Cumprir exigência do juiz',
    detalhe: 'Aposentadoria por incapacidade permanente · 2 tentativas · CTPS e notas do produtor',
    prazo: 'vence 30/09',
    urgente: true,
  },
  {
    id: 't10',
    codigo: 'DP.03',
    cliente: cliente('maria-das-gracas-oliveira', 'Maria das Graças Oliveira'),
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
    cliente: cliente('pedro-alves', 'Pedro Alves'),
    acao: 'Responder a exigência do INSS',
    detalhe: 'BPC · idoso · documento pedido pelo INSS · texto aprovado pela advogada (G6)',
    prazo: 'vence em 2 dias',
    urgente: true,
  },
  {
    id: 't13',
    codigo: 'D3b.03',
    cliente: cliente('lucia-prado', 'Lúcia Prado'),
    acao: 'Avisar a cliente do resultado',
    detalhe: 'Pensão por morte · procedente · o aviso só sai depois do OK da advogada (G8)',
    prazo: 'hoje',
    urgente: true,
  },
  {
    id: 't14',
    codigo: 'D1.20',
    cliente: cliente('cleide-barros', 'Cleide Barros'),
    acao: 'Entregar a cópia do contrato',
    detalhe: 'Aposentadoria especial · contrato assinado em 12/07 · retirada hoje às 16h',
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
