# PREV-19 · Verificar o contrato assinado

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** receber uma tarefa só quando a IA não reconheceu o contrato assinado ou apontou problema\
**para** conferir à mão só o que precisa.

**Passo BPMN:** `D1.19` · **Prioridade:** 2 · **Estimativa:** M\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** um contrato assinado que a IA reconheceu e está tudo certo, **quando** a leitura termina, **então** nenhuma tarefa é criada e o caso segue.
2. **Dado** um contrato que a IA não entendeu ou em que apontou problema, **quando** a leitura termina, **então** recebo a tarefa com o que a IA apontou.
3. **Dado** que confirmo o problema, **quando** corrijo os campos, **então** o documento é reenviado para assinatura.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
