# Entrega de 09/10/2026: por épico, com dono

Compromisso com o escritório: **as 100 histórias funcionando em homologação em 09/10**. Decisão de 01/10 (Pedro e Fernando): trabalhar por épico, não por história solta. Valida um épico, desenvolve esse épico inteiro com um dono, passa ao próximo. Ritmo necessário: **14 histórias por dia entre os dois devs**. O `/epico` mostra o ritmo toda vez.

## Esta semana

| Quando | O quê |
|---|---|
| 02/10 (quinta) | **Prazo da revisão das histórias**, para todos, na divisão do Fernando (abaixo). Primeiro os épicos que começam primeiro: Recepção e entrevista (Pedro revisa) e Fundação técnica (Fernando revisa). Revisou e está bom: tira o nome do cartão e arrasta para "Refinada". Reunião do time no fim do dia: fecha a arquitetura (ADR-001) e confirma o segundo e o terceiro épico de cada um. |
| 03/10 (sexta) | Lucas valida o BPMN com o escritório, começando pela Recepção e entrevista. Devs já codando a fundação e o primeiro épico. |
| 06 a 08/10 | Épicos na ordem abaixo. |
| 09/10 | UAT com o Lucas desde a manhã. Correções. `/mapech-delivery-os:mapech-delivery`: rollback, runbook, quem chamar. |

## Quem revisa cada épico (divisão do Fernando, 30/09)

Nome no cartão = quem revisa. Revisou: tira o nome, "Refinada". Faltou ajustar: deixa o nome, comenta, não arrasta.

| Revisor | Épicos |
|---|---|
| Lucas | Garantia e governança · Perícia |
| Pedro | Recepção e entrevista · Abertura e documentação |
| Mateus | Judicialização e vigília · Via administrativa no INSS · Jurimetria |
| Fernando | Desfecho e financeiro · Relacionamento com o cliente · IA jurídica · Fundação técnica · Experiência por perfil e chat |

## Quem implementa cada épico, e em que ordem

Um épico por pessoa por vez. O dono faz as histórias inteiras, tela e servidor, e abre um PR por épico. O outro dev revisa.

| Ordem | Mateus (servidor, banco, infra) | Pedro (telas) |
|---|---|---|
| 1 | **Fundação técnica** (GGVP-2): stack, monorepo, banco, ambiente, identificadores, login e perfis, motor de fluxo. | **Recepção e entrevista** (GGVP-6), começando pela base das telas (tokens do Figma, tema, Central do Atendimento), que já existe em rascunho na branch `feat/GGVP-120-base-do-front`. Sobre dados de exemplo até a fundação subir. |
| 2 | **Via administrativa no INSS** (GGVP-8) | **Experiência por perfil e chat** (GGVP-5): tela inicial das outras funções, navegar pelo caso, chat só de consulta |
| 3 | **Garantia e governança** (GGVP-13), depois da validação do Lucas na sexta | **Abertura e documentação** (GGVP-7) |
| 4 | **Judicialização e vigília** (GGVP-9) | **Perícia** (GGVP-10) |
| 5 | **Desfecho e financeiro** (GGVP-11) | **Relacionamento com o cliente** (GGVP-12) |
| 6 | **IA jurídica** (GGVP-14) · **Jurimetria** (GGVP-15) | ajuda onde faltar |

Não entra até 09/10: Google Drive (GGVP-107), assinatura ZapSign real, 2FA, chat com ação (só consulta).

Dependência que não se negocia: a fundação sobe primeiro. Tela que precisa de servidor nasce com dados de exemplo e liga depois. O contrato (schema Zod em `packages/contratos`) é o que os dois compartilham: nasce na `design.md` da change, e cada um constrói o seu lado sobre ele.

## Ordem dentro dos épicos (o `/epico` lê daqui)

Ordem do fluxo do BPMN. História fora da lista: ordem do Jira.

- **Fundação técnica (GGVP-2):** 118 → 119 → 108 → 117 → 96 → 105. (107 fica de fora.)
- **Recepção e entrevista (GGVP-6):** 120 → 16 → 24 → 21 → 32 → 28 → 36 → 40 → 46 → 43 → 51 → 57 → 17 → 60.
- **Experiência por perfil e chat (GGVP-5):** 78 → 86 → 82.
- **Abertura e documentação (GGVP-7):** 65 → 69 → 72 → 77 → 85 → 89 → 81 → 91 → 18 → 97 → 101.
- **Via administrativa no INSS (GGVP-8):** 23 → 27 → 31 → 35 → 39 → 44 → 48.
- **Garantia e governança (GGVP-13):** 109 → 25 → 42 → 47 → 50 → 20 → 33 → 93 → 95 → 94 → 68 → 99 → 103 → 104.
- **Perícia (GGVP-10):** 49 → 53 → 56 → 61 → 62 → 66 → 70 → 73.
- **Judicialização e vigília (GGVP-9):** 26 → 30 → 34 → 37 → 74 → 52 → 54 → 58 → 63 → 67 → 71 → 79 → 83 → 87.
- **Desfecho e financeiro (GGVP-11):** 90 → 92 → 98 → 100 → 19 → 22.
- **Relacionamento com o cliente (GGVP-12):** 76 → 80 → 84 → 88 → 102 → 111.
- **IA jurídica (GGVP-14):** 106 → 110 → 38 → 41 → 45.
- **Jurimetria (GGVP-15):** 55 → 59 → 64 → 75.

## Sessões do Claude Code

- Uma sessão por pessoa, no épico dela, na raiz do clone. Nunca duas sessões na mesma pasta.
- Segunda sessão só para revisar o PR do outro, em outra árvore (`git worktree add ../prev-revisao <branch>`).
- Começo do dia, dentro do `claude`: `/epico <nome do épico>`. Fim do dia: "ok" se terminou a história; se não, o Claude guarda com `wip` e `/ecc:save-session`.

## Rodar local, sem Docker

- Só Node. `pnpm dev` sobe `apps/api` e `apps/web`.
- Banco de dev no Coolify, na VPS: um banco por pessoa (`prev_pedro`, `prev_mateus`), URL no `.env` local. Nada de Postgres nem Docker na máquina.
- Homologação é outro banco, no mesmo Postgres. Migrações rodam no deploy.
- Playwright usa o Chromium que ele mesmo instala (`pnpm exec playwright install chromium`).

## Fora do código

| Quem | O quê |
|---|---|
| Todos | Revisar os cartões dos seus épicos até 02/10. |
| Fernando | Reunião de 02/10. Colunas do Jira já estão certas (feito em 30/09). |
| Mateus | Coolify: aplicação de homologação ligada ao GitHub e Postgres de dev com um banco por pessoa. Os segredos do repositório (`JIRA_EMAIL`, `JIRA_API_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`) existem e funcionam. Para trocar um: no PowerShell, `$t = (Read-Host "valor").Trim() -replace '\s',''` e `gh secret set NOME --repo femezher/GGV-Previdenciario --body $t`. Nunca pelo prompt "Paste your secret". |
| Lucas | Validar o BPMN com o escritório em 03/10. Dúvidas novas: comentar no cartão. |

## Regras de fila

- Um épico por dev. Dentro dele, uma história por vez.
- Só história em "Refinada" vira código. Com dúvida aberta: "Travada", pergunta a quem revisa.
- Bloqueio: comentário no cartão e aviso ao Fernando. Não espera a próxima reunião.
