# PREV-35 · Pedir a petição e a IA escrever

> Candidata a história, diagrama **D3 · Judicialização**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** pedir a petição inicial quando todos os setores subiram o card, e receber a minuta escrita pela IA com o acervo e o histórico do caso\
**para** partir de uma peça boa, não da peça de outro cliente.

**Passo BPMN:** `D3.05` · **Épico:** Judicialização · **Prioridade:** 1 · **Estimativa:** G\
**Perfil:** advogada responsável\
**Portões:** G17

## Critérios de aceite
1. **Dado** todos os setores com card fechado, **quando** abro o caso, **então** o botão "Pedir a petição" fica ativo; antes disso fica bloqueado e diz quem falta.
2. **Dado** o pedido, **quando** a IA escreve, **então** a minuta cita os casos do acervo e os documentos do caso que usou.
3. **Dado** a minuta, **quando** abro, **então** vejo a versão e posso pedir outra versão com um comentário.
4. **[v2]** **Dado** o pedido da petição, **quando** a IA escreve, **então** usa o parecer médico confirmado (PREV-68) para ligar cada requisito do benefício ao documento que o prova, e a jurimetria do juízo (PREV-78) quando houver.
5. **[v2]** **Dado** um caso da matriz de `docs/requisitos/roteiro-laudos.md` sem parecer "Suficiente" nem dispensa, **quando** tento pedir a petição, **então** o botão fica bloqueado (G17).

## Fora do escopo desta história
- O Knowledge Map de como montar cada tipo de peça (fica para a história da base de conhecimento, no padrão do ADR-013).

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G17**: O caso só é liberado ao Jurídico, aprovado para o INSS ou tem petição pedida com parecer médico "Suficiente" confirmado por pessoa; só a sênior dispensa, com justificativa

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
