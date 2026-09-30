# Entrega de 09/10/2026: o que entra, em que ordem, quem faz

Dois devs, sete dias úteis a partir de 01/10. As 96 histórias não cabem. Cabe a fatia abaixo, funcionando em homologação, testada pelo Lucas. O resto vem depois, pelo mesmo método.

## O que está pronto no dia 09/10

Uma pessoa de cada perfil entra no portal, vê "O que é meu hoje", e um caso do D1 atravessa da recepção até a liberação ao Jurídico com o parecer médico. É o item 1 e o item 2 de `docs/requisitos/fatiamento.md`.

| Bloco | Histórias | Observação |
|---|---|---|
| Entrar no portal | login mínimo (senha, sessão, perfil), **GGVP-96** perfis e permissões | Login não tem história em lugar nenhum. É a primeira a escrever. Versão mínima, sem 2FA. |
| Fundação | **GGVP-108** identificadores (CPF, NB, protocolo, CNJ), **GGVP-105** motor de fluxo (só o D1), **GGVP-109** portões validados no servidor | Sem isso nenhuma tela do D1 sobe. As três estão em `backlog/06-revisao-jira/historias/` até entrarem no Jira. |
| Esqueleto por perfil | **GGVP-78** Central por função, **GGVP-86** navegar pelo caso | Sobre API mockada com o contrato Zod, desde o dia 1. |
| D1 de ponta a ponta | as histórias com rótulo `bpmn-d1-*`, mais **GGVP-20**, **33**, **93** e **95** (parecer médico e roteiro de laudos) | Lista final é do Pedro com o Lucas. Começa pela recepção (GGVP-16, 17, 21, 24) e termina na liberação (GGVP-18). |

Não entra até 09/10: D2, D3, D3a, D3b, DP, D4, D5, chat com ação (só consulta, se sobrar tempo), jurimetria, Google Drive, assinatura ZapSign, 2FA.

## Ordem e quem

| Quando | Mateus (back e infra) | Pedro (front) |
|---|---|---|
| 01 e 02/10 | ADR-001 fechado. Repositório de código criado (monorepo: `apps/api`, `apps/web`, `packages/campos`, `packages/contratos`). CI: typecheck, lint, testes, segredos. Deploy automático em homologação no Coolify a cada merge na `main`. `kit/campos` vira `packages/campos` (GGVP-108). | GGVP-78 e GGVP-86 com dados mockados sobre o contrato de `packages/contratos`. Login mínimo (tela). |
| 03/10 | GGVP-96 perfis, login (API), GGVP-105 motor só com o D1, GGVP-109 portões. | Ficha de atendimento e recepção (GGVP-24, 16, 21), já com `campos`. |
| 06 a 08/10 | D1: uma história por vez, contrato antes do código. Cada um pega a próxima da fila; nunca a mesma. | Idem. |
| 09/10 | UAT com o Lucas em homologação desde a manhã. Correções. Checklist de entrega (`/mapech-delivery-os:mapech-delivery`): rollback, runbook, quem chamar. | Idem. |

Regra dos dois em paralelo: o contrato (schema Zod em `packages/contratos`) nasce na `design.md` da change. Pedro constrói a tela sobre o schema, Mateus o servidor sobre o mesmo schema. Os dois não editam o mesmo arquivo. Conflito de merge é sinal de que alguém saiu da história.

## Antes do dia 1, fora do código

| Quem | O quê | Tempo |
|---|---|---|
| Fernando | Criar no Jira os estados do fluxo: `Backlog → Pronta → Em desenvolvimento → Em revisão → Em homologação → Aceita`. Hoje só existe o padrão ("Tarefas pendentes", "Em andamento", "Concluído") e o Action `jira.yml` não consegue mover para "Em revisão" nem "Em homologação". | 15 min |
| Pedro | Mandar as 96 histórias revisadas para o Jira e para `docs/requisitos/candidatas/` por PR. O `/historia` lê do repositório. | depois da validação |
| Mateus | Segredos do repositório: `ANTHROPIC_API_KEY` (revisão automática do PR). `JIRA_EMAIL` e `JIRA_API_TOKEN` já existem. Coolify: aplicação de homologação ligada ao GitHub. | 30 min |
| Lucas | Responder as travas **[decidir]** das histórias do D1 antes de elas entrarem. Lista em `backlog/06-revisao-jira/00-leia-primeiro.md`. | 1 h |

## Regras de fila

- Uma change ativa por dev. Terminou e arquivou, pega a próxima.
- Dentro da fatia, Highest primeiro. Fora da fatia, nada até 09/10.
- História com **[decidir]** aberto no critério não começa.
- Bloqueio: comentário no cartão do Jira e aviso ao Fernando. Não espera a próxima reunião.
