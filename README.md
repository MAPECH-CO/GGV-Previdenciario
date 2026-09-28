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
| Conhecer as travas de governança | `docs/requisitos/portoes-governanca.md` |
| Documentação médica por benefício | `docs/requisitos/roteiro-laudos.md` e `docs/requisitos/fontes/` |
| O que ainda depende do PO | `docs/requisitos/duvidas-abertas.md` |
| Como a equipe trabalha | `docs/scrum/` e `CONTRIBUTING.md` |
| Ferramentas e como se ligam | `docs/ferramentas.md` |
| Rodar o Claude Code no clone | `docs/claude-code.md` |
| Decisões | `docs/decisoes/` |
| Estudos de arquitetura (ex.: Chatwoot no portal) | `docs/arquitetura/` |

## Estado em 26/09/2026
- BPMN revisado no Miro; passos ainda sem número no board (códigos propostos em `docs/bpmn/`).
- 89 histórias candidatas, todas com o rótulo `a-validar-bpmn`. Nenhuma está Pronta: faltam as respostas de `duvidas-abertas.md` e o refinamento.
- Sprint 0 começa em 28/09. O Trabalhista (`mapech-trabalhista`) está pausado até o Prev terminar; este repositório segue a mesma metodologia.
