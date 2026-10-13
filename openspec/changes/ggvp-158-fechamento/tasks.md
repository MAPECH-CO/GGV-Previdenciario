# Tasks

<!-- Uma parte por vez, na ordem do cartão. As partes 3 a 9 ganham seção quando chegar a vez (/opsx:update). Desde 12/10,
     o que é Coolify, GitHub, Supabase e CodeQL entra aqui também, nas seções "fora do código", feito com o Mateus. -->

## GGVP-158 · Parte 1 · Ligar o que está desligado na homologação (o código)

- [x] 1.1 Versão no /saude (P1.2), contrato primeiro:
  - `Saude` ganha `versao` em `packages/contratos/src/index.ts`;
  - `criarServidor` recebe `versao` (padrão `local`) em `apps/api/src/servidor.ts`, e o `principal.ts` passa `VERSAO`;
  - o `Dockerfile` ganha `ARG VERSAO=local` e `ENV VERSAO=$VERSAO`;
  - o `.github/workflows/imagem.yml` passa `VERSAO=${{ env.COMMIT }}` em `build-args`.

  Teste em `apps/api/src/servidor.test.ts`: sem versão, `local`; com versão, o commit. Verifica com `pnpm --filter @ggv/api exec vitest run src/servidor.test.ts`. Depois do merge, o /saude da homologação mostra o commit.
- [x] 1.2 Cabeçalhos de segurança (P1.3): um `onSend` em `apps/api/src/servidor.ts`.
  - Leva `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` e a CSP do design.
  - Leva o HSTS só com o cookie seguro.

  Teste em `servidor.test.ts`: uma rota da API e o /saude trazem os três cabeçalhos, e o HSTS aparece só com `cookieSeguro`. Verifica com `pnpm --filter @ggv/api exec vitest run src/servidor.test.ts`.

  Também verifica abrindo a tela montada (`pnpm --filter @ggv/web build`, e a API servindo `apps/web/dist`) no navegador: o login, uma Central e as Transcrições abrem sem erro de CSP no console.
- [x] 1.3 Produção não sobe sem banco (P1.4): `abrirBanco` em `apps/api/src/banco/conexao.ts` recusa o banco embutido com `NODE_ENV=production` e diz que falta o `DATABASE_URL`.

  Teste novo em `apps/api/src/banco/conexao.test.ts`: em produção, sem URL, recusa sem abrir o PGlite; fora de produção, segue o embutido. Verifica com `pnpm --filter @ggv/api exec vitest run src/banco/conexao.test.ts`.
- [x] 1.4 Sem Chatwoot, "simulado, não saiu" (P1.1): em `apps/api/src/rotas/mensagens.ts`, sem as variáveis do Chatwoot, o envio grava `falhou` com o motivo "simulado, não saiu: o Chatwoot não está ligado neste ambiente". O comentário do topo diz isso. **No PR à parte (branch `feat/GGVP-158-nao-saiu`), para mesclar junto com o Chatwoot ligado na homologação (Mateus, 11/10).** A janela do Chatwoot para quando a mensagem não sai, e sem o Chatwoot o convite, a confirmação e a cobrança do roteiro travariam.

  Testes:
  - `rotas/mensagens.test.ts`: o envio registrado, o complemento, o desfavorável e o "sem as variáveis" esperam "não saiu" com o motivo. O que precisa de entrega (não repetir na mesma conversa, a tentativa do complemento) passa para o Chatwoot de mentira da GGVP-146.
  - `rotas/seguranca.test.ts`: o aviso de mudança devolve o motivo.

  Verifica com `pnpm --filter @ggv/api exec vitest run src/rotas/mensagens.test.ts src/rotas/seguranca.test.ts`.
- [x] 1.5 Uma lista das variáveis (P1.5):
  - `.env.example` na raiz, só com os nomes e um comentário por grupo;
  - a mesma lista em `docs/infra/homologacao.md`, com uma linha do para quê de cada variável.

  Teste novo em `apps/api/src/variaveis.test.ts`. Ele lê o código do servidor (`process.env.X`, `ambiente.X` e `const { X } = ambiente`) e confere três coisas:
  - cada nome está no `.env.example`;
  - cada nome está na doc;
  - o `.env.example` não tem valor.

  Verifica com `pnpm --filter @ggv/api exec vitest run src/variaveis.test.ts`. Também verifica que o teste falha e diz o nome quando um nome sai da lista.
