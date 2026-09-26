# PREV-24 · Liberar o caso ao Jurídico

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** liberar ao Jurídico o caso com o checklist completo\
**para** o caso entrar na fila de conferência do sênior (D2).

**Passo BPMN:** `D1.24` · **Prioridade:** 1 · **Estimativa:** P\
**Perfil:** Atendimento\
**Portões:** G1, G17

## Critérios de aceite
1. **Dado** o checklist completo, **quando** clico em Liberar, **então** o caso vai para a fila do sênior em D2.
2. **Dado** o checklist incompleto, **quando** tento liberar, **então** não consigo e vejo o que falta (G1).
3. **[v2]** **Dado** um benefício da matriz de `docs/requisitos/roteiro-laudos.md` sem parecer médico "Suficiente" nem dispensa da sênior, **quando** tento liberar, **então** não consigo (G17, PREV-71).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G1**: Nada vai para o INSS sem o checklist completo: documentos do benefício, todas as assinaturas e as datas preenchidas
- **G17**: O caso só é liberado ao Jurídico, aprovado para o INSS ou tem petição pedida com parecer médico "Suficiente" confirmado por pessoa; só a sênior dispensa, com justificativa

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
