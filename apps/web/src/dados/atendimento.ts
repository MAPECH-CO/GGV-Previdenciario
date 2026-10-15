// EXEMPLO. Tarefas da Central do Atendimento, com os textos do protótipo do Figma (frame 11:2) e as
// pessoas de exemplo.ts (nomes com "Exemplo"). Servem só para desenhar a tela até a API existir. O "Confirmar
// agendamento" da Josefa (D1.04) saiu daqui: nasce da agenda (GGVP-21, dados/confirmacao.ts). Os "Conferir documento" da
// Rita e da fila do scanner (D1.18) também: nascem da leitura da IA (GGVP-81, dados/leitura.ts). E o "Liberar ao
// Jurídico" do Sebastião (D1.24) nasce da fila da Documentação (GGVP-18, dados/liberacao.ts). GGVP-120 CA4 (Pedro, 14/10): as
// fixas sem tela saíram, porque caíam na "tela não construída"; a ida ao banco, o aviso do resultado e as exigências do INSS
// e do juiz nascem no servidor, com a tela certa.
import type { Tarefa } from './tipos.ts'

export const tarefasAtendimento: Tarefa[] = [
  // O "Cobrar documento" e o "Reunir documentos da perícia" fixos da Maria (DP.03) saíram: nascem da perícia (épico GGVP-10,
  // dados/pericia.ts), para a Documentação.
  {
    id: 't6',
    codigo: 'D1.01',
    cliente: null,
    contexto: 'Balcão',
    acao: 'Receber quem chegou',
    detalhe: 'agora',
    href: '/balcao',
  },
]

export const exemploChatAtendimento = 'Ex.: “a Josefa me ligou, qual é a próxima tarefa dela?”'
