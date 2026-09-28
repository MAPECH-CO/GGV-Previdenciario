# Planejamento

> Fontes versionadas: [`docs/scrum/README.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/scrum/README.md) e [`docs/scrum/sprint-0.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/scrum/sprint-0.md). Edite lá (por PR), não na wiki.

## Onde estamos (28/09/2026)
| Frente | Estado | Próximo passo |
|---|---|---|
| BPMN | Revisado no Miro e transcrito em `docs/bpmn/` (D1, D2, D3, D3a, D3b, D4, D5, DP) com códigos propostos | Gravar os códigos nos cartões do Miro; desenhar D1.21M, DP.00 e D4.02N |
| Backlog | 15 épicos e 89 histórias no Jira `GGVP`, todas `a-validar-bpmn` | Refinamento de 30/09: responder `duvidas-abertas.md`, levar as do topo a Pronta |
| Figma | Protótipo desktop navegável: uma Central por função, 46 telas de ação, página completa do processo com barra de ações e popups por tarefa, página do cliente, novo cliente → reunião com transcrição, suporte em todas as telas, tema escuro e fonte maior | Review com o escritório na sexta 02/10; depois Sênior/Estagiário/Financeiro no mesmo nível, e o mobile |
| Base técnica | Proposta: herdar ADR-001 e ADR-013 do Trabalhista; ADR-015 (Chatwoot) proposto | Decidir na Sprint 0; homologação no ar na Sprint 1 |
| Ferramentas | Jira, GitHub (`GGV-Prev-`), Miro, Drive, Claude Teams/Code ligados; Action GitHub↔Jira | Renomear o repositório para `mapech-previdenciario`; publicar esta wiki |

## Capacidade e plano de releases (proposta, a confirmar na abertura de 28/09)
- O Trabalhista está pausado até o Prev terminar. Pedro e Mateus dedicam as 8 horas por dia ao Prev.
- Descontando eventos, revisão de PR e correção, a conta realista de trabalho em história é cerca de 30 horas por dev por semana. A planning seleciona por essa conta.
- **Sprint 0 (28/09 a 02/10)**: BPMN do Miro validado e com passos numerados; histórias candidatas refinadas; Figma das telas iniciais por perfil, em paralelo. Plano em `sprint-0.md`.
- **Sprint 1 (05 a 09/10)**: histórias do topo Prontas pela DoR; base técnica herdada do Trabalhista (ADR-001); homologação no ar.
- **Desenvolvimento a partir da Sprint 2 (12/10)**, sprints de uma semana.
- **Release 1**: D1 de ponta a ponta com a governança médica, e a conferência do sênior do D2. Data a fechar na abertura.


## Sprint 0
**Meta:** sair da semana com o BPMN numerado no Miro, as candidatas do D1 e do D2 refinadas e com dúvidas respondidas, e as telas iniciais de cada perfil desenhadas no Figma.

## Trilhas em paralelo
| Trilha | Quem | Entrega até sexta |
|---|---|---|
| BPMN | Lucas com o escritório | Códigos dos passos gravados nos cartões do Miro; passos novos D1.21M, DP.00 e D4.02N desenhados; "a definir" respondidos |
| Histórias | Lucas e Fernando | Candidatas de D1, D2 e governança médica (GGVP-16 a 31 e 66 a 71) criadas no Jira `GGVP`, refinadas na quarta |
| Figma | Pedro | Tela inicial "O que é meu hoje" + chat para Atendimento, Documentação, Advogada, Sênior e Financeiro (GGVP-78, GGVP-82) |
| Base técnica | Mateus | Proposta dos ADRs 001, 002 e 008; ambiente de homologação |

## Eventos
- Segunda 28/09: abertura. Confirmar calendário, capacidade e meta.
- Quarta 30/09: refinamento das candidatas com o PO. Dúvidas de `docs/requisitos/duvidas-abertas.md` na pauta.
- Sexta 02/10: review com o escritório (BPMN e Figma) e retrospectiva.

## Pronto para a Sprint 1 quando
- As histórias do topo cumprem a DoR, incluindo o item 9 (portão do parecer médico).
- O Figma das telas iniciais foi visto pelo escritório.

## Depois da Sprint 0
- **Sprint 1 (05 a 09/10):** histórias do topo Prontas pela DoR; base técnica herdada; homologação no ar; Railway com o modelo do Figma (seletor de perfil, dados fictícios).
- **Sprint 2 em diante (12/10):** desenvolvimento em sprints de uma semana, Release 1 = D1 de ponta a ponta com a governança médica + conferência do sênior do D2.
