# apps/web

Front-end do portal GGV Previdenciário: React 19, Vite e TypeScript. Sai do protótipo do Figma
("Portal GGV Previdenciário", `nHOPzl005CpWDXUWyVZIo6`). Stack ainda é proposta, até o ADR-001 sair.

## Rodar

```bash
cd apps/web
npm install
npm run dev        # http://localhost:5173
```

Sem Docker e sem banco: hoje as telas usam dados fictícios de `src/dados/`.

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor local com recarga |
| `npm test` | testes (Vitest, jsdom) |
| `npm run e2e` | testes no navegador (Playwright, Chromium) |
| `npm run typecheck` | TypeScript sem emitir |
| `npm run lint` | oxlint |
| `npm run build` | confere tipos e gera `dist/` |
| `npm run tokens` | regera `src/design/tokens.css` a partir de `figma-tokens.json` |

Páginas: `/` é a Central do Atendimento; `/tokens` é o guia vivo dos tokens. Qualquer outro caminho cai
em "Esta tela ainda não foi construída". Para conferir uma tela no tema escuro ou na fonte grande sem
clicar: `/?tema=escuro&fonte=grande`.

## Testes no navegador (Playwright)

Uma vez por máquina, baixe o Chromium sem janela que o Playwright usa (cerca de 120 MB; fica em
`%LOCALAPPDATA%\ms-playwright`, fora do repositório):

```bash
npx playwright install --only-shell chromium
```

Depois, `npm run e2e`. Ele sobe o `npm run dev` sozinho ou usa o que já estiver de pé na porta 5173.
Os testes ficam em `e2e/` e terminam em `.e2e.ts`, para o Vitest não pegá-los. Servem para o que o
jsdom não calcula: o CSS aplicado (tema, fonte, cor da tarefa urgente) e as rotas de verdade.

## Tokens do Figma

O Figma tem duas coleções de variáveis: **Tema** (29 cores, modos Claro e Escuro) e **Acessibilidade**
(17 tamanhos de fonte, modos Padrão e Fonte grande, +25%). O retrato delas está em
`src/design/figma-tokens.json`; `npm run tokens` gera o `tokens.css`:

- `cor/fundo` vira `--cor-fundo`, `fonte/13` vira `--fonte-13`. O nome é o do Figma, em português.
- O tema escuro liga com `<html data-tema="escuro">`; a fonte grande, com `<html data-fonte="grande">`.
  Os botões "☾ Escuro" e "A+" do topo fazem isso (`src/design/preferencias.ts`) e guardam a escolha no navegador.
- Fonte em `rem`: igual ao px do Figma com o navegador em 16px, e respeita a fonte que a pessoa configurou.
- Raios e a família Inter **não são variáveis no Figma**; os valores vêm das telas e ficam em `base.css`.

Para atualizar depois de mexer no Figma: extraia as coleções de novo, ajuste `figma-tokens.json` e rode
`npm run tokens`. O teste `tokens.test.ts` falha se o CSS ficar fora de dia com o JSON ou se algum
`var(--x)` apontar para token que não existe.

## Estrutura

```
src/design/       tokens (gerado), base global, preferências de aparência
src/componentes/  peças reaproveitáveis (cada uma com .tsx, .module.css e teste)
src/paginas/      telas
src/dados/        tipos e dados fictícios; o contrato de verdade vai para packages/contratos
```

## O que ainda não está ligado

Estes botões existem e têm o visual do Figma, mas não fazem nada ainda:

- Chat "Pergunte ou peça": o envio só avisa que não há servidor (GGVP-82).
- Busca: não consulta nada; o resultado respeitará as permissões do perfil (GGVP-78, CA9).
- Aba "✦ Suporte": vai abrir o Chatwoot (ADR-015).
- Seletor de função ("Atendimento ⌄"): falta o overlay "Trocar perfil".
- "Tarefas do setor": tela não construída; depende da dúvida aberta com o Lucas sobre quem vê o quê.
- Links de tarefa (`/tarefas/:id`), cliente (`/clientes/:id`) e Agenda: rotas provisórias.

## Se o `npm install` deixar o Vite ou o Vitest sem motor

Erro "Cannot find native binding" (rolldown): é o bug do npm com dependências opcionais. Resolva com
`npm install --no-save @rolldown/binding-win32-x64-msvc@1.2.12` (no Windows 64 bits; em outro sistema,
o pacote `@rolldown/binding-<sistema>` correspondente).

## Windows e OneDrive

O repositório está dentro do OneDrive, e a pasta `node_modules` tem milhares de arquivos. Se o OneDrive
ficar lento, tire o clone do OneDrive ou pause a sincronização desta pasta. Por causa do mesmo
ambiente, o Vitest roda no pool `threads` (o `forks` estourava o tempo ao subir o worker).
