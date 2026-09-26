# PREV-01 · Reconhecer quem chegou e para quê

> Candidata a história, diagrama **D1 · Entrevista, benefício e documentos**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento\
**quero** buscar quem chegou e ver na hora se é cliente, lead já cadastrado ou lead novo, e se há data marcada e para qual etapa\
**para** mandar cada pessoa para o lugar certo sem perguntar tudo de novo.

**Passo BPMN:** `D1.01`, `D1.04` · **Épico:** Recepção · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento

## Critérios de aceite
1. **Dado** um CPF ou nome de cliente do escritório, **quando** busco, **então** vejo o caso, a etapa atual e o agendamento do dia, se houver.
2. **Dado** um lead com contato prévio ou data marcada, **quando** busco, **então** vejo o agendamento e se a ficha de atendimento já foi preenchida.
3. **Dado** alguém que não está no sistema, **quando** busco, **então** o portal oferece "Lead novo: preencher a ficha".
4. **Dado** um cliente que veio para outra etapa, **quando** escolho "Encaminhar", **então** o setor responsável recebe a tarefa com a ficha e o agendamento (`D1.03`).

## Fora do escopo desta história
- O cadastro completo do lead, que é feito depois da entrevista (PREV-09).

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
