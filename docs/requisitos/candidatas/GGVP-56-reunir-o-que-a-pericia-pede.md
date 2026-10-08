# GGVP-56 · Reunir o que a perícia pede

> Candidata a história, diagrama **DP · Perícia padrão (chamada por D2, D3 e D3a)**. Cartão no Jira: [GGVP-56](https://mapech.atlassian.net/browse/GGVP-56), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-56. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Documentação\
**quero** receber a lista do que reunir (laudos e exames na médica; CadÚnico e grupo familiar na social) quando o Jurídico administrativo decide que a perícia pede documento novo\
**para** o cliente chegar à perícia com tudo.

**Passo BPMN:** `DP.03` · **Prioridade:** 2 · **Estimativa:** P\
**Perfil:** Documentação

## Critérios de aceite
1. **Dado** perícia médica que pede documento novo, **quando** o Jurídico administrativo atribui a tarefa à Documentação, **então** recebo a lista de laudos e exames do caso.
2. **Dado** avaliação social que pede documento novo, **quando** o Jurídico administrativo atribui a tarefa à Documentação, **então** recebo CadÚnico e grupo familiar.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Documentação. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Documentação".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- Ajuste de 29/09/2026 (Lucas): "Pede documento novo?" é decisão do Jurídico administrativo, que atribui à Documentação. A tarefa só nasce quando ele decide que a perícia pede documento novo; antes, nascia sempre que a perícia era marcada.
