# Tasks

## GGVP-75 · Painel de resultado para os sócios

- [x] 1.1 Contrato em `packages/contratos/src/resultados.ts` (`PedidoDoPainel`, `Indicador`, `PainelDeResultados`, `RAIO_X`, `AMOSTRA_MINIMA`) e matriz versão 11 com `valores.ver_totais` (Sócio e Financeiro), com a impressão digital nova no teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.2 CA1, CA2, CA3, CA7, CA8 · Cálculo em `apps/api/src/fluxo/resultados.ts` (os indicadores pela data do evento, a amostra mínima de 8, dado incerto fora, o recorte por benefício, perito, juízo e advogada); teste com casos montados no banco embutido; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.3 CA1, CA4, CA5, CA6 · `GET /api/gestao/resultados` em `apps/api/src/rotas/gestao.ts` (período padrão do ano, datas pela `campos`, totais só com `valores.ver_totais`, operação e base do acervo "sem dados ainda"); teste por perfil; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.4 Dados de exemplo: casos decididos que dão uma taxa e um recorte com amostra insuficiente; verifica entrando como Sócio.
- [x] 1.5 Tela "Resultados" da Gestão (`apps/web/src/paginas/Resultados.tsx`), a rota e o link na barra do topo, no padrão das telas da Gestão do portal; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 1.6 CA2, CA3, CA5 · Conferir a tela com a Gestão do Sócio do protótipo (v2 de 02/10) e trazer ao Raio-X "o que o cartório mais cobra" e "onde julgam", às extinções o total de decididos e aos pareceres a diferença em pontos; verifica com `pnpm --filter @ggv/web test`.
- [x] 1.7 Playwright: o Sócio vê os indicadores e os totais; a Sênior vê o painel sem os totais; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 1.8 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
