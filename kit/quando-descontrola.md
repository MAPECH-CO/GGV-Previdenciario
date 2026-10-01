# Quando o Claude descontrola

Sinal, e o que fazer na hora. Nenhum item pede reunião.

| Sinal | Faça |
|---|---|
| Abriu subagente, "vou dispatchar agentes", "orquestrando" | **Esc.** Escreva: "sem subagente, continue a história atual, uma tarefa por vez". |
| Mudou arquivo que não é da história atual | `git diff --stat`. Volte o arquivo: `git checkout -- <arquivo>`. Escreva: "escopo é a história atual do /epico". |
| Refatorou, criou abstração, "para o futuro" | `git diff`. Reverta. Escreva: `/ponytail` e "menor mudança que cumpre o critério". |
| Disse "testado", "passou", sem mostrar saída | Escreva: "rode e cole a saída do comando". Sem saída, não é verdade. |
| Começou a codar história que não está em "Refinada" | Escreva: "esse cartão não foi revisado, pule". Ele deve listar quem revisa. |
| Falou em código de tela, id do Miro, nome de arquivo | Escreva: "fala simples, sem código". É regra do `/epico`. |
| Resposta longa, lenta, esqueceu o pedido, repete coisas | `/compact`. Se não resolver: feche a sessão, abra outra e digite `/epico <épico>`. Ele retoma pela história em "Em andamento". |
| Mais de uma hora na mesma tarefa | Pare. A tarefa está grande. Escreva: "quebra essa tarefa em duas ou três no tasks.md". |
| Inventou regra de negócio, prazo, valor | Escreva: "isso está na história? cite a linha". Se não está, é dúvida aberta: pergunta a quem revisa, não codifica. |
| Quer "só ajustar" antes de perguntar "Agora ok?" | Escreva: "rode as verificações e pergunte". A pergunta é a regra, não a vontade dele. |
| Pediu para ler `.env`, token, senha | Não. As permissões do projeto já negam. Se insistir, é sinal para sessão nova. |

## O que nunca fazer

- Aceitar "quase pronto". A história tem teste passando e saída na tela, ou não terminou.
- Deixar rodando sem olhar. Dez minutos sem ler a saída é como o projeto anterior morreu.
- Abrir dois épicos na mesma pasta, ou duas sessões na mesma pasta.
- Mudar `CLAUDE.md`, `settings.json` ou `openspec/config.yaml` na sua máquina só. Muda por PR, para os quatro.

## Salvar e retomar

- Antes de fechar uma sessão longa: `/ecc:save-session`.
- Ao abrir a próxima: `/epico <épico>`. O hook do kit já diz épico, história atual e quantas tarefas faltam.
