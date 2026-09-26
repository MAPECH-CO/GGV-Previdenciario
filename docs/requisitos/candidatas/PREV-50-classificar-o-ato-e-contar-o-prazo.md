# PREV-50 · Classificar o ato e contar o prazo

> Candidata a história, diagrama **D4 · O diário e o acervo que aprende**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que a IA classifique o ato (sentença, exigência, despacho, andamento) e o sistema conte o prazo pela Lei 11.419, pelo lado mais seguro\
**para** receber a publicação já com o prazo certo.

**Passo BPMN:** `D4.02`, `D4.03` · **Prioridade:** 1 · **Estimativa:** G\
**Perfil:** advogada responsável\
**Portões:** G12

## Critérios de aceite
1. **Dado** uma publicação casada, **quando** a IA classifica, **então** o tipo de ato aparece e pode ser corrigido pelo Jurídico.
2. **Dado** o tipo de ato, **quando** o sistema conta o prazo, **então** usa a regra da Lei 11.419 e, na dúvida, a data mais cedo (G12).
3. **Dado** o prazo contado, **quando** abro a publicação, **então** vejo a data inicial, a final e a regra usada.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G12**: Na dúvida, o prazo é contado pelo lado mais seguro

## Dependências e referências
- A base não calcula prazo; quem calcula é código com teste.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
