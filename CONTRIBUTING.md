# Como contribuir

## Branches
- `main` é protegida. Sempre implantável em homologação.
- Uma branch por história: `feat/GGVP-123-descricao`, `fix/GGVP-124-descricao`, `docs/GGVP-125-descricao`.
- Branch vive no máximo uma sprint. Rebase diário em `main`. Apagar após o merge.
- Sem branch pessoal de longa duração, sem worktree paralelo fora da história.

## Commits
- Conventional Commits em português, com a chave do Jira: `feat(prazos): GGVP-123 listar prazos do dia`.
- Commit pequeno e completo. Não commitar código comentado, segredo, `.env`, `node_modules`.

## Pull request
1. Um PR por história. Título com a chave: `GGVP-123: listar prazos do dia`.
2. Preencher o template. Dizer o que foi feito, como foi testado e o que ficou de fora.
3. Revisão obrigatória pelo outro dev. Ninguém mergeia o próprio PR. O PO não revisa código.
4. CI verde (typecheck, lint, testes, segredos) antes de pedir revisão.
5. Revisão responde em até um dia útil. Comentário resolvido antes do merge.
6. Merge por squash. A mensagem final leva a chave do Jira.

## Trabalho com IA
- A história é o prompt. O agente trabalha dentro do escopo dela.
- O dev é responsável pelo que o agente escreveu. Ler antes de abrir o PR.
- IA pode revisar como extra. Não substitui a revisão humana.

## Definition of Done
Ver `docs/scrum/definition-of-done.md`. Sem DoD, a história volta.
