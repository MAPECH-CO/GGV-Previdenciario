# Entrega de 09/10/2026: o que entra, em que ordem, quem faz

Compromisso com o escritório: **as 96 histórias funcionando em homologação em 09/10**. Dois devs, sete dias úteis a partir de 01/10. Ritmo necessário: **14 histórias por dia entre os dois**, 7 cada. O `/agora` mostra o ritmo todo dia; se ele subir, o time avisa o Lucas no mesmo dia, não no dia 09.

## Primeira leva

A tabela abaixo é a primeira leva, já atribuída no Jira. Quando a fila de alguém esvazia, `/agora fatia N` puxa as próximas da "Ordem completa" e atribui. Nada fica sem dono por decisão; fica sem dono só até chegar a vez.

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

## Ordem completa (o `/agora` lê daqui)

Blocos, na ordem. Dentro de cada bloco, a ordem do fluxo do BPMN. O `/agora` só avança de bloco quando o anterior está sem história livre.

1. **Fundação:** 108 → 117 → 96 → 109 → 105 → 106 → 110 → 104.
2. **Esqueleto:** 78 → 86 → 82 (só consulta) → 99.
3. **D1:** 16 → 24 → 21 → 32 → 28 → 36 → 40 → 46 → 43 → 51 → 57 → 42 → 65 → 69 → 72 → 77 → 85 → 89 → 17 → 81 → 95 → 91 → 47 → 50 → 20 → 25 → 29 → 93 → 33 → 18 → 60 → 97 → 101 → 94 → 103 → 102 → 111.
4. **D2 e DP:** 23 → 27 → 31 → 49 → 53 → 56 → 61 → 62 → 66 → 70 → 73 → 38 → 35 → 39 → 44 → 98 → 48.
5. **D4 e vigília:** 26 → 30 → 34 → 37 → 74.
6. **D3, D3a, D3b:** 52 → 54 → 58 → 45 → 63 → 67 → 71 → 79 → 68 → 83 → 87 → 90 → 92 → 100 → 19 → 22.
7. **D5:** 76 → 80 → 84 → 88.
8. **Jurimetria, acervo, painéis:** 41 → 55 → 59 → 64 → 75 → 107.

Dependências que não se negociam: fundação antes de qualquer tela com dado real; 78 e 86 antes das telas de ação; dentro do D1, a ordem do fluxo.
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
| Fernando | Feito em 30/09. Colunas do quadro: `Tarefas pendentes → Refinada → Em andamento → Em análise → Em homologação → Aceita → Concluído`. "Aceita" é o Lucas aprovando em homologação. "Concluído" fica para produção: ninguém arrasta antes de 09/10. O Action `jira.yml` move para Em andamento, Em análise e Em homologação sozinho. | feito |
| Pedro | Mandar as 96 histórias revisadas para o Jira e para `docs/requisitos/candidatas/` por PR. O `/historia` lê do repositório. | depois da validação |
| Mateus | Coolify: aplicação de homologação ligada ao GitHub e Postgres de dev com um banco por pessoa. Os segredos do repositório (`JIRA_EMAIL`, `JIRA_API_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`) já existem e funcionam. Para trocar um: no PowerShell, `$t = (Read-Host "valor").Trim() -replace '\s',''` e depois `gh secret set NOME --repo femezher/GGV-Previdenciario --body $t`. Nunca pelo prompt "Paste your secret" nem colando direto do console: entra espaço e o valor fica inválido. | 30 min |
| Lucas | Responder as travas **[decidir]** das histórias do D1 antes de elas entrarem. Lista em `backlog/06-revisao-jira/00-leia-primeiro.md`. | 1 h |

## Regras de fila

- Uma change ativa por dev. Terminou e arquivou, pega a próxima.
- Dentro da fatia, Highest primeiro. Fora da fatia, nada até 09/10.
- História com **[decidir]** aberto no critério não começa.
- Bloqueio: comentário no cartão do Jira e aviso ao Fernando. Não espera a próxima reunião.
