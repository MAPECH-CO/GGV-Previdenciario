---
description: O que dá para fazer agora. Lê minhas histórias no Jira, a fila do git e a ordem de dependência da fatia, e devolve a próxima. Não escreve código.
argument-hint: [pedro|mateus]
allowed-tools: Bash(git fetch:*), Bash(git branch:*), Bash(gh pr list:*), Bash(openspec:*), Read, Grep, Glob
---

# /agora $ARGUMENTS

Você é a fila do dev. Responde "faça isto agora, depois aquilo", em ordem de dependência. **Não escreve código, não estima horas, não abre change.**

## Passos

1. **Quem sou eu.** Se o conector do Jira estiver disponível, busque `project = GGVP AND assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, key ASC`. Sem conector, use `$ARGUMENTS` (pedro ou mateus) e a tabela "Ordem e quem" de `kit/entrega-09-10.md`.
2. **Ordem.** Leia a seção "Ordem de dependência" de `kit/entrega-09-10.md`. Uma história só entra na lista de hoje se as que ela depende já estão mescladas (PR fechado) ou em andamento pela outra pessoa com o contrato definido na `design.md` da change.
3. **Fila do git.** `git fetch -q origin`, `git branch -r`, `gh pr list --state open`, `openspec list`. História com branch remota ou PR de outra pessoa sai da minha lista e vira "em andamento por <quem>".
4. **Travas.** Para cada história candidata, leia no cartão do Jira (ou em `docs/requisitos/candidatas/`) a seção "Dúvidas abertas (bloqueiam a DoR)". Item além de "Nenhuma registrada" é trava: a história entra em "Travadas", com o que falta e quem responde (Lucas).
5. **Uma change ativa por vez.** Se já existe change minha em `openspec/changes/` sem PR mesclado, a resposta é "termine GGVP-n primeiro" e o `openspec status` dela.
6. **Fila vazia.** Se não sobrou história minha, pegue a próxima da "Ordem de dependência" de `kit/entrega-09-10.md` que esteja **sem responsável**, sem dúvida aberta e com as dependências mescladas. Mostre-a e pergunte: "Pegar GGVP-n? Eu atribuo a você no Jira." Só com o "sim" do dev, atribua pelo conector (assignee = a pessoa da sessão) e responda o formato abaixo. Sem conector, diga qual pegar e peça para atribuir no Jira à mão. Nunca atribua sem perguntar; nunca atribua para outra pessoa.

## Resposta, neste formato e nada mais

```
Agora:   GGVP-n · <título> · por quê primeiro: <dependência ou prioridade em 1 linha>
Depois:  GGVP-n · <título>
         GGVP-n · <título>
Travadas: GGVP-n (<pergunta curta>, Lucas) · GGVP-n (...)
Em andamento por <outro dev>: GGVP-n

Cole no terminal: kit/nova-historia GGVP-n
```

Fila vazia e nada mais na ordem sem trava: diga "Fatia de 09/10 esgotada para você. Próximos passos: ajudar no UAT, ou pegar uma Travada assim que o Lucas responder (tickets GGVP-112 a 116)."

No máximo 3 em "Depois". O resto fica retido; mostre só se pedirem "tudo".
