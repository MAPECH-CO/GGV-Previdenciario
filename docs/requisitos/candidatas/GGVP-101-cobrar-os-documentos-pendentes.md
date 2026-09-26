# GGVP-101 · Cobrar os documentos pendentes

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Cartão no Jira: [GGVP-101](https://mapech.atlassian.net/browse/GGVP-101), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-101. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** uma tarefa de cobrança com lembretes enquanto o cliente não manda o que falta\
**para** o caso não parar esperando o cliente.

**Passo BPMN:** `D1.23` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** documentos pendentes, **quando** as boas-vindas saem, **então** o Atendimento recebe a tarefa de cobrança com a lista.
2. **Dado** que o cliente mandou, **quando** a Documentação recebe, **então** o documento segue para scanner ou card conforme papel ou digital, e o checklist é conferido de novo.
3. **Dado** o limite de cobranças atingido, **quando** a última tentativa falha, **então** a tarefa sobe para a sênior (GGVP-94).

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
