# Como a equipe trabalha

> Fonte versionada: [`docs/scrum/README.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/scrum/README.md) no repositório. Edite lá (por PR), não na wiki.

# Scrum na MAPECH

Referência: Scrum Guide 2020. Aplicado sem inflar: equipe de quatro, sprint de uma semana de segunda a sexta.
Este arquivo é o resumo. O guia completo, parte por parte, está em `guia-scrum-mapech.md`.

## Papéis
| Papel | Quem | Responsável por | Não faz |
|---|---|---|---|
| Product Owner | Lucas | Backlog do produto, prioridade, meta do produto, aceite na review, fala pelo cliente | Escrever código do produto na sprint; distribuir tarefa |
| Scrum Master | Fernando | Eventos, impedimentos, DoD, meio de campo PO e devs, métricas | Decidir o que entra na sprint; gerenciar pessoas |
| Desenvolvedores | Pedro, Mateus | Como construir, estimativa, qualidade, revisão cruzada, incremento | Mudar arquitetura sem ADR; mergear o próprio PR |

## Eventos
| Evento | Quando | Duração | Saída |
|---|---|---|---|
| Sprint | Segunda a sexta | 1 semana | Incremento em homologação |
| Sprint Planning | Segunda, 9h | 1h | Meta da sprint e Sprint Backlog |
| Daily | Todo dia, 9h, no Meet | 15 min | Ontem, hoje, impedimento |
| Sprint Review | Sexta, 15h, com o escritório | 45 min | Histórias aceitas ou recusadas pelo PO |
| Retrospectiva | Sexta, após a review | 30 min | Uma melhoria para a próxima sprint |
| Refinamento | Quarta, 14h | 45 min | Histórias "Prontas" para a próxima planning |

## Artefatos
- **Product Backlog** no Jira, ordenado pelo PO. Meta do produto: escritório operando no portal no dia 30.
- **Sprint Backlog**: as histórias da sprint + a meta da sprint. Não muda depois da planning, salvo pelo PO com troca de igual tamanho.
- **Incremento**: o que está em homologação e cumpre a DoD. Só o que cumpre a DoD conta.

## Capacidade e plano de releases (proposta, a confirmar na abertura de 28/09)
- O Trabalhista está pausado até o Prev terminar. Pedro e Mateus dedicam as 8 horas por dia ao Prev.
- Descontando eventos, revisão de PR e correção, a conta realista de trabalho em história é cerca de 30 horas por dev por semana. A planning seleciona por essa conta.
- **Sprint 0 (28/09 a 02/10)**: BPMN do Miro validado e com passos numerados; histórias candidatas refinadas; Figma das telas iniciais por perfil, em paralelo. Plano em `sprint-0.md`.
- **Sprint 1 (05 a 09/10)**: histórias do topo Prontas pela DoR; base técnica herdada do Trabalhista (ADR-001); homologação no ar.
- **Desenvolvimento a partir da Sprint 2 (12/10)**, sprints de uma semana.
- **Release 1**: D1 de ponta a ponta com a governança médica, e a conferência do sênior do D2. Data a fechar na abertura.

## Compromissos
- Definition of Ready: `definition-of-ready.md`. Definition of Done: `definition-of-done.md`.
- Limite de WIP: cada dev tem no máximo duas histórias em andamento.
- Métricas que o SM acompanha: histórias aceitas por sprint, PRs com revisão, tempo de PR aberto até merge, impedimentos abertos.

## Fluxo no Jira (projeto GGVP)
`Backlog → Pronta → Em desenvolvimento → Em revisão → Em homologação → Aceita` (ou `Recusada`, volta a Pronta).
Tipos: Épico (uma raia ou processo do BPMN), História, Tarefa técnica, Bug, Spike (investigação com prazo).

---
Documentos completos no repositório: [guia do Scrum](https://github.com/femezher/GGV-Prev-/blob/main/docs/scrum/guia-scrum-mapech.md) · [Definition of Ready](https://github.com/femezher/GGV-Prev-/blob/main/docs/scrum/definition-of-ready.md) · [Definition of Done](https://github.com/femezher/GGV-Prev-/blob/main/docs/scrum/definition-of-done.md) · [CONTRIBUTING](https://github.com/femezher/GGV-Prev-/blob/main/CONTRIBUTING.md).
