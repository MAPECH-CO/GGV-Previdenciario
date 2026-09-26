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
3. A história só entra na sprint se cumpre `docs/scrum/definition-of-ready.md`.
4. Uma branch por história: `feat/GGVP-123-descricao-curta`. Uma história, um PR, revisado pelo outro dev.
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
- Um agente por história: uma branch, uma árvore de trabalho e um PR.
- Teste acompanha a história. Sem teste, sem PR. Documentação vive em `docs/`.

## Stack
A decidir na Sprint 0. Proposta: herdar o ADR-001 do Trabalhista (TypeScript de ponta a ponta:
Node 22, Fastify + Zod, Drizzle + PostgreSQL, pg-boss, React 19 + Vite, Vitest e Playwright) e o
ADR-013 (base de conhecimento em markdown curado, busca híbrida no PostgreSQL). Ver `docs/decisoes/`.

## Onde está cada coisa
- `docs/bpmn/`: processos, links para o Miro e códigos dos passos.
- `docs/requisitos/`: candidatas, perfis, portões, roteiro de laudos, jurimetria, exigências, dúvidas.
- `docs/scrum/`: papéis, eventos, DoR, DoD, plano da Sprint 0.
- `docs/decisoes/`: ADRs. Uma decisão, um arquivo, numerado.
- `docs/ferramentas.md`: Jira, GitHub, Miro, Drive, Claude Teams, Meet e como se ligam.
- `docs/claude-code.md`: como cada dev roda o Claude Code no clone e liga o conector do Jira.
- `CONTRIBUTING.md`: branches, commits, PR, revisão.
