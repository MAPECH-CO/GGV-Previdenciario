---
description: O dev disse "ok". Verifica, commita com a chave GGVP, sobe a branch e abre o PR com o template. Não arquiva a change.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(npm:*), Bash(pnpm:*), Bash(openspec:*), Read, Glob, Grep
---

# /ok

O dev aprovou o resultado. Feche a história até o PR. Pare em qualquer verificação que falhar e mostre a saída. **Nunca diga que passou sem ter rodado.**

## Passos

1. **Chave e change.** A branch atual tem `GGVP-n`. Existe `openspec/changes/<...ggvp-n...>/tasks.md` com todas as tarefas marcadas. Falta tarefa: liste e pare.
2. **Verificações.** Rode as que existirem no projeto, nesta ordem, e cole a saída resumida: typecheck, lint, testes, Playwright quando a história tem tela. Se `kit/campos` ou `packages/campos` mudou, rode os testes dele também. Falhou: mostre e pare.
3. **Escopo.** `git status` e `git diff --stat`. Arquivo fora da história (outra chave, outro módulo): pergunte se sai do commit. `.env`, chave, token ou dado real de cliente no diff: pare.
4. **Commit.** Conventional Commits em português, com a chave: `feat(<área>): GGVP-n <título curto>`. Um commit para o que ainda não foi commitado. Nunca `--no-verify`.
5. **Subir.** `git push -u origin HEAD`. Nunca force.
6. **PR.** `gh pr create` com título `GGVP-n: <título curto>` e corpo no template `.github/pull_request_template.md`:
   - **O que foi feito:** do `proposal.md`, em 3 linhas.
   - **Como foi testado:** a saída do passo 2.
   - **O que ficou de fora e por quê:** do "Fora do escopo" da história.
   - **Change do OpenSpec:** `openspec/changes/<nome>`.
   - Checklist: marque só o que é verdade.
7. **Responder** em 5 linhas: link do PR, quem revisa (o outro dev, nunca o autor), o Action já moveu o Jira para "Em revisão", o passo seguinte (depois do merge e do "Aceita" do Lucas, rodar `/opsx:archive <nome-da-change>`), e a última linha sempre: "Próxima história: `/agora`."
