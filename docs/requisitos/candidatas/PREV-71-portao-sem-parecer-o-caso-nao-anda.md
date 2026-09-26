# PREV-71 · Portão: sem parecer, o caso não anda

> Candidata a história, diagrama **Governança da documentação médica por benefício**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** sênior\
**quero** que o caso só seja liberado ao Jurídico, aprovado para o INSS ou tenha petição pedida com o parecer médico "Suficiente", ou com a minha dispensa justificada\
**para** que nenhum pedido saia com prova médica fraca por pressa.

**Passo BPMN:** `D1.24`, `D2.01`, `D3.05` · **Épico:** Governança documental · **Prioridade:** 1 · **Estimativa:** P\
**Perfil:** sênior\
**Portões:** G17

## Critérios de aceite
1. **Dado** um parecer "Insuficiente", "Contraditório" ou sem confirmação humana, **quando** alguém tenta liberar ao Jurídico, aprovar para o INSS ou pedir a petição, **então** a ação fica bloqueada e mostra o que falta (G17).
2. **Dado** que sou sênior, **quando** dispenso o parecer, **então** o portal exige a justificativa, e ela aparece no card e no painel de indicadores (PREV-80).
3. **Dado** o chat (T-02), **quando** alguém pede para pular o parecer, **então** o pedido é recusado.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: sênior. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G17**: O caso só é liberado ao Jurídico, aprovado para o INSS ou tem petição pedida com parecer médico "Suficiente" confirmado por pessoa; só a sênior dispensa, com justificativa

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "sênior".

## Dúvidas abertas (bloqueiam a DoR)
- Q14: Só a sênior pode dispensar o parecer médico? Em que situações a dispensa é aceitável?
- Q15: O roteiro vale igual para a via administrativa (INSS) e para a judicial, ou a exigência muda?

## Dúvidas respondidas pelo PO
- (vazio)
