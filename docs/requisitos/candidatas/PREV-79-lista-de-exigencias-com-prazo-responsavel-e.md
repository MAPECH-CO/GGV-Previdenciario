# PREV-79 · Lista de exigências com prazo, responsável e prova

> Candidata a história, diagrama **Exigências do juízo: nenhum processo extinto sem julgamento do mérito**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que cada decisão com exigências seja quebrada em itens, cada um com prazo contado, setor responsável e a prova de que foi cumprido\
**para** manifestar só quando tudo estiver cumprido e nunca perder o processo por forma.

**Passo BPMN:** `D3a.02`, `D3a.03`, `D3a.04`, `D2.05` · **Épico:** Exigências · **Prioridade:** 1 · **Estimativa:** G\
**Perfil:** advogada responsável\
**Portões:** G5, G21

## Critérios de aceite
1. **Dado** uma decisão com várias exigências (por exemplo, emendar a inicial, juntar documento, comprovar residência, indicar assistente), **quando** a IA lê, **então** propõe um item por exigência, com o trecho da decisão, e a advogada confirma, junta ou separa itens (G5).
2. **Dado** cada item confirmado, **quando** salvo, **então** ele tem prazo contado pelo lado seguro (PREV-50), setor responsável e o campo "prova do cumprimento" (documento anexado ou texto).
3. **Dado** um item sem prova, **quando** alguém tenta protocolar a manifestação, **então** o portal bloqueia e lista os itens pendentes (G21).
4. **Dado** um item a 5 dias úteis do fim do prazo sem conclusão, **quando** o dia vira, **então** a sênior recebe o alerta; a 2 dias úteis, o caso fica no topo da fila dela em cor de ação.
5. **Dado** a manifestação protocolada, **quando** registro, **então** cada item fica ligado à peça que o cumpriu.

## Fora do escopo desta história
- Decidir o mérito da exigência; isso é da advogada.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G5**: Quem analisa a exigência do juiz e define o setor são os advogados, não a IA
- **G21**: Toda exigência do juízo ou do INSS vira item com prazo, responsável e prova; sem prova em todos os itens, não se manifesta; perto do vencimento, escala para a sênior

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
