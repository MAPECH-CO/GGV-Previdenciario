# Tasks

## GGVP-109 · Ninguém pula um portão de aprovação: validação no servidor

- [x] 1.1 Contratos `TentativaBloqueada` e `TentativasBloqueadas` em `packages/contratos/src/governanca.ts`; teste em `governanca.test.ts`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.2 CA1, CA2, CA4, CA5, CA6, CA7, CA9 · Teste da API em `apps/api/src/rotas/gestao.test.ts`: cada recusa grava o portão e o passo, sem dado de saúde, e aparece na lista da gestão; quem não tem `gestao.ver` recebe 403.
- [x] 1.3 CA1, CA2, CA4, CA6, CA7, CA9 · Servidor: `portao` e `passo` nas recusas que já gravavam (`inss.ts`, `conferencia.ts`, `manifestacao.ts`, `peticao.ts`), `portao_bloqueado` onde faltava (`exigencia.ts`, `manifestacao.ts`, `peticao.ts`, `prestacao.ts`), o caso no `acesso_negado` (`sessao/rotas.ts`) e GET `/api/gestao/tentativas` em `apps/api/src/rotas/gestao.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.4 CA9 · Tela "Tentativas bloqueadas" em `apps/web/src/paginas/Tentativas.tsx`, rota `/gestao/tentativas` e link no topo da Central para `gestao.ver`; teste de tela.
- [x] 1.5 CA3 · Botão principal desabilitado até a conferência em `Protocolar.tsx`, `Manifestar.tsx` e `PrestarContas.tsx`; testes de tela.
- [x] 1.6 Playwright em `apps/web/e2e/governanca.e2e.ts`: o Atendimento chama direto pela API uma ação fora do perfil, o servidor recusa, e a Sênior vê a tentativa, com o cliente, em "Tentativas bloqueadas".
- [x] 1.8 CA2 e G17 (junção com a GGVP-33 do Pedro, 07/10) · `travaDoParecer` em `packages/contratos/src/governanca.ts`, regra única da tela e do servidor (sem parecer, insuficiente, contraditório, só sugerido pela IA, laudo novo, dispensa esperando; benefício sem laudo não pede); a conferência usa a regra; a dispensa é de duas Sêniores diferentes (Q14): `POST /api/casos/:id/parecer/dispensa` pede, `POST .../dispensa/aprovacao` aprova ou recusa, a mesma pessoa é recusada e registrada; semente com a segunda Sênior (Otávio) e o parecer de exemplo confirmado pela advogada; testes do contrato, da API e da tela.
- [x] 1.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-25 · Regras objetivas calculadas por código

- [x] 2.1 Contratos `REGRAS`, `EntradaLoas24`, `EntradaIncapacidade`, `EntradaPcd`, `EntradaDii` e `ResultadoDaRegra` em `packages/contratos/src/governanca.ts`; teste.
- [x] 2.2 CA1 a CA5, CA8 · Regras em `apps/api/src/fluxo/regras.ts` (24 meses, 15 dias na janela de 60, períodos PCD, DII × carência e qualidade, "não calculável: falta X"), com teste em `regras.test.ts`.
- [x] 2.3 CA6, CA7 · POST `/api/regras/:regra` (`laudo.conferir`) em `apps/api/src/rotas/regras.ts`, devolvendo entradas, fundamento e versão; teste. A tela é a conferência médica do Pedro, que chama esta rota.
- [x] 2.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-94 · Tarefa com laço, lembrete e escalonamento

- [x] 3.1 Contratos `DecidirLaco` e `Lembrete` (em `ItensDoSetor` e no card da exigência do INSS) em `packages/contratos`; teste.
- [x] 3.2 CA1 · `proximoLembrete` em `apps/api/src/fluxo/exigencia.ts` (dias úteis, compressão pelo prazo, nunca depois dele), com teste.
- [x] 3.3 CA1, CA6, CA7, CA11 · Servidor: lembrete em dias úteis na distribuição, no despacho e em cada tentativa (`exigencia-juiz.ts`, `exigencia.ts`, `indeferimento.ts`), lembrete descrito no card, configuração de exemplo em 3 dias úteis; testes.
- [x] 3.4 CA8, CA9, CA10 · Servidor: decisão da Sênior no laço que subiu (juízo, despacho e INSS), com a decisão gravada, a contagem zerada, o próximo lembrete e a tarefa da Sênior fechada; testes.
- [x] 3.5 Telas: o lembrete no card do setor e da Documentação; a Sênior decide no item que subiu (exigência do juiz, despacho e exigência do INSS); testes de tela.
- [x] 3.6 Playwright: o setor cobra até o limite, a Sênior decide, e o setor vê a decisão e o próximo lembrete.
- [x] 3.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-68 · Lista de exigências com prazo, responsável e prova

- [x] 4.1 Contratos: `acionadoEm` e `ultimaTentativa` nos itens da exigência do juiz e nos setores do despacho; `peca` na exigência do juiz; teste.
- [x] 4.2 CA4, CA15 · Servidor: os alertas da exigência também para o "Atendimento · líder", no topo a 2 dias úteis (`inss.ts`); teste.
- [x] 4.3 CA5, CA14 · Servidor: acionamento, última tentativa e a peça que cumpriu (`exigencia-juiz.ts`, `indeferimento.ts`); testes.
- [x] 4.4 CA5, CA14 · Telas: status de cada setor com o acionamento e a última tentativa, e a peça no item cumprido (`AnalisarExigenciaJuiz.tsx`, `Despachar.tsx`); testes de tela.
- [x] 4.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-99 · Histórico de quem fez o quê, incluindo a IA

- [x] 5.1 Contratos `EventoDoHistorico`, `HistoricoDoCaso`, `PedirExportacao` e `PrazosDoEscritorio`; matriz versão 9 (`historico.autorizar_exportacao`); teste.
- [x] 5.2 CA3, CA7, CA11 · GET `/api/casos/:id/historico` (eventos e decisões, em ordem, com a descrição) em `apps/api/src/rotas/historico.ts`; teste.
- [x] 5.3 CA9 · PUT, PATCH e DELETE no histórico recusados e registrados; teste (o banco já recusa, com teste).
- [x] 5.4 CA12 · Pedido da gestão, autorização do Sócio e exportação, tudo no histórico; teste.
- [x] 5.5 CA14 · GET `/api/gestao/prazos` com os prazos cumpridos e perdidos; teste.
- [x] 5.8 GGVP-96 CA14 (aberto na Fundação) · o relatório de prazos e a exportação do histórico seguem a matriz: perfil a perfil, só a gestão gera; a exportação por quem não vê saúde nem valores não leva o parecer nem os valores da prestação; teste em `historico.test.ts`.
- [x] 5.6 Telas "Histórico do processo" (`/casos/:id/historico`, com o pedido e a autorização da exportação) e "Prazos cumpridos e perdidos" (`/gestao/prazos`); links; testes de tela.

## GGVP-103 · Cofre de senhas do gov.br

- [x] 6.1 Contratos `CadastrarSenhaGovbr` e `UsoDoCofre`; matriz versão 9 (`cofre.cadastrar`); teste.
- [x] 6.2 CA4, CA6, CA11 · POST `/api/pessoas/:id/cofre` (cadastrar ou trocar, sem o valor no registro); teste.
- [x] 6.3 CA5, CA6, CA7 · Revelar só com tarefa de gov.br aberta, com o motivo; alerta fora do padrão para a Sênior; GET `/api/gestao/cofre`; testes.
- [x] 6.4 CA10 · `apagarSenhasVencidas` (1 ano depois do último encerramento), no relógio diário; teste.
- [x] 6.5 CA9 · Teste que procura a senha de teste no histórico e na exportação.
- [x] 6.6 Telas: o componente do cofre (cadastrar ou trocar) no protocolo e para a ficha; "Uso do cofre" para a gestão (`/gestao/cofre`); testes de tela.
- [x] 6.7 Playwright: o Jurídico administrativo cadastra a senha pelo cofre e revela; a gestão vê o uso no relatório, sem o valor.
- [x] 6.8 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-104 · Configuração do escritório

- [x] 7.1 Contratos `BENEFICIOS`, `ROTULO_BENEFICIO`, `ConfiguracaoDoEscritorio`, `SalvarParametro`, `PublicarKit` e `SalvarMensagem`; matriz versão 10 (`configuracao.editar`); testes.
- [x] 7.2 CA1, CA6 · Migração 0012 (versão do kit) e a conferência lendo a versão vigente na abertura do caso; teste.
- [x] 7.3 CA3, CA4 · GET `/api/configuracao` e PUT dos parâmetros, com validação e histórico; teste.
- [x] 7.4 CA1, CA3, CA5 · PUT do kit (publica a versão seguinte) e das mensagens, com histórico; teste.
- [x] 7.5 Tela "Configuração do escritório" (`/configuracao`) e o link no topo da Central; testes de tela.
- [x] 7.6 Playwright: a Sênior muda o limite de cobrança e publica o kit de um benefício; a mudança aparece no histórico da configuração.
- [x] 7.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
