# PREV-27 · Mandar para perícia quando o benefício pede

> Candidata a história, diagrama **D2 · Via administrativa no INSS**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** marcar se o caso precisa de perícia médica ou avaliação social e disparar o fluxo de perícia\
**para** que a perícia corra junto com o protocolo, sem esperar.

**Passo BPMN:** `D2.03` · **Prioridade:** 2 · **Estimativa:** P\
**Perfil:** advogada responsável

## Critérios de aceite
1. **Dado** o caso aprovado, **quando** marco "precisa de perícia médica" ou "avaliação social", **então** o DP começa (PREV-54).
2. **Dado** "sem perícia", **quando** marco, **então** o caso só espera o protocolo para entrar na vigília.
3. **Dado** o protocolo feito e a perícia resolvida (ou sem perícia), **quando** os dois terminam, **então** o caso entra na vigília.
4. **[v2]** **Dado** "precisa de perícia", **quando** marco, **então** a recomendação sobre a perícia (PREV-72) é gerada antes de o Atendimento marcar.

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
