# PREV-43 · Prestação de contas montada pela IA e OK da advogada

> Candidata a história, diagrama **D3b · Desfecho do mérito**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que a IA monte a prestação de contas e eu confira e dê o OK\
**para** não errar valor e não avisar o cliente antes da hora.

**Passo BPMN:** `D3b.02` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** advogada responsável\
**Portões:** G8

## Critérios de aceite
1. **Dado** o pagamento liberado, **quando** a IA monta a prestação, **então** vejo os valores e a origem de cada um.
2. **Dado** a prestação conferida, **quando** dou OK, **então** o Financeiro recebe; antes do OK, ninguém recebe nada (G8).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Valores visíveis só para Jurídico e Financeiro. Atendimento vê apenas "prestação de contas feita".

## Portões de governança
- **G8**: O aviso ao cliente só nasce depois do OK da advogada na prestação de contas

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
