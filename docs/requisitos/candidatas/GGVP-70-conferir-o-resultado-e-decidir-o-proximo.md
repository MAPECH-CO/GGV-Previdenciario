# GGVP-70 · Conferir o resultado e decidir o próximo passo

> Candidata a história, diagrama **DP · Perícia padrão (chamada por D2, D3 e D3a)**. Cartão no Jira: [GGVP-70](https://mapech.atlassian.net/browse/GGVP-70), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-70. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** conferir o resultado no GERID ou no processo e decidir: favorável sobe no card e volta para quem pediu; desfavorável, peço nova perícia ou devolvo\
**para** fechar a perícia com decisão registrada.

**Passo BPMN:** `DP.08`, `DP.10` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** advogada responsável

## Critérios de aceite
1. **Dado** a perícia feita, **quando** o resultado aparece no GERID ou no processo, **então** recebo a tarefa "Conferir o resultado".
2. **Dado** "favorável", **quando** registro, **então** o resultado sobe no card e o caso volta ao diagrama de origem.
3. **Dado** "desfavorável" e "vale pedir nova perícia", **quando** registro, **então** o Atendimento recebe a tarefa de marcar de novo.
4. **Dado** "desfavorável" e "não vale", **quando** registro, **então** o caso volta ao diagrama de origem marcado como desfavorável.

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
