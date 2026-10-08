# Títulos das tarefas

Regra de 29/09/2026 (Pedro), já aplicada no protótipo do Figma (quadro "Glossário · títulos das tarefas"). Vale para as Centrais, as abas "Tarefas do setor", a Agenda e o cabeçalho das telas de tarefa. Toca as histórias GGVP-78 (tela inicial "O que é meu hoje") e GGVP-82 (chat).

## A regra

- O título de toda tarefa é o **nome do cliente em negrito** mais **uma ação da lista fixa** abaixo.
- O detalhe (benefício, prazo, o que falta) vai na **linha de baixo**, nunca no título.
- Tarefa sem cliente usa o contexto no lugar do nome: **Balcão**, **Fila de revisão** ou **Todos os processos**.
- Clicar no nome abre a ficha do cliente.
- O chat, ao criar uma tarefa, escolhe uma ação desta lista.
- As ações são verbos no infinitivo. Os compromissos da agenda (perícia, audiência, ida ao banco) são nomeados pelo tipo.
- "Entrega de documento" virou "Receber documento", para manter o verbo.

## Exemplo

> **Maria das Graças Oliveira** · Marcar perícia\
> Auxílio por incapacidade temporária · o INSS já abriu o agendamento

## Ações por perfil

| Perfil | Ações |
|---|---|
| Atendimento e Documentação (24) | Receber quem chegou · Receber documento · Conferir documento · Confirmar agendamento · Renovar senha do gov.br · Preencher ficha · Preencher segunda ficha · Preparar contrato · Colher assinatura · Conferir contrato · Entregar cópia do contrato · Conferir checklist · Cobrar documento · Liberar ao Jurídico · Recontatar lead · Registrar fechamento · Registrar conversa · Agendar ida ao banco · Avisar resultado · Explicar resultado · Cumprir pendência · Cumprir exigência do juiz · Responder exigência do INSS · Reunir documentos da perícia |
| Jurídico administrativo, o estagiário (5) | Protocolar no INSS · Marcar perícia · Remarcar perícia · Orientar para a perícia · Registrar comparecimento |
| Advogada (25) | Preparar entrevista · Analisar ficha · Fazer entrevista · Cadastrar lead · Definir benefício · Calcular tempo e pontos · Dar parecer médico · Analisar laudo novo · Decidir perícia · Vigiar Meu INSS · Responder exigência do INSS · Registrar indeferimento · Pedir petição · Conferir petição · Protocolar na Justiça · Ler publicação · Analisar exigência do juiz · Manifestar no processo · Conferir resultado da perícia · Confirmar desfecho · Decidir recurso · Acompanhar pagamento · Prestar contas · Aprovar prestação de contas · Ligar para o cliente |
| Sênior (7) | Aprovar pedido · Despachar caso · Decidir cobrança · Revisar estudo de caso · Reprocessar vigília · Casar publicação · Alimentar acervo |
| Financeiro (2) | Lançar prestação de contas · Confirmar recebimento |

"Registrar conversa" continua na lista do Atendimento e da Documentação: é um registro avulso de contato, sem passo no BPMN (a Advogada não tem mais "Conferir conversa", que vinha do D5, retirado do board em 28/09).

## Compromissos da agenda

Fazer entrevista · Receber documento · Protocolar no INSS · Protocolar na Justiça · Responder exigência do INSS · Manifestar no processo · Entregar cópia do contrato · Recontatar lead · Perícia médica · Avaliação social · Audiência · Ida ao banco

Perícia médica, Avaliação social, Audiência e Ida ao banco são nomeados pelo tipo do compromisso; os outros usam a mesma ação da tarefa.
