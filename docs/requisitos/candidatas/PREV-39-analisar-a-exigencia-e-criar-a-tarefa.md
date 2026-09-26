# PREV-39 · Analisar a exigência e criar a tarefa do setor

> Candidata a história, diagrama **D3a · Depois do protocolo: vigília e exigências do juiz**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** analisar a exigência e criar a tarefa de cada setor, com prazo na agenda\
**para** cumprir a exigência do juiz no prazo.

**Passo BPMN:** `D3a.02` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** advogada responsável\
**Portões:** G5

## Critérios de aceite
1. **Dado** uma exigência, **quando** marco "precisa cumprir", **então** escolho os setores (Atendimento, Jurídico, Documentação, perícia) e cada um recebe a tarefa com o prazo contado (PREV-50).
2. **Dado** "só ciência", **quando** marco, **então** o processo volta para a vigília.
3. **Dado** as tarefas sugeridas pela IA, **quando** escolho setores diferentes, **então** vale a minha escolha (G5).
4. **[v2]** **Dado** uma exigência com mais de um pedido, **quando** a analiso, **então** ela vira a lista de itens com prazo, responsável e prova do PREV-79.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: advogada responsável. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- **G5**: Quem analisa a exigência do juiz e define o setor são os advogados, não a IA

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
