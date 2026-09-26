# GGVP-78 · Tela inicial "O que é meu hoje" por perfil

> Candidata a história, diagrama **Histórias transversais**. Cartão no Jira: [GGVP-78](https://mapech.atlassian.net/browse/GGVP-78), rótulo `a-validar-bpmn`. Chave provisória original: GGVP-78. Fonte: BPMN do Miro (frames "revisão BPMN") e roteiro de laudos do escritório.

**Como** qualquer pessoa da equipe\
**quero** abrir o portal e ver só as tarefas e casos que são meus hoje, em ordem de prazo\
**para** saber o que fazer sem navegar por menus nem ver o que não é do meu setor.

**Passo BPMN:** todas as raias humanas · **Épico:** Experiência por perfil · **Prioridade do PO:** 1 · **Estimativa:** M\
**Perfil:** qualquer pessoa da equipe

## Critérios de aceite
1. **Dado** que entro com o perfil Atendimento, **quando** abro o portal, **então** vejo a agenda do dia e a fila de tarefas do Atendimento, e não vejo petições nem valores.
2. **Dado** uma tarefa com prazo vencido ou que estourou o limite de cobranças, **quando** abro a fila, **então** ela aparece no topo e com cor de ação.
3. **Dado** uma tarefa na fila, **quando** clico nela, **então** abro direto o passo do caso onde a tarefa se resolve, com o que preciso para cumpri-la.
4. **Dado** que não tenho nada pendente, **quando** abro o portal, **então** vejo a mensagem "Nada pendente para você hoje" e o atalho para buscar um cliente.

## Fora do escopo desta história
- Painel gerencial com indicadores. **Dados e permissões:** cada perfil vê só a própria fila; a sênior vê também a fila do que escalou.

## Dados e permissões
- Quem usa: qualquer pessoa da equipe. Quem vê e quem edita: a definir no refinamento, conforme `docs/requisitos/perfis.md`.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma: a desenhar, no arquivo do perfil "qualquer pessoa da equipe".

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
