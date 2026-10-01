# GGV Previdenciário: contexto para agentes e para a equipe

Idioma do projeto: português do Brasil, em código, commits, documentação e interface.

## O que é
Portal operacional para o escritório previdenciário da GGV, cliente da MAPECH. Refeito a partir do
BPMN do Miro (board `uXjVHjbveV4=`, frames "revisão BPMN"). Segue a metodologia do repositório
`femezher/mapech-trabalhista`, pausado até o Prev terminar.

## Equipe e papéis
- Lucas: Product Owner. Dono do backlog e da prioridade. Fala pelo cliente. Aceita ou recusa na review.
- Fernando: Scrum Master. Facilita os eventos, remove impedimentos, guarda a Definition of Done.
- Pedro: desenvolvedor, referência em front-end.
- Mateus: desenvolvedor, referência em back-end e infra.

## Como o trabalho flui
1. Todo trabalho nasce como história no Jira (projeto `GGVP`), ligada a um passo do BPMN (`docs/bpmn/`).
2. Candidatas vivem em `docs/requisitos/candidatas/` com o rótulo `a-validar-bpmn` até o passo ser confirmado.
3. A história só vira código quando está em "Refinada" no Jira: revisada, sem dúvida aberta, cumprindo `docs/scrum/definition-of-ready.md`. Não há sprints: um épico por dev, as histórias dele uma a uma, entrega em 09/10/2026 (`kit/entrega-09-10.md`).
4. Uma branch e um PR por épico: `feat/GGVP-6-recepcao-e-entrevista`. Cada commit cita a história (`GGVP-24`). O outro dev revisa o PR.
5. "Feita" só quando cumpre `docs/scrum/definition-of-done.md`.

## Regras de produto que não se negociam
- Governança antes de velocidade: os portões de `docs/requisitos/portoes-governanca.md` (G1 a G22) valem
  em toda tela e também no chat. Nenhuma interface contorna um portão.
- A IA sugere; uma pessoa confere e decide. A IA nunca aprova parecer, despacho, petição nem exigência.
- Regra numérica (prazo, 24 meses, 15 dias, 60 dias) é código com teste, nunca resposta de modelo.
- Orientação ao cliente ou ao médico nunca sugere diagnóstico, CID, conclusão, nem esconder a situação real.
- Senha do gov.br só no cofre. Dado de saúde é sensível: acesso por perfil, nunca em log.

## Regras para agentes de IA (Claude, Codex ou outro)
- A história do Jira é o prompt. Trabalhe no escopo dela. Se precisar sair, pare e diga.
- Nunca leia `.env*`, segredos, tokens ou credenciais. Nunca os escreva em arquivo versionado.
- Nunca toque em produção nem em serviço externo sem pedido explícito.
- Nunca simule sucesso: se o teste falhou, diga que falhou e mostre a saída.
- Um agente por épico: uma branch, uma pasta e um PR. Dentro dele, uma história por vez.
- Teste acompanha a história. Sem teste, sem PR. Documentação vive em `docs/`.

## Como o Claude Code trabalha aqui (kit em `kit/LEIA-ME.md`)
1. **Um comando: `/epico`.** O dev abre o Claude na raiz do clone e digita `/epico <nome do épico>`. Branch, change
   do OpenSpec, spec, tarefas, testes, commit, PR e cartão do Jira: o comando faz tudo (`.claude/commands/epico.md`).
   Pedido de código fora do `/epico`: responda "digite `/epico <nome do épico>`" e não escreva código.
2. **Só história em "Refinada" vira código.** Cartão em "Refinada" e sem responsável é a permissão. História em
   "Tarefas pendentes", ou com dúvida aberta ([decidir]), não começa: fica "Travada", com o nome de quem revisa.
3. **Uma história por vez, dentro do épico.** Spec com um requisito por critério, tarefas de até 2 horas, teste junto.
   Menor mudança que cumpre o critério (`/ponytail` é o padrão). Sem abstração para uso futuro, sem refatorar o que
   não pediu, sem dependência nova sem dizer por quê.
4. **Campos de formulário usam a biblioteca `campos`** (`kit/campos`, depois `packages/campos`): CPF, CEP,
   data, número, telefone, NB, CNJ, nome, e-mail. Nunca validação solta na tela. O servidor valida de novo.
5. **Falar simples com o dev.** Na conversa, nenhum id de tela do Figma, de card do Miro, código de passo do BPMN ou
   nome de arquivo, a não ser que ele peça. Chave GGVP-n só em branch, commit, PR e Jira. Explicação de história em
   até 5 linhas.
6. **Ao terminar a história, e depois de cada ajuste:** rode typecheck, lint, testes e Playwright quando há tela, cole
   a saída e pergunte **"Agora ok?"**. Nunca conclua sozinho. Com o "ok": commit com a chave da história, push,
   cartão para "Em análise", próxima história. `openspec archive` só depois do merge do PR do épico e do "Aceita" do Lucas.
7. **Sem subagente que ninguém pediu.** Proibidos neste repositório: `/ecc:orch-*`, `/ecc:multi-*`,
   `/ecc:team-*`, `/ecc:gan-*`, `/ecc:santa-loop`, `/ecc:loop-start`, `/agenthub:*`, `/autoresearch-agent:*`.
   Permitidos: `/epico`, `/ecc:code-review`, `/ecc:security-scan`, `/ecc:save-session`, `/ecc:resume-session`,
   `/ponytail`. Os `/opsx:*` só por dentro do `/epico`.

## Stack
A decidir no ADR-001, no primeiro dia de código. Proposta: herdar o ADR-001 do Trabalhista (TypeScript de ponta a ponta:
Node 22, Fastify + Zod, Drizzle + PostgreSQL, pg-boss, React 19 + Vite, Vitest e Playwright) e o
ADR-013 (base de conhecimento em markdown curado, busca híbrida no PostgreSQL). Ver `docs/decisoes/`.

## Onde está cada coisa
- `docs/bpmn/`: processos, links para o Miro e códigos dos passos.
- `docs/requisitos/`: candidatas, perfis, portões, roteiro de laudos, jurimetria, exigências, dúvidas.
- `docs/scrum/`: papéis, eventos, DoR, DoD, plano da Sprint 0.
- `docs/decisoes/`: ADRs. Uma decisão, um arquivo, numerado.
- `docs/ferramentas.md`: Jira, GitHub, Miro, Drive, Claude Teams, Meet e como se ligam.
- `docs/claude-code.md`: como cada dev roda o Claude Code no clone e liga o conector do Jira.
- `kit/`: o método de desenvolvimento com o Claude Code: instalar, abrir história, `campos`, entrega de 09/10.
- `openspec/`: specs do sistema (`specs/`) e changes em andamento (`changes/`), uma por história.
- `CONTRIBUTING.md`: branches, commits, PR, revisão.
