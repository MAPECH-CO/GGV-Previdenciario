# PREV-29 · Tratar exigência do INSS

> Candidata a história, diagrama **D2 · Via administrativa no INSS**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** advogada responsável\
**quero** transformar cada exigência numa tarefa com prazo na agenda: card para a Documentação quando pede documento, fluxo de perícia quando pede perícia\
**para** cumprir a exigência dentro do prazo.

**Passo BPMN:** `D2.05` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** advogada responsável

## Critérios de aceite
1. **Dado** uma exigência de documentos, **quando** crio a tarefa, **então** a Documentação recebe o card com o que foi pedido e o prazo.
2. **Dado** uma exigência de perícia ou avaliação social, **quando** escolho "Perícia", **então** o DP começa e o resultado volta ao card.
3. **Dado** o documento conseguido, **quando** a Documentação sobe no card, **então** recebo a tarefa "Responder a exigência no portal do INSS".
4. **Dado** a resposta enviada, **quando** registro, **então** o caso volta para a vigília.
5. **Dado** o limite de cobranças atingido, **quando** a última tentativa falha, **então** a tarefa sobe para o sênior (T-04).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Os cards ficam na Documentação; a decisão sobre o que fazer fica no Jurídico (observação do board).

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "advogada responsável".

## Dúvidas abertas (bloqueiam a DoR)
- Q1: Limites e intervalos de cobrança, contato e remarcação ("a definir")

## Dúvidas respondidas pelo PO
- (vazio)
