# Modelos que entram no repositório por decisão de uma pessoa

## `settings.json` → `.claude/settings.json`

Configuração do Claude Code para este repositório, versionada, igual para os quatro. O agente não a escreve sozinho: uma pessoa copia, lê e commita.

```
copy kit\modelos\settings.json .claude\settings.json     (Windows)
cp kit/modelos/settings.json .claude/settings.json       (Mac ou Linux)
```

O que ela faz:
- **Plugins do projeto** (`enabledPlugins`): liga os 7 que o kit usa e desliga, só aqui, os que abrem subagentes. Marketplaces extras em `extraKnownMarketplaces`; o Claude Code oferece instalar na primeira sessão.
- **Hooks do ECC no perfil `minimal`** (`env`): só os de segurança.
- **Permissões**: libera leitura do git, `openspec` e testes sem perguntar; nega ler `.env`, chaves, e `git push --force`, `git reset --hard`, `rm -rf`.
- **Hook de estado** (`kit/hooks/estado.js`): a cada prompt, lembra ao Claude o épico, a história atual e quantas tarefas faltam. Nunca bloqueia.

Mudou de ideia sobre um plugin ou permissão? Muda aqui, por PR.
