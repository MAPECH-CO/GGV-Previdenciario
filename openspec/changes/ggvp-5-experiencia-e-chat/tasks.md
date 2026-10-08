# Tasks

## GGVP-86 · Navegar pelo caso numa linha só

- [x] 1.1 Regra: `etapaAtual`, `estadosDasEtapas`, `etapaDaOrigem`, `faseDoCaso`, `identificacao`, `prazosDaFase`, `emOrdem`, `setoresPendentes`, `taxaComCasos`, `jurimetriaDoJuizo`, `visaoDoPerfil` e `podeVerValor` em `src/regras/caso.ts`, com teste em `src/regras/caso.test.ts` (CA1 a CA3, CA6, CA10, CA12, CA13, valores). Verifica com `pnpm vitest run src/regras/caso.test.ts`.
- [x] 1.2 Servidor de exemplo: `casosDeExemplo`, `juizosDeExemplo`, `obterCaso` (visão do perfil), `identificarPerito`, `perfilDoPeritoDoCaso`, `jurimetriaDoJuizoDoCaso` e `descreverDocumento` em `src/dados/caso.ts`; `casos?` e `juizos?` no fim do `Banco`. Teste em `src/dados/caso.test.ts` (CA1 a CA13, permissão, valores). Verifica com `pnpm vitest run src/dados/caso.test.ts`.
- [x] 1.3 Tela `/casos/:id` (`src/paginas/PaginaDoCaso.tsx`, Figma `72:2`, `72:287`, `72:572`, `59:11`) e a sobreposição da jurimetria (`src/componentes/JurimetriaDoCaso.tsx`, Figma `2184:2` a `2184:183`); a rota no fim de `Telas`; a ficha leva ao caso e ao laudo novo. Teste em `src/paginas/PaginaDoCaso.test.tsx`. Verifica com `pnpm vitest run src/paginas/PaginaDoCaso.test.tsx`.
- [x] 1.4 Playwright `e2e/caso.e2e.ts`: o caso do Antônio de ponta a ponta, o perito do Pedro em um clique, a visão do Atendimento; tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3151 PORTA_E2E_WEB=5195 pnpm exec playwright test caso`.
- [ ] 1.5 Ligar no servidor: `obterCaso` vira `GET /api/casos/:id` com o perfil da sessão; a linha, as esperas e os laços vêm das tabelas do Mateus; a jurimetria da GGVP-59, GGVP-64 e GGVP-131. **Fica aberta nesta história.**
