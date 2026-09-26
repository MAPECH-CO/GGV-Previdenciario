# PREV-76 · Importar o estudo prévio de peritos e juízes

> Candidata a história, diagrama **Jurimetria de perito e de juiz**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** sênior\
**quero** carregar no portal a base do estudo prévio, com a data de corte e a fonte\
**para** que a jurimetria use dados conferidos, e não o que a IA acha.

**Passo BPMN:** `D4.05` · **Épico:** Jurimetria · **Prioridade:** 2 · **Estimativa:** M\
**Perfil:** sênior

## Critérios de aceite
1. **Dado** o arquivo do estudo, **quando** importo, **então** o portal mostra quantos peritos, juízes, varas e processos entraram, a data de corte e as linhas rejeitadas com o motivo.
2. **Dado** um perito ou juiz que aparece com grafias diferentes, **quando** a importação roda, **então** o portal propõe a unificação e a sênior confirma.
3. **Dado** uma nova importação, **quando** conclui, **então** a anterior fica guardada e os painéis mostram a data da base em uso.

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: sênior. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "sênior".

## Dúvidas abertas (bloqueiam a DoR)
- Q13: Onde está o estudo prévio de peritos e juízes (banco, formato, campos), quem o atualiza e qual a data de corte?

## Dúvidas respondidas pelo PO
- (vazio)
