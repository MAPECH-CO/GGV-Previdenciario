# Tasks

<!-- Grupo 1: roteiro, classificação, parecer, complemento e portão. -->

## GGVP-93 · Roteiro de conteúdo mínimo por benefício

- [x] 1.1 Contrato: tipos do roteiro em `apps/web/src/regras/roteiro.ts` (`TipoDoItem`, `ItemDoRoteiro`, `VersaoDoRoteiro`, `Roteiro`) e `roteiros?` no `Banco` de `servidor.ts`, acrescentado no fim. Verifica com `pnpm typecheck`.
- [x] 1.2 Regra: `emVigor`, `roteiroDoBeneficio` (um roteiro para vários benefícios; fora de todos, "sem roteiro"), `versao`, `novaVersao` e `motivoParaNaoSalvar` em `src/regras/roteiro.ts`, com teste em `src/regras/roteiro.test.ts` (CA1, CA2, CA3). Verifica com `pnpm vitest run src/regras/roteiro.test.ts`.
- [x] 1.3 Servidor de exemplo: a semente da matriz de `docs/requisitos/roteiro-laudos.md` e da resposta do Lucas de 01/10, `obterRoteiros`, `obterRoteiro`, `roteiroDoCaso` e `salvarRoteiro` (só a sênior; nova versão com autor e data; valida de novo) em `src/dados/roteiro.ts`, com teste em `src/dados/roteiro.test.ts` (CA1, CA2, CA3). Verifica com `pnpm vitest run src/dados/roteiro.test.ts`.
- [x] 1.4 Tela `/roteiros` e `/roteiros/:id` (`src/paginas/Roteiro.tsx`): a lista, os itens por tipo com o texto do escritório, "Editar" para a sênior, "Salvar nova versão" com a trava, as versões anteriores com autor e data, e o aviso para quem não é do Jurídico; rotas em `App.tsx`. Teste em `Roteiro.test.tsx` e `App.test.tsx` (CA1, CA2). Verifica com `pnpm vitest run src/paginas/Roteiro.test.tsx src/App.test.tsx`.
- [x] 1.5 Playwright `e2e/roteiro.e2e.ts`: a sênior abre o roteiro do LOAS Deficiente, edita um item e salva a versão 2; a advogada vê sem editar; o Atendimento não vê (CA1, CA2); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3193 PORTA_E2E_WEB=5193 pnpm exec playwright test roteiro`.
- [ ] 1.6 Ligar no servidor: trocar o corpo de `src/dados/roteiro.ts` por `fetch` nos endpoints da design e tirar o perfil da sessão. Depende do banco do Mateus. **Fica aberta nesta história.**
- [ ] 1.7 CA3 e CA4 na tela: o aviso "benefício sem roteiro" com a conferência manual, e a versão usada no parecer refeito, aparecem na tela do parecer (GGVP-20, tarefa 3.x). A regra fica pronta aqui.
- [ ] 1.8 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?" (no fim do grupo 1).

<!-- Fim do grupo 1. -->

<!-- Grupo 2: PCD, Auxílio-Acidente e LOAS de menor de 16 anos. -->

<!-- Fim do grupo 2. -->
