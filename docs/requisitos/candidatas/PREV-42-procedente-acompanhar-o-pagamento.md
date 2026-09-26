# PREV-42 · Procedente: acompanhar o pagamento

> Candidata a história, diagrama **D3b · Desfecho do mérito**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que o sistema acompanhe a RPV ou o precatório até cair na conta\
**para** saber quando fazer a prestação de contas.

**Passo BPMN:** `D3b.01` · **Épico:** Desfecho · **Prioridade:** 2 · **Estimativa:** M\
**Perfil:** advogada responsável

## Critérios de aceite
1. **Dado** uma decisão procedente (total ou parcial), **quando** registrada, **então** o caso passa a "Acompanhando o pagamento" com o tipo (RPV ou precatório).
2. **Dado** o pagamento liberado, **quando** o sistema identifica, **então** nasce a prestação de contas (PREV-43).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
