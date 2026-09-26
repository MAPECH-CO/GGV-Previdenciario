# GGVP-57 · Calcular tempo e pontos sobre o CNIS

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Cartão no Jira: [GGVP-57](https://mapech.atlassian.net/browse/GGVP-57), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-57. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** registrar o cálculo de tempo e pontos feito sobre o CNIS nos benefícios que exigem cálculo\
**para** decidir se o cliente já pode se aposentar.

**Passo BPMN:** `D1.13` · **Prioridade:** 2 · **Estimativa:** M\
**Perfil:** advogada responsável

## Critérios de aceite
1. **Dado** um benefício da lista "com cálculo", **quando** abro o caso, **então** o passo "Calcular tempo e pontos" aparece como obrigatório antes do fechamento.
2. **Dado** o cálculo feito, **quando** marco "ainda não pode se aposentar", **então** o caso vai para "Registrar o motivo" com a data prevista (GGVP-60).
3. **Dado** um benefício sem cálculo, **quando** abro o caso, **então** o passo não aparece.

## Fora do escopo desta história
- O portal calcular sozinho (no BPMN é "feito por pessoa").

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Q12: O "cálculo de tempo e pontos" continua manual ou há plano de automatizar?

## Dúvidas respondidas pelo PO
- (vazio)
