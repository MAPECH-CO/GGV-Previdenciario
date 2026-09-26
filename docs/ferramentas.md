# Ferramentas e como se ligam

| Ferramenta | Onde | Para quê |
|---|---|---|
| Jira | https://mapech.atlassian.net, projeto `GGVP` | Backlog, sprints, quadro. Chave `GGVP`. Fonte da verdade do que fazer e em que ordem |
| GitHub | https://github.com/femezher/GGV-Prev- | Código e documentação. Fonte da verdade do que foi feito |
| Miro | board `uXjVHjbveV4=` | O BPMN do escritório. Vale o frame "revisão BPMN" da direita. Índice por diagrama em `docs/bpmn/README.md` |
| Google Drive | pasta `Mapech/ggv-previdenciario` no Drive da MAPECH | Espelho de leitura do repositório, atualizado a cada commit. Para NotebookLM, celular e quem não usa git |
| Claude Teams | projeto "GGV Previdenciário" | Contexto compartilhado: usa o `CLAUDE.md` deste repositório como instrução e a pasta do Drive como fonte |
| Claude Code | no clone local de cada dev | Trabalha por história e lê o `CLAUDE.md` deste repositório direto do disco. Instalação e conector do Jira em `docs/claude-code.md` |
| Google Meet | sala fixa do projeto | Planning, daily, refinamento, review e retrospectiva. Nenhuma reunião do projeto por WhatsApp |
| Homologação | URL definida na Sprint 0 | Onde o PO aceita ou recusa cada história |

## Como uma história atravessa as ferramentas
1. Nasce no **Jira** (`GGVP`) como História, ligada a um passo do BPMN pelo rótulo `bpmn-<diagrama>-<n>` (por exemplo `bpmn-d1-05`), e chega a "Pronta" no refinamento.
2. Enquanto o passo do Miro não é confirmado, a história leva o rótulo `a-validar-bpmn` e a cópia versionada fica em `docs/requisitos/candidatas/`.
3. O dev puxa a história na planning e cria a branch `feat/GGVP-123-descricao` no **GitHub**.
4. **Claude Code** trabalha dentro da história, com o `CLAUDE.md` do repositório como contexto. Como esse arquivo é versionado, o `git pull` é a sincronização e os quatro usam a mesma regra.
5. O PR com `GGVP-123` no título é revisado pelo outro dev. Com o GitHub for Jira instalado, o PR aparece no item do Jira sozinho.
6. Merge em `main` implanta em **homologação**. O PO testa e marca "Aceita" no **Jira**.
7. Cada commit em `main` atualiza o espelho no **Drive**, que o **Claude Teams** lê.

## Automação entre GitHub e Jira
Feita pela Action `.github/workflows/jira.yml`, versionada aqui, mais o aplicativo GitHub for Jira instalado no site.
- PR sem chave `GGVP-n` no título é reprovado no CI.
- Branch criada com a chave: o item vai para Em desenvolvimento.
- PR aberto: Em revisão. PR mesclado em `main`: Em homologação.
- Item já Aceito nunca volta. Sem chave, nada acontece.
- Segredos do repositório: `JIRA_EMAIL` e `JIRA_API_TOKEN`. Para trocar a chave, gere outra em id.atlassian.com e atualize o segredo.

## Onde vai cada conversa
- **Evento marcado** (planning, daily, refinamento, review, retro): na sala fixa do Meet, no horário.
- **Recado sobre uma história**: comentário no cartão do Jira, onde fica junto do trabalho.
- **Discussão sobre código**: comentário no pull request.
- **Decisão de arquitetura ou de projeto**: ADR em `docs/decisoes/`. Decisão combinada só em conversa não existe.
- **Correção do processo do escritório**: primeiro no Miro, depois em `docs/bpmn/` por PR, citando o frame.
- **Impedimento**: dito na daily. Fora da daily, comentário no cartão e aviso ao Scrum Master.

## Rótulos no Jira
- Dono: `lucas`, `pedro`, `mateus`, `fernando` (até o campo Responsável passar a ser usado).
- Passo do BPMN: `bpmn-<diagrama>-<n>`, por exemplo `bpmn-d1-05`, `bpmn-dp-07`.
- Validação: `a-validar-bpmn` enquanto o passo do Miro não é confirmado com o escritório.
- Chave provisória de origem: `prev-nn` (rastreia a numeração usada antes de o cartão existir no Jira).
- Natureza: `spike` (investigação com prazo de até dois dias), `divida-tecnica` (melhoria interna que o usuário não vê).

## Fluxo do Jira
`Backlog → Pronta → Em desenvolvimento → Em revisão → Em homologação → Aceita`. Recusada na review volta para Pronta.
