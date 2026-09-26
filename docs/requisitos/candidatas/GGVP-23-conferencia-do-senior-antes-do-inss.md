# GGVP-23 · Conferência do sênior antes do INSS

> Candidata a história, diagrama **D2 · Via administrativa no INSS**. Cartão no Jira: [GGVP-23](https://mapech.atlassian.net/browse/GGVP-23), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-23. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** sênior\
**quero** validar o caso liberado pelo Atendimento antes de qualquer protocolo\
**para** que nada seja protocolado no INSS sem o meu OK.

**Passo BPMN:** `D2.01` · **Épico:** Via administrativa · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** sênior\
**Portões:** G2, G17

## Critérios de aceite
1. **Dado** um caso liberado, **quando** abro minha fila, **então** vejo o resumo do caso, o benefício, o checklist e os documentos.
2. **Dado** que aprovo, **quando** confirmo, **então** o protocolo e a pergunta "precisa de perícia?" são abertos ao mesmo tempo.
3. **Dado** que não aprovo, **quando** registro o motivo, **então** o caso volta para o Atendimento ajustar em D1, com o motivo visível.
4. **Dado** uma pessoa sem o perfil Sênior, **quando** abre o caso, **então** não vê o botão Aprovar (G2).
5. **[v2]** **Dado** um caso da matriz de `docs/requisitos/roteiro-laudos.md`, **quando** abro a conferência, **então** vejo o parecer médico item a item, e o botão Aprovar só aparece com o parecer "Suficiente" ou a minha dispensa justificada (G17).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: sênior. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G2**: Nada é protocolado sem o OK do sênior
- **G17**: O caso só é liberado ao Jurídico, aprovado para o INSS ou tem petição pedida com parecer médico "Suficiente" confirmado por pessoa; só a sênior dispensa, com justificativa

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "sênior".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