- [x] 1.6 Exemplos dos recursos novos no preparo da homologação (P1.6):
  - `semearRecursosNovos` em `apps/api/src/banco/exemplo.ts` traz os peritos de exemplo com o perfil (`perito`), os entendimentos do "TRF3 · 6301" (`juizo`) e uma reunião na agenda (`compromisso_interno`);
  - `prepararHomologacao` chama a função também na homologação já preparada, e cada exemplo entra só se falta.

  Teste em `apps/api/src/banco/homologacao.test.ts`: a homologação preparada antes ganha os três, uma vez só, sem trocar senha. Verifica com `pnpm --filter @ggv/api exec vitest run src/banco/homologacao.test.ts`.
- [x] 1.7 Doc dos dados de teste (P1.6): `docs/infra/homologacao-dados-de-teste.md` lista os exemplos novos e onde abrir cada um. Diz que rodar de novo acrescenta o que faltar e por que o contrato da Recepção, a leitura, o checklist, as boas-vindas, a cobrança e a perícia nascem no roteiro. Verifica lendo a seção "O que entra".
- [x] 1.8 Os testes de tela com o "não saiu" (P1.1), no mesmo PR à parte da 1.4:
  - O convite, a confirmação e a cobrança dos testes de tela precisam da entrega para seguir. Por isso o Playwright sobe a API com `RELACIONAMENTO_SIMULADO=entrega`, o Chatwoot de mentira que entrega, só lá (`apps/web/playwright.config.ts`). Os testes de tela seguem como estão.
  - O "não saiu" fica provado nos testes da API (`mensagens.test.ts`, com o teste do modo `entrega`, e `seguranca.test.ts`). Na tela, `ConviteChatwoot.test.tsx` e `MensagemAoCliente.test.tsx` já provam que a janela mostra o motivo da mensagem que não saiu.
  - `docs/infra/homologacao.md` diz o que acontece sem o Chatwoot e que o `entrega` é só dos testes.

  Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm --filter @ggv/web exec playwright test recepcao-servidor transcricao-ligacao mensagens seguranca --workers=1`.
- [x] 1.9 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-158 · Parte 1 · Fora do código e os nomes do ZapSign (12/10)

- [x] 1.10 Chatwoot na homologação (P1.7).
  - O Mateus pôs no Coolify `CHATWOOT_URL`, `CHATWOOT_CONTA` (2), `CHATWOOT_CAIXA` (a do escritório, GGV PREV, a única), `CHATWOOT_TOKEN` (direto no Coolify) e `CHATWOOT_PERMITIDOS` (os telefones do time).
  - Conferiu `AMBIENTE=homologacao` e fez o redeploy.

  Verificado em 12/10 no portal da homologação:
  - o lead de teste com o telefone da lista recebeu as boas-vindas no WhatsApp ("✓ Enviada no Chatwoot às 10:40");
  - com o telefone de fora, a janela disse "fora da lista de teste".

  O #63 saiu do rascunho.
- [ ] 1.11 Os modelos que passam (P1.8). Dos anexos da GGVP-136, conferidos com `lerModelo`, passam o `modelo-8` (kit consumidor de 23/07) e o `modelo-10` (seguro de vida).
  - A Sênior sobe os dois pelo `modelos:subir`, com a senha digitada só no terminal do Mateus.
  - Na primeira tentativa (12/10), o portal respondeu 500: o depósito `documentos` do Supabase não aceitava Word. Com a autorização do Mateus, o tipo do Word entrou na lista do depósito, pelo conector.
  - O depósito agora está descrito em `docs/infra/homologacao.md`, para a produção nascer igual.
  - Verifica: a Configuração mostra a versão dos dois, e o cartão registra o que falta e por quê.
- [x] 1.12 Os nomes do ZapSign no kit (P1.9), num PR à parte sobre o #62, com revisão do Pedro. Na ordem contrato → teste → código:
  - em `apps/web/src/regras/kitDoModelo.ts`, os sinônimos com o mesmo valor do nome do portal e as variáveis que a ficha não tem como opcionais;
  - a regra da primeira data vale para `{{DIA}}`, `{{MÊS}}` e `{{ANO}}`, em `apps/api/src/kit/docx.ts`;
  - teste em `apps/web/src/regras/kitDoModelo.test.ts` e em `apps/api/src/kit/docx.test.ts`, com um .docx de teste montado na hora, sem modelo do escritório no repositório.

  Verifica com os testes e com a conferência dos 3 Contratos Completos baixados, fora do repositório: os três passam.

  Verificado em 12/10:
  - `kitDoModelo.test.ts` 18/18 e `docx.test.ts` 8/8;
  - os 6 anexos da GGVP-136 passam no `lerModelo`;
  - com uma ficha inventada, os 3 Contratos Completos saem sem nada faltando e sem `{{ }}` sobrando, e só a primeira data vem preenchida.

  Achado para a 1.13: no modelo do auxílio incapacidade (22/01), a procuração vem antes do contrato de honorários, e a data sai na procuração.
  - Decisão do Mateus (12/10): o contrato vai para o começo do Word.
  - Feito numa cópia, fora do repositório: o bloco do contrato foi para o começo, com uma quebra de página antes da procuração.
  - Conferido no Word: as mesmas 6 páginas, cada documento começando no alto de uma página, e a data preenchida no contrato.
- [ ] 1.13 Depois do merge da 1.12, a Sênior sobe os 3 Contratos Completos (auxílio incapacidade, auxílio acidentário e LOAS). Verifica: o "Preparar contrato" gera o kit com os dados da ficha.
- [ ] 1.14 Gotenberg (P1.10): o serviço `gotenberg/gotenberg:8` no mesmo projeto do Coolify, na porta 3000, sem domínio público, e o `GOTENBERG_URL` no app. Verifica: `GET /api/contrato/servicos` responde `pdf: true`, e o kit sai em PDF.
- [ ] 1.15 Drive na homologação (P1.11): a decisão do Mateus, entre só leitura e pastas de teste, aplicada no Coolify. O Mateus apaga do Drive real a pasta de teste "Leads/2026/Teste Chatwoot Mateus". Verifica: o /saude mostra o Drive como o Mateus decidiu, e um lead novo não cria pasta nas pastas reais.
- [ ] 1.16 Depois do merge do #62, o Mateus roda `homologacao:preparar` no terminal da homologação. Verifica: o /saude mostra o commit novo, e os peritos de exemplo aparecem ao registrar o perito de uma perícia.
- [ ] 1.17 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-158 · Parte 2 · Segurança e processo do repositório (o código)

- [x] 2.1 drizzle-orm 0.45.2 ou mais (P2.1), instalado o 0.45.3 (o 0.45.4 saiu há 3 dias): sobe a versão em `apps/api/package.json` e no `pnpm-lock.yaml`, com o drizzle-kit da mesma família. `pnpm --filter @ggv/api db:gerar` não pode achar mudança no esquema. Verifica com `pnpm --filter @ggv/api exec vitest run src/banco/migracoes.test.ts` e com a suíte inteira da API.
- [x] 2.2 "[completar]" sem regex lenta (P2.2): `faltaCompletar`, em `packages/contratos/src/ia.ts`, passa a usar `indexOf`, sem distinguir maiúscula.

  Teste em `packages/contratos/src/ia.test.ts`:
  - 50 mil "[completar" sem o fecho responde em menos de 100 ms;
  - "[completar o nome]" e "[COMPLETAR]" seguem barrados;
  - "[completar" sem o fecho passa, como hoje.

  Verifica com `pnpm --filter @ggv/contratos exec vitest run src/ia.test.ts`.
- [x] 2.3 `@ggv/campos` no CI (P2.3):
  - `packages/campos/tsconfig.json`, o mesmo do `@ggv/contratos`, com `src` e `test`;
  - os scripts `typecheck` (`tsc`) e `lint` (`oxlint`) em `packages/campos/package.json`;
  - `typescript`, `oxlint` e `@types/node` nas devDependencies, nas mesmas versões dos outros pacotes. Nenhum pacote novo entra no lockfile.

  Verifica com `pnpm -r typecheck` e `pnpm -r lint`: os dois passam por `packages/campos` sem erro.
- [x] 2.4 Erro sem SQL (P2.4): `setErrorHandler` em `apps/api/src/servidor.ts`.
  - O erro de validação e o 4xx seguem com a mensagem e o status.
  - O 5xx responde `{ erro: 'Algo deu errado.' }` e registra só a rota, o código e o tipo.
  - O logger ganha o `redact`.

  Teste em `servidor.test.ts`: uma rota que falha com "Failed query ... params: 123.456.789-09" devolve "Algo deu errado.", e o registro não traz o SQL nem o parâmetro. Verifica com `pnpm --filter @ggv/api exec vitest run src/servidor.test.ts`.
- [x] 2.5 A sugestão citada é deste caso (P2.6): `chamadaDoCaso(banco, chamadaId, casoId)` em `apps/api/src/ia/ia.ts`. As 6 rotas recusam com 400 "A sugestão da IA não é deste caso." antes de gravar:
  - `indeferimento.ts`;
  - `exigencia-juiz.ts`;
  - `recomendacao-pericia.ts`;
  - as duas de `peticao.ts`;
  - o resumo do resultado (`resultado.ts`), que o cartão não listava e grava a chamada do mesmo jeito.

  Testes:
  - `ia/ia.test.ts`: a chamada do caso vale; a de outro caso e a que não existe, não;
  - os 5 arquivos de teste das rotas: a chamada que não é do caso é recusada e nada é gravado; a do caso segue.

  Verifica com `pnpm --filter @ggv/api exec vitest run src/ia/ia.test.ts src/rotas/indeferimento.test.ts src/rotas/exigencia-juiz.test.ts src/rotas/recomendacao-pericia.test.ts src/rotas/peticao.test.ts src/rotas/resultado.test.ts`.
- [x] 2.6 O que segue desligado (P2.7): `docs/ferramentas.md` diz:
  - a revisão automática do Claude (`claude-review.yml`) e o workflow do Jira (`jira.yml`) seguem desligados no repositório da MAPECH-CO, por falta dos segredos (só os nomes);
  - o outro dev revisa cada pedido;
  - cada um move o próprio cartão no Jira.

  A doc também troca o endereço do repositório pelo da MAPECH-CO. Verifica lendo a seção e conferindo que os nomes dos segredos batem com os dos dois workflows.
- [x] 2.7 Matriz 29 (P2.5), sobre a main mais nova, em `packages/contratos/src/permissoes.ts`:
  - `chat.usar` e `tarefa.ver` para os 8 perfis;
  - `tarefa.cumprir` para todos menos o Sócio;
  - `VERSAO_MATRIZ = 29` e a impressão digital nova em `permissoes.test.ts`.

  Verifica com `pnpm --filter @ggv/contratos exec vitest run src/permissoes.test.ts`.
- [x] 2.8 Trava nas 7 rotas (P2.5): `exigir` com estas permissões:
  - `chat.usar` nas 3 rotas do chat (`rotas/chat.ts`);
  - `tarefa.ver` em `/api/tarefas` (`rotas/inss.ts`) e `/api/conversas/tarefas` (`rotas/conversa.ts`);
  - `tarefa.cumprir` na pendência cumprida (`rotas/conversa.ts`);
  - `entrevista.ver` no arquivo da gravação (`rotas/recepcao-entrevista.ts`).

  As conferências de dentro das rotas ficam. Em `servidor.ts`, o `onRoute` recusa rota `/api` sem trava. Ficam fora as da sessão e a que declara o motivo em `config.semTrava`, que é a do histórico imutável (`historico.ts`, recusa sempre).

  Testes:
  - `servidor.test.ts`: a rota `/api` sem trava não sobe; a da sessão e a declarada sobem;
  - `rotas/conversa.test.ts`: o Sócio recebe 403 na pendência, com a recusa no histórico;
  - `rotas/transcricao.test.ts`: a Documentação recebe 403 no arquivo da gravação, com a recusa no histórico.

  Verifica com `pnpm --filter @ggv/api exec vitest run src/servidor.test.ts src/rotas/conversa.test.ts src/rotas/transcricao.test.ts src/rotas/chat.test.ts src/rotas/inss.test.ts src/rotas/recepcao-entrevista.test.ts src/rotas/historico.test.ts`.
- [x] 2.9 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-158 · Parte 2 · Fora do código (12/10)

- [ ] 2.10 Banco da homologação (P2.8): com a autorização do Mateus, o conector do Supabase lista só nomes e contagens do esquema `juridico`, das cópias `zz_backup_*` e da `_snap_pgss`. A proposta vai ao cartão; apagar, só o Mateus. Verifica: o comentário no cartão traz a lista e a proposta.
- [ ] 2.11 Main protegida (P2.9): combinada com o Pedro e aplicada pelo `gh`. Verifica: um pedido sem aprovação não mescla.
- [ ] 2.12 CodeQL (P2.10): reconferir `textoDoHtml` (`apps/api/src/vigilia/fontes.ts`) e dispensar os 2 alertas com o motivo, pelo `gh`. Verifica: a aba de alertas fica sem os 3 (o da regex fecha com o merge do #62).
- [ ] 2.13 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-158 · Correções da revisão do #62 e do #63 (12/10)

- [ ] 3.1 P1.3 · A CSP com `frame-src 'self' blob:` (`apps/api/src/servidor.ts`), para a impressão do kit em PDF; teste em `servidor.test.ts` que confere a diretiva. Verifica com `pnpm --filter @ggv/api exec vitest run src/servidor.test.ts`.
- [ ] 3.2 P1.1 · Em produção, o `RELACIONAMENTO_SIMULADO=entrega` não vale (`apps/api/src/rotas/mensagens.ts`); teste em `rotas/mensagens.test.ts`. Verifica com `pnpm --filter @ggv/api exec vitest run src/rotas/mensagens.test.ts`.
- [ ] 3.3 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
