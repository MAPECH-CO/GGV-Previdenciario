# GGVP-53 · Marcar a perícia com o cliente

> Candidata a história, diagrama **DP · Perícia padrão (chamada por D2, D3 e D3a)**. Cartão no Jira: [GGVP-53](https://mapech.atlassian.net/browse/GGVP-53), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-53. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** marcar a perícia com o cliente, tentando de novo se não der, e colocar a data na ficha\
**para** o cliente ir à perícia.

**Passo BPMN:** `DP.02`, `DP.04` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** a tarefa de perícia, **quando** não consigo marcar, **então** registro a tentativa e a tarefa continua comigo (GGVP-94).
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
