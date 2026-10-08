# GGVP-49 · Iniciar a tarefa de perícia

> Candidata a história, diagrama **DP · Perícia padrão (chamada por D2, D3 e D3a)**. Cartão no Jira: [GGVP-49](https://mapech.atlassian.net/browse/GGVP-49), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-49. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** que o sistema abra sozinho a tarefa de perícia para o Jurídico administrativo quando a perícia é pedida em qualquer diagrama (no D2, quando eu decido no D2.03 que o caso precisa)\
**para** a perícia seguir um fluxo só e voltar para quem pediu.

**Passo BPMN:** `DP.01` · **Épico:** Perícia · **Prioridade:** 1 · **Estimativa:** P\
**Perfil:** advogada responsável

## Critérios de aceite
1. **Dado** uma perícia pedida em D2, D3 ou D3a, **quando** o pedido é registrado (no D2, a decisão da advogada no D2.03), **então** o sistema abre sozinho a tarefa de perícia para o Jurídico administrativo e o caso mostra "Em perícia" ligado ao diagrama de origem.

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
- Ajuste de 29/09/2026 (Lucas): quem abre a tarefa de perícia passa a ser o sistema, sozinho; a advogada só decide se o caso precisa de perícia (D2.03). A tarefa vai para o Jurídico administrativo, não mais para o Atendimento.
