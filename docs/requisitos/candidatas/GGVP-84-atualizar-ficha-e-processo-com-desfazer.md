# GGVP-84 · Atualizar ficha e processo com desfazer

> Candidata a história, diagrama **D5 · Conversa com lead ou cliente em análise**. Cartão no Jira: [GGVP-84](https://mapech.atlassian.net/browse/GGVP-84), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-84. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que a IA atualize a ficha (contato, endereço, grupo familiar) e os campos do processo (fatos novos, datas, documentos citados) e eu confira\
**para** manter o caso atualizado sem digitação e sem perder o valor antigo.

**Passo BPMN:** `D5.03`, `D5.04` · **Prioridade:** 2 · **Estimativa:** M\
**Perfil:** advogada responsável\
**Portões:** G14

## Critérios de aceite
1. **Dado** as mudanças identificadas, **quando** a IA atualiza, **então** só muda o que foi dito na conversa (G14).
2. **Dado** um campo alterado, **quando** abro o histórico, **então** vejo o valor antigo e posso desfazer.
3. **Dado** que confiro, **quando** confirmo ou corrijo, **então** o caso volta para onde estava.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G14**: A IA só muda o que foi dito na conversa; o valor antigo fica no histórico e o Jurídico pode desfazer

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
