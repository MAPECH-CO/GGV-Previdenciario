# GGV Previdenciário

Portal operacional para o escritório previdenciário da GGV, refeito do zero a partir do BPMN validado com o PO em setembro de 2026. Substitui o portal atual, que ficou difícil de usar e de manter.

**Princípio:** cada pessoa vê só o que o setor dela faz, conversa com o portal em linguagem natural quando quiser, e nenhum caso anda sem a documentação correta.

## Por onde começar
| Quero... | Leia |
|---|---|
| Entender o processo do escritório | `docs/bpmn/README.md` (links para o Miro e códigos dos passos) |
| Ver o backlog candidato | `docs/requisitos/candidatas/README.md` (89 histórias, uma por arquivo) |
| Saber o que cada perfil vê (base do Figma) | `docs/requisitos/perfis.md` |
| Funções e tarefas por perfil (base das telas) | `docs/requisitos/funcoes-e-telas.md` |
| Ver o protótipo navegável e o que foi decidido nele | `docs/prototipo/figma.md` |
| Revisão de usabilidade do protótipo (achados e plano) | `docs/prototipo/revisao-usabilidade-2026-09-29.md` |
| Conhecer as travas de governança | `docs/requisitos/portoes-governanca.md` |
| Documentação médica por benefício | `docs/requisitos/roteiro-laudos.md` e `docs/requisitos/fontes/` |
| O que ainda depende do PO | `docs/requisitos/duvidas-abertas.md` |
| Como a equipe trabalha | `docs/scrum/` e `CONTRIBUTING.md` |
| Ferramentas e como se ligam | `docs/ferramentas.md` |
| Wiki do GitHub (espelho de `wiki/`, publicado por Action) | `wiki/Home.md` |
| Rodar o Claude Code no clone | `docs/claude-code.md` |
| Decisões | `docs/decisoes/` |
| Estudos de arquitetura (ex.: Chatwoot no portal) | `docs/arquitetura/` |

## Estado da base em 12/10/2026

A main conferida nesta atualização é `5780145`, com o refinamento visual dos pedidos #58 e #59. O portal já tem
telas React, API, permissões e testes. Ainda há fluxos mistos e integrações pendentes: implementação não significa
aceite em homologação.

- [Decisões e dúvidas do produto](docs/requisitos/duvidas-abertas.md): regras respondidas e pendências com Lucas.
- [Roteiro do teste](docs/entrega/roteiro-do-teste-09-10.md): jornadas, permissões e limites da base atual.
- [Conferência dos critérios](docs/conferencia-dos-criterios.md): evidências atualizadas e contagens históricas identificadas.
- [Treinamento por perfil](docs/treinamento/por-perfil.md): material curto; realização e logins reais ainda pendentes.
- [ADRs](docs/decisoes/README.md): stack aceita, pgvector, Chatwoot e decisões de saúde/guarda com pendências contratuais.

Os pedidos da GGVP-159 são revisados separadamente; não são considerados integrados nesta fotografia da main.
