# Entrega de 09/10/2026: o que entra, em que ordem, quem faz

Dois devs, sete dias úteis a partir de 01/10. As 96 histórias não cabem. Cabe a fatia abaixo, funcionando em homologação, testada pelo Lucas. O resto vem depois, pelo mesmo método.

## O que está pronto no dia 09/10

Uma pessoa de cada perfil entra no portal, vê "O que é meu hoje", e um caso do D1 atravessa da recepção até a liberação ao Jurídico com o parecer médico. É o item 1 e o item 2 de `docs/requisitos/fatiamento.md`.

| Bloco | Histórias | Observação |
|---|---|---|
| Entrar no portal | **GGVP-117** login com e-mail e senha, **GGVP-96** perfis e permissões | Login não estava no BPMN; a história foi escrita em 30/09. Versão mínima, sem 2FA. |
| Fundação | **GGVP-108** identificadores (CPF, NB, protocolo, CNJ), **GGVP-105** motor de fluxo (só o D1), **GGVP-109** portões validados no servidor | Sem isso nenhuma tela do D1 sobe. As três estão em `backlog/06-revisao-jira/historias/` até entrarem no Jira. |
| Esqueleto por perfil | **GGVP-78** Central por função, **GGVP-86** navegar pelo caso | Sobre API mockada com o contrato Zod, desde o dia 1. |
| D1 de ponta a ponta | as histórias com rótulo `bpmn-d1-*`, mais **GGVP-20**, **33**, **93** e **95** (parecer médico e roteiro de laudos) | Lista final é do Pedro com o Lucas. Começa pela recepção (GGVP-16, 17, 21, 24) e termina na liberação (GGVP-18). |

Não entra até 09/10: D2, D3, D3a, D3b, DP, D4, D5, chat com ação (só consulta, se sobrar tempo), jurimetria, Google Drive, assinatura ZapSign, 2FA.

## Ordem e quem

As histórias já estão atribuídas no Jira. `/agora` lê `assignee = currentUser()` e esta ordem.

| Dia | Mateus (back e infra) | Pedro (front) |
|---|---|---|
| 01/10 | ADR-001. Monorepo (`apps/api`, `apps/web`, `packages/campos`, `packages/contratos`). CI. Homologação e **Postgres de dev no Coolify**. **GGVP-108** identificadores (`kit/campos` vira `packages/campos`). | **GGVP-78** Central por função, com login e perfil mockados. **GGVP-86** navegar pelo caso. |
| 02/10 | **GGVP-117** login e sessão. **GGVP-96** perfis (API e matriz). **GGVP-109** portões no servidor. | **GGVP-78** ligada no login e nos perfis reais. **GGVP-32** preparar a conversa. **GGVP-85**, **GGVP-89** (pequenas). |
| 03/10 | **GGVP-105** motor de fluxo, só as fases do D1. | **GGVP-16** balcão. **GGVP-24** ficha, já com `campos`. **GGVP-21** agendamento. |
| 06 a 08/10 | Histórias inteiras (tela e API), uma por vez: **81, 91, 65, 20, 33, 18**. | Histórias inteiras (tela e API), uma por vez: **17**, depois o que sobrar da fila do Mateus. |

Cada história tem um dono só, e o dono faz tela e API dela. O outro não entra na branch. O que se compartilha é o contrato em `packages/contratos` e a biblioteca `campos`.
| 09/10 | UAT com o Lucas desde a manhã. Correções. `/mapech-delivery-os:mapech-delivery`: rollback, runbook, quem chamar. | Idem. |

## Ordem de dependência (o `/agora` lê daqui)

1. Fundação antes de qualquer tela com dado real: 108 → 117 → 96 → 109 → 105.
2. Esqueleto antes das telas de ação: 78 e 86 antes de 16, 24, 21, 17, 81, 91, 65, 20, 33, 18.
3. Dentro do D1, a ordem do fluxo: 16 → 24 → 21 → 17 → 81 → 91 → 65 → 20 → 33 → 18.
4. O dono da história escreve o contrato Zod na `design.md` da change e o commita em `packages/contratos` antes da tela e da API. Tela pode nascer com mock e ligar depois.
5. 32, 85, 89, 110 não dependem de nada além de 108 e 117. Servem para preencher buraco.
6. Dúvidas do PO estão nos tickets GGVP-112 a GGVP-116 (filtro `labels = duvida-po`). História cuja dúvida está lá não começa antes da resposta.

## Sessões do Claude Code

- **Uma sessão por história, uma história por branch.** Nunca duas sessões na mesma pasta.
- **Mateus: uma sessão por vez.** Termina, `/ok`, próxima.
- **Pedro: no máximo duas**, em árvores separadas (`git worktree add ../prev-GGVP-24 feat/GGVP-24-...`). Uma codando, outra no `propose` da próxima.
- Começo do dia, dentro do `claude`: `/agora`. Ele diz a próxima e o comando para abrir a branch.
- Terminou uma história: `/ok`, depois `/agora` de novo. Acabou a sua fila: o `/agora` oferece a próxima da ordem sem dono e, com o seu "sim", atribui a você no Jira. Ninguém atribui à mão nem pega história de outro.
- Fim do dia: `/ok` se terminou; se não, `/ecc:save-session` e commit do que está feito com a chave.

## Rodar local, sem Docker

- Só Node. `pnpm dev` sobe `apps/api` e `apps/web`.
- Banco de dev no Coolify, na VPS: um banco por pessoa (`prev_pedro`, `prev_mateus`), URL no `.env` local. Nada de Postgres nem Docker na máquina.
- Homologação é outro banco, no mesmo Postgres. Migrações rodam no deploy.
- Playwright usa o Chromium que ele mesmo instala (`pnpm exec playwright install chromium`).

Regra dos dois em paralelo: o contrato (schema Zod em `packages/contratos`) nasce na `design.md` da change. Pedro constrói a tela sobre o schema, Mateus o servidor sobre o mesmo schema. Os dois não editam o mesmo arquivo. Conflito de merge é sinal de que alguém saiu da história.

## Antes do dia 1, fora do código

| Quem | O quê | Tempo |
|---|---|---|
| Fernando | Criar no Jira os estados do fluxo: `Backlog → Pronta → Em desenvolvimento → Em revisão → Em homologação → Aceita`. Hoje só existe o padrão ("Tarefas pendentes", "Em andamento", "Concluído") e o Action `jira.yml` não consegue mover para "Em revisão" nem "Em homologação". | 15 min |
| Pedro | Mandar as 96 histórias revisadas para o Jira e para `docs/requisitos/candidatas/` por PR. O `/historia` lê do repositório. | depois da validação |
| Mateus | Segredo `CLAUDE_CODE_OAUTH_TOKEN` no repositório (revisão automática do PR): na máquina, `claude setup-token` gera o token; guardar com `gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo femezher/GGV-Previdenciario`. `JIRA_EMAIL` e `JIRA_API_TOKEN` já existem. Coolify: aplicação de homologação ligada ao GitHub. | 30 min |
| Lucas | Responder as travas **[decidir]** das histórias do D1 antes de elas entrarem. Lista em `backlog/06-revisao-jira/00-leia-primeiro.md`. | 1 h |

## Regras de fila

- Uma change ativa por dev. Terminou e arquivou, pega a próxima.
- Dentro da fatia, Highest primeiro. Fora da fatia, nada até 09/10.
- História com **[decidir]** aberto no critério não começa.
- Bloqueio: comentário no cartão do Jira e aviso ao Fernando. Não espera a próxima reunião.
