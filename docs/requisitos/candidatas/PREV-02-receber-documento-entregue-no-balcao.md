# PREV-02 · Receber documento entregue no balcão

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Documentação\
**quero** receber o documento que o cliente trouxe e mandar direto para o scanner, já ligado ao cliente\
**para** que o documento entre no caso sem ficar solto na mesa.

**Passo BPMN:** `D1.02` · **Épico:** Documentos · **Prioridade:** 2 · **Estimativa:** P\
**Perfil:** Documentação

## Critérios de aceite
1. **Dado** um cliente que veio entregar documento, **quando** o Atendimento escolhe "Entregar documento", **então** a Documentação recebe a tarefa com o nome do cliente.
2. **Dado** o documento digitalizado, **quando** o scanner termina, **então** o arquivo cai no card do cliente e segue para a leitura (PREV-18).

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
- (vazio)
