# GGVP-66 · Comparecimento e remarcação

> Candidata a história, diagrama **DP · Perícia padrão (chamada por D2, D3 e D3a)**. Cartão no Jira: [GGVP-66](https://mapech.atlassian.net/browse/GGVP-66), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-66. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** registrar se o cliente compareceu e, se não, remarcar\
**para** não prejudicar o pedido por falta sem justificativa.

**Passo BPMN:** `DP.07` · **Prioridade:** 1 · **Estimativa:** P\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** o dia da perícia passado, **quando** abro a tarefa, **então** preciso marcar "compareceu" ou "não compareceu".
2. **Dado** "não compareceu", **quando** marco, **então** a tarefa volta para marcar de novo e a remarcação conta no limite.
3. **Dado** o limite de remarcações atingido, **quando** a última falha, **então** a tarefa sobe para o Jurídico.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Q1: Limites e intervalos de cobrança, contato e remarcação ("a definir")

## Dúvidas respondidas pelo PO
- (vazio)
