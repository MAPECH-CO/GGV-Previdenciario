# PREV-49 · Vigiar 3 vezes por dia com alarme de falha

> Candidata a história, diagrama **D4 · O diário e o acervo que aprende**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** sênior\
**quero** que a vigília rode 3 vezes por dia e dispare alarme quando uma rodada falhar\
**para** nunca achar que foi um dia sem publicação quando na verdade o sistema não olhou.

**Passo BPMN:** `D4.01` · **Prioridade:** 1 · **Estimativa:** P\
**Perfil:** sênior\
**Portões:** G13

## Critérios de aceite
1. **Dado** uma rodada que falhou, **quando** termina, **então** a sênior recebe o alarme e o painel mostra "Vigília falhou às HH:MM" (G13).
2. **Dado** uma rodada sem publicações, **quando** termina, **então** o painel mostra "Rodada OK, nenhuma publicação".

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: sênior. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G13**: A vigília roda 3 vezes por dia; rodada que falhou dispara alarme e nunca parece um dia sem publicação

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "sênior".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
