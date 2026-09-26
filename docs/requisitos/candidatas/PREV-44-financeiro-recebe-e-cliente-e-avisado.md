# PREV-44 · Financeiro recebe e cliente é avisado

> Candidata a história, diagrama **D3b · Desfecho do mérito**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** avisar o cliente que vencemos e agendar a ida ao banco depois que o Financeiro recebeu a prestação\
**para** fechar o caso com o cliente bem informado.

**Passo BPMN:** `D3b.03` · **Prioridade:** 2 · **Estimativa:** P\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** o OK da advogada e o Financeiro com a prestação, **quando** abro minha fila, **então** vejo "Avisar o cliente · vencemos".
2. **Dado** o aviso feito e a ida ao banco agendada, **quando** registro, **então** o caso vira "processo bom" no acervo e a baixa é registrada.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
