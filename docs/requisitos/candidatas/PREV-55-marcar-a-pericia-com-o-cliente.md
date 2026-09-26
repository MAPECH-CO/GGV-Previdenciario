# PREV-55 · Marcar a perícia com o cliente

> Candidata a história, diagrama **DP · Perícia padrão (chamada por D2, D3 e D3a)**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** marcar a perícia com o cliente, tentando de novo se não der, e colocar a data na ficha\
**para** o cliente ir à perícia.

**Passo BPMN:** `DP.02`, `DP.04` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** a tarefa de perícia, **quando** não consigo marcar, **então** registro a tentativa e a tarefa continua comigo (T-04).
2. **Dado** a perícia marcada, **quando** coloco data e local na ficha, **então** o sistema agenda o lembrete da véspera para o cliente.

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
