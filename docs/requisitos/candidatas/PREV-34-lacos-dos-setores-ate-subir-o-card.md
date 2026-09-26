# PREV-34 · Laços dos setores até subir o card

> Candidata a história, diagrama **D3 · Judicialização**. Chave provisória: vira `GGVP-n` quando o cartão for criado no Jira, com o rótulo `a-validar-bpmn`. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** Atendimento ou Documentação\
**quero** cumprir a tarefa despachada pela sênior e subir no card quando conseguir\
**para** liberar a petição.

**Passo BPMN:** `D3.04` · **Prioridade:** 1 · **Estimativa:** M\
**Perfil:** Atendimento ou Documentação

## Critérios de aceite
1. **Dado** uma tarefa do Atendimento, **quando** consigo a informação com o cliente, **então** registro no card e dou OK.
2. **Dado** uma tarefa da Documentação, **quando** consigo o documento, **então** anexo no card e dou OK.
3. **Dado** vários setores acionados, **quando** um não subiu o card ou a perícia não voltou do DP, **então** o caso continua aberto mostrando quem falta.
4. **Dado** o limite atingido, **quando** a última tentativa falha, **então** a tarefa sobe para a sênior (T-04).

## Fora do escopo desta história
- A definir no refinamento.

## Dados e permissões
- Quem usa: Atendimento ou Documentação. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "Atendimento ou Documentação".

## Dúvidas abertas (bloqueiam a DoR)
- Q1: Limites e intervalos de cobrança, contato e remarcação ("a definir")

## Dúvidas respondidas pelo PO
- (vazio)
