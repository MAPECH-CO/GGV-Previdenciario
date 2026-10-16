# Design

## Context

- **A conferência de 15/10** (PR #102) leu cada critério contra o código e os testes da main `e49d510`. Os critérios desta
  change têm código, mas a prova citada roda no servidor de exemplo do navegador, ou não existe.
- **Onde cada critério mora no servidor:**
  - o parecer sem roteiro: `rotas/parecer.ts` (`semRoteiro`), com a regra pura `web/src/regras/parecerDoCaso.ts`;
  - a análise da ficha e a renovação da senha: `rotas/recepcao-decisoes.ts` (`/api/entrevistas/:id/analise` e `/renovacao`);
  - a sugestão do benefício: `fluxo/sugestao-do-beneficio.ts`, com a busca do acervo de `ia/acervo.ts`;
  - a página do processo: `rotas/processo.ts` (`GET /api/casos/:id/processo`), que a tela monta em `web/src/dados/caso.ts`;
  - a chance: `rotas/conferencia.ts` (`POST /api/casos/:id/chance`), que a tela da perícia chama com a recomendação aberta
    (`web/src/paginas/Pericias.tsx`); a recomendação: `rotas/recomendacao-pericia.ts`;
  - a perícia por perfil: `rotas/pericia.ts` (`visao`);
  - o ilegível: `rotas/recepcao-documentos.ts` (`ilegivelEmAberto`);
  - a exportação do histórico: `rotas/historico.ts`; o kit: `rotas/recepcao-contrato.ts` (`/contrato/kit`);
  - o indeferimento: `rotas/vigilia.ts`; o acervo: `ia/acervo.ts` (`buscarNoAcervo`, `alimentarAcervo`).

## Goals / Non-Goals

**Goals:**
- Um teste do servidor por critério, pelo caminho que a tela usa (a rota, com a sessão do perfil), com o `fetch` falso.
- O nome do teste com a história e o CA, para a próxima conferência achar.

**Non-Goals:**
- Corrigir o que o teste mostrar quebrado: vai ao PR como lacuna confirmada.
- Mexer nos arquivos dos PRs #100 e #101 e da sessão "Lacunas do servidor sem PR".

## Decisions

1. **Arquivo do teste.** Fica no teste da rota quando ele está livre (`parecer.test.ts`, `recepcao-decisoes.test.ts`,
   `processo.test.ts`, `recomendacao-pericia.test.ts`, `vigilia.test.ts`). Arquivo novo quando o da rota está em outro PR
   (`pericia.test.ts`, `recepcao-documentos.test.ts`) ou não existe (`sugestao-do-beneficio.ts`, o kit e a exportação).
2. **A tela pela regra pura.** Quando o critério fala do que a pessoa vê, o teste passa a resposta do servidor pela mesma
   regra pura que a tela usa (por exemplo, `pontosDeAtencao` da preparação). Assim a prova é do servidor, com o texto da tela.
3. **O PDF do kit.** O conversor de mentira devolve o texto do Word que recebeu: o teste procura a senha no que viraria o
   PDF e no Word baixado.
4. **A falha de gravação (GGVP-52 CA5).** Duas gravações: o banco de motivos (o registro do indeferido) e o acervo (o
   trecho e o vetor). A falha do armazenamento no registro e a da IA no vetor são provocadas pelo falso; a segunda tentativa
   grava uma vez só.

## Risks / Trade-offs

- [O teste prova o servidor de hoje] → os PRs #100 e #101 mudam rotas vizinhas; o CI do merge deles roda estes testes.
- [Lacuna achada aqui fica sem dono] → cada uma vai ao PR com o arquivo e a linha, para o Mateus decidir.
