# Quando o Claude descontrola

Sinal, e o que fazer na hora. Nenhum item pede reunião.

| Sinal | Faça |
|---|---|
| Abriu subagente, "vou dispatchar agentes", "orquestrando" | **Esc.** Escreva: "sem subagente, continue pelo tasks.md, uma tarefa por vez". |
| Mudou arquivo que não é da história | `git diff --stat`. Volte o arquivo: `git checkout -- <arquivo>`. Escreva: "escopo é o tasks.md da change". |
| Refatorou, criou abstração, "para o futuro" | `git diff`. Reverta. Escreva: `/ponytail` e "menor mudança que cumpre o critério". |
| Disse "testado", "passou", sem mostrar saída | Escreva: "rode e cole a saída do comando". Sem saída, não é verdade. |
| Resposta longa, lenta, esqueceu o pedido, repete coisas | `/compact`. Se não resolver: feche a sessão, abra outra na mesma branch. O kit lembra o estado; `openspec status --change <nome>` também. |
| Mais de uma hora na mesma tarefa | Pare. A tarefa está grande. `/opsx:update` e quebre a tarefa em duas ou três no `tasks.md`. |
| Inventou regra de negócio, prazo, valor | Escreva: "isso está na história? cite a linha". Se não está, é **[decidir]**: pergunta ao Lucas, não codifica. |
| Quer "só ajustar" antes de perguntar "Agora ok?" | Escreva: "rode as verificações e pergunte". A pergunta é a regra, não a vontade dele. |
| Pediu para ler `.env`, token, senha | Não. As permissões do projeto já negam. Se insistir, é sinal para sessão nova. |

## O que nunca fazer

- Aceitar "quase pronto". A história tem teste passando e saída na tela, ou não terminou.
- Deixar rodando sem olhar. Dez minutos sem ler a saída é como o projeto anterior morreu.
- Abrir duas histórias na mesma pasta. Uma branch, uma árvore de trabalho (`git worktree add ../prev-GGVP-99 feat/GGVP-99-...`), um PR.
- Mudar `CLAUDE.md`, `settings.json` ou `openspec/config.yaml` na sua máquina só. Muda por PR, para os quatro.

## Salvar e retomar

- Antes de fechar uma sessão longa: `/ecc:save-session`.
- Ao abrir a próxima: `/ecc:resume-session`, ou só continue. O hook do kit já diz história, change e quantas tarefas faltam.
