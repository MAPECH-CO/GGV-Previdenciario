# PREV-28 · Vigiar o Meu INSS todo dia

> Candidata a história, diagrama **D2 · Via administrativa no INSS**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que os casos protocolados sejam vigiados todo dia no Meu INSS e só apareçam para mim quando algo mudar\
**para** não abrir caso por caso para descobrir que nada aconteceu.

**Passo BPMN:** `D2.04` · **Épico:** Via administrativa · **Prioridade:** 1 · **Estimativa:** G\
**Perfil:** advogada responsável

## Critérios de aceite
1. **Dado** um caso protocolado, **quando** a vigília do dia roda, **então** o caso mostra a data e hora da última verificação.
2. **Dado** "nada novo", **quando** a vigília termina, **então** o caso não entra na minha fila.
3. **Dado** uma decisão ou uma exigência, **quando** a vigília encontra, **então** o caso entra na minha fila com o tipo ("Decisão" ou "Exigência") e o texto.
4. **Dado** que a vigília falhou, **quando** abro o painel, **então** vejo o alarme de falha, e o dia não aparece como "sem novidade".

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- A vigília é feita por pessoa com certificado digital (como está no board) ou automatizada? Muda a estimativa inteira.
- Q6: A vigília do Meu INSS é manual (pessoa com certificado digital) ou automatizada?

## Dúvidas respondidas pelo PO
- (vazio)
