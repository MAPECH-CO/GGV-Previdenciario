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
- [x] 1.11 Os modelos que passam (P1.8). Dos anexos da GGVP-136, conferidos com `lerModelo`, passam o `modelo-8` (kit consumidor de 23/07) e o `modelo-10` (seguro de vida).
  - A Sênior sobe os dois pelo `modelos:subir`, com a senha digitada só no terminal do Mateus.
  - Na primeira tentativa (12/10), o portal respondeu 500: o depósito `documentos` do Supabase não aceitava Word. Com a autorização do Mateus, o tipo do Word entrou na lista do depósito, pelo conector.
  - O depósito agora está descrito em `docs/infra/homologacao.md`, para a produção nascer igual.
  - Verifica: a Configuração mostra a versão dos dois, e o cartão registra o que falta e por quê.

  Verificado em 13/10, junto com a 1.13:
  - os 5 modelos estão na versão 1, em vigor, cada um com o seu arquivo no depósito;
  - o comentário do cartão lista os 4 que faltam, porque o escritório ainda não mandou: aposentadorias, LOAS sem representante, curatela e restituição.

  O 500 de 13/10 era outro: o `SUPABASE_URL` do app tinha o endereço do banco (`postgresql://`), e nenhum arquivo da homologação era guardado. O Mateus trocou para `https://gyqscrirlzfogurduruf.supabase.co`, e o depósito respondeu 200.
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
  - 13/10: os 3 subiram, na versão 1. O LOAS foi como "LOAS representado por genitor(a)", porque usa os dados do genitor.
  - Falta gerar um kit na tela.
- [ ] 1.14 Gotenberg (P1.10): o serviço `gotenberg/gotenberg:8` no mesmo projeto do Coolify, na porta 3000, sem domínio público, e o `GOTENBERG_URL` no app. Verifica: `GET /api/contrato/servicos` responde `pdf: true`, e o kit sai em PDF.
  - 13/10, com o ok do Mateus: o app `gotenberg-homologacao`, sem domínio, com o nome fixo na rede interna e o teto de 1 CPU e 1 GB.
  - O `GOTENBERG_URL=http://gotenberg-homologacao:3000` está no app; do contêiner da API, a saúde dá 200 e a conversão de teste dá certo.
  - Medido: parado, ~10 MB; convertendo, pico de ~120 a 180 MB, em ~4 s. O servidor tem 4 CPUs e 16 GB.
  - Falta o kit em PDF na tela.
- [ ] 1.15 Drive na homologação (P1.11): a decisão do Mateus, entre só leitura e pastas de teste, aplicada no Coolify. O Mateus apaga do Drive real a pasta de teste "Leads/2026/Teste Chatwoot Mateus". Verifica: o /saude mostra o Drive como o Mateus decidiu, e um lead novo não cria pasta nas pastas reais.
  - 13/10: o Mateus decidiu só leitura, e o /saude mostra `"drive":"so-leitura"`.
  - Falta o Mateus apagar a pasta de teste (fica para depois, combinado em 13/10).
- [x] 1.16 Depois do merge do #62, o Mateus roda `homologacao:preparar` no terminal da homologação. Verifica: o /saude mostra o commit novo, e os peritos de exemplo aparecem ao registrar o perito de uma perícia.

  Verificado em 13/10: o comando terminou sem erro, o /saude mostra a `da10ac8d` (com o #62, o #63 e o #69), e os 3 peritos de exemplo estão no banco.
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

- [x] 2.10 Banco da homologação (P2.8): com a autorização do Mateus, o conector do Supabase lista só nomes e contagens do esquema `juridico`, das cópias `zz_backup_*` e da `_snap_pgss`. A proposta vai ao cartão; apagar, só o Mateus. Verifica: o comentário no cartão traz a lista e a proposta.

  Verificado em 13/10, no comentário do cartão:
  - uns 40 MB que não são do portal, com nomes de dado real de um sistema anterior: clientes, processos, `acessos_gov` e credenciais;
  - ninguém escreve desde 24 e 25/08, e a API pública do Supabase não tem acesso;
  - a proposta: confirmar com o Pedro, exportar e apagar, trocar as chaves, e tratar `acessos_gov` como incidente se houver senha do gov.br fora do cofre.
- [ ] 2.11 Main protegida (P2.9): combinada com o Pedro e aplicada pelo `gh`. Verifica: um pedido sem aprovação não mescla.
- [x] 2.12 CodeQL (P2.10): reconferir `textoDoHtml` (`apps/api/src/vigilia/fontes.ts`) e dispensar os 2 alertas com o motivo, pelo `gh`. Verifica: a aba de alertas fica sem os 3 (o da regex fecha com o merge do #62).

  Verificado em 13/10:
  - o da regex lenta fechou com o #62;
  - os 2 de `textoDoHtml` foram dispensados como falso positivo, com o motivo: o resultado é texto, mostrado como texto, e nunca volta a ser HTML.
  - Havia um quarto, num teste de tela (`seguranca.e2e.ts`): a regex escapava só o ponto. Agora escapa todo caractere especial; vai no #71 e fecha no merge.
- [ ] 2.13 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-158 · Correções da revisão do #62 e do #63 (12/10)

- [x] 2.14 P1.3 · A CSP com `frame-src 'self' blob:` (`apps/api/src/servidor.ts`), para a impressão do kit em PDF; teste em `servidor.test.ts` que confere a diretiva. Verifica com `pnpm --filter @ggv/api exec vitest run src/servidor.test.ts`.
- [x] 2.15 P1.1 · Em produção, o `RELACIONAMENTO_SIMULADO=entrega` não vale (`apps/api/src/rotas/mensagens.ts`); teste em `rotas/mensagens.test.ts`. Verifica com `pnpm --filter @ggv/api exec vitest run src/rotas/mensagens.test.ts`.
- [x] 2.16 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-158 · Parte 3 · Caminho da Maria no servidor real (13/10)

Só servidor, com teste junto; as telas são do Pedro. Sem migração nem matriz nova. Na ordem contrato → teste → servidor.

- [x] 3.1 G1 com o contrato da Recepção (P3.1).
  - Em `apps/web/src/regras/checklist.ts`, a regra `contratoConferidoDo` (etapa `copia` ou `entregue`), com teste.
  - Em `apps/api/src/rotas/conferencia.ts`, o `kitAssinado` passa a valer também pelo contrato da Recepção conferido.
  - Verifica com `rotas/conferencia.test.ts`: o caso da Recepção com o contrato conferido é aprovado; com o contrato na leitura, a aprovação recusa com o G1.
- [x] 3.2 A liberação com o G1 inteiro (P3.2): `CasoParaLiberacao` com o `kitAssinado`, e a rota de liberação usando o `bloqueioDoG1`. Verifica com `rotas/conferencia.test.ts`: o kit não cadastrado e o contrato não conferido recusam, com o G1 no histórico.
- [x] 3.3 O percentual do modelo, contrato (P3.3): em `packages/contratos`, o `percentualHonorarios` de cada modelo em `ModelosDoEscritorio` e o `PercentualDoModelo` (de 0 a 100, até 2 casas). Verifica com o teste do contrato.
- [x] 3.4 O percentual do modelo, servidor (P3.3): `PUT /api/configuracao/modelos/:id/honorarios`, só da Sênior (`modelo.subir`), guardado na `configuracao` com o histórico; o `GET` dos modelos devolve o percentual. Verifica com `rotas/modelos.test.ts`.
- [x] 3.5 O contrato guarda o percentual (P3.3): ao gerar o kit, o contrato da Recepção guarda o percentual do modelo usado; sem percentual cadastrado, o kit sai, e o contrato fica sem. Verifica com `rotas/recepcao-contrato.test.ts`.
- [x] 3.6 A prestação lê e compara (P3.3): o `GET` devolve o percentual do contrato da Recepção (ou da tabela `contrato`, na semente), e o `POST` recusa um percentual diferente do contrato. Verifica com `rotas/prestacao.test.ts`.
- [x] 3.7 O CNIS digitado, contrato (P3.4).
  - Em `packages/contratos`, o `CnisDigitado`: a origem, a data da extração e a entrada do `calcularCnis` (`EntradaCalculoCnis`), que o Pedro já fez.
  - Sem regra nova: o cálculo é o `calcularCnis` (decisão 23).
  - Verifica com o teste do contrato.
- [x] 3.8 Guardar o CNIS (P3.4).
  - `PUT /api/entrevistas/:id/cnis`, do advogado do atendimento (`ficha.analisar`), roda o `calcularCnis`. Com erro, recusa com os erros dele; sem erro, grava na ficha a entrada, o resultado, quem e quando, e o histórico.
  - `GET /api/entrevistas/:id/calculo` devolve o CNIS guardado e o resultado.
  - Verifica com `rotas/recepcao-decisoes.test.ts`.
- [x] 3.9 O cálculo do servidor (P3.4).
  - O `POST /api/entrevistas/:id/calculo` usa o tempo, os pontos e a carência do resultado guardado (o número da tela não vale). A regra e o "já pode se aposentar" vêm do advogado.
  - Com competência pendente, recusa. O cálculo registrado libera o "Sim, fechou". A semente segue com o CNIS de exemplo.
  - Verifica com `rotas/recepcao-decisoes.test.ts`.
- [x] 3.10 A Sênior vê o cálculo (P3.5): `CasoParaConferencia` com o último cálculo (tempo, pontos, carência, regra, se pode aposentar, quem e quando). Verifica com `rotas/conferencia.test.ts`.
- [x] 3.11 A equipe real (P3.6): `GET /api/equipe?perfis=advogada,senior`, para quem marca (`ficha.editar`), devolve o id e o nome dos usuários ativos com o perfil. Verifica com `rotas/recepcao-agenda.test.ts`.
- [x] 3.12 Quem atende fica guardado (P3.6).
  - A marcação aceita o id de um usuário da equipe real e guarda o `comId` e o nome. O id do catálogo fixo segue aceito até a tela mudar.
  - O filtro "só as minhas" é da tela, pelo `comId`.
  - Verifica com `rotas/recepcao-agenda.test.ts`.
- [x] 3.13 A desistência antes da entrevista (P3.7).
  - `ResultadoDoCompromisso` aceita "desistiu", com o motivo da lista (G16) e o recontato opcional; sem motivo, recusa.
  - Com recontato, "Recontatar lead" vai à agenda na data; sem recontato, o lead é arquivado com o motivo.
  - Verifica com `rotas/recepcao-agenda.test.ts`.
- [x] 3.14 O bairro na ficha (P3.8): `EdicaoDaFicha` aceita o `bairro`, e o PATCH grava. Verifica com `rotas/recepcao.test.ts`.
- [x] 3.15 Avisar o Pedro: o pedido lista os contratos novos que as telas usam (cálculo, percentual na Configuração, equipe da agenda, desistência e liberação).

  Feito no #71, na seção "Para o Pedro ligar nas telas".
- [x] 3.16 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

  Verificado em 13/10:
  - typecheck e lint sem erro;
  - contratos 171/171;
  - tela 1653/1653, em 197 arquivos;
  - API 854/854 (3 pulados), em 97 arquivos;
  - Playwright 260/260.

  O "Agora ok?" foi para o relatório final ao Mateus.

## GGVP-158 · Parte 4 · Recepção sem simulação (13/10)

Só servidor, com teste junto; as telas são do Pedro. Branch `feat/GGVP-158-parte-4`, em cima do #71. A migração 0031 sai no fim, sobre a main mais nova. Na ordem contrato → teste → servidor.

- [x] 4.1 A IA com o arquivo (P4.1, decisão 27).
  - O `Pedido` de `ia.ts` ganha o anexo (imagem ou PDF), que vai na mensagem ao modelo.
  - A sugestão pronta conta o hash do arquivo; o registro fica sem o conteúdo.
  - O `limpar` roda antes do registro.
  - Verifica com `ia/ia.test.ts`: o corpo do pedido leva o arquivo, o registro não, e o `limpar` roda antes de guardar.
- [x] 4.2 A leitura do balcão, contrato (P4.1): em `packages/contratos`, o JSON que a IA devolve (`LidoPelaIa`); em `ia.ts`, a finalidade `ler_documento_balcao`. Verifica com o teste do contrato.
- [x] 4.3 A leitura do balcão, servidor (P4.1): `lerDoBalcao` monta a `DocumentoLido` com as regras do código (decisão 29); sem IA, o documento fica a conferir com confiança zero.
  - Verifica com teste:
    - o CNIS lido pelo conteúdo;
    - o nome do arquivo que não conta;
    - o CPF inválido de fora;
    - sem IA.
- [x] 4.4 A leitura na chegada do conteúdo (P4.1): `POST /api/fichas/:id/arquivos/conteudo` lê o arquivo, e o anúncio não lê. Verifica com `rotas/recepcao-documentos.test.ts`.
- [x] 4.5 A leitura de exemplo só no teste (P4.10).
  - `LEITURA_SIMULADA=sim` liga o leitor de exemplo e as rotas simuladas.
  - O servidor recusa subir com ela na homologação e na produção.
  - O Playwright passa a ligá-la.
  - Verifica com `servidor.test.ts` e com o Playwright.
- [x] 4.6 A ficha em papel (P4.2): a rota recebe o arquivo e o guarda em Documentos pessoais; a IA lê (`ler_ficha_atendimento`), e a senha vai ao cofre.
  - Verifica com `rotas/recepcao.test.ts`:
    - a senha fica no cofre e fora da resposta, da ficha, do histórico e do registro da IA;
    - sem o arquivo, recusa;
    - sem IA, tudo volta como não lido.
- [x] 4.7 A segunda ficha em papel (P4.2): o mesmo, com `ler_segunda_ficha`, e a seção médica só em `segunda_ficha_medica`. Verifica com `rotas/recepcao-segunda-ficha.test.ts`.
- [x] 4.8 O Drive lê as mudanças e baixa o arquivo (P4.3): `drive.mudancas(marca)` e `drive.baixar(id)`. Verifica com `drive.test.ts`, com o fetch de mentira.
- [x] 4.9 A rodada do scanner (P4.3, decisão 32): `olharOScanner`.
  - Verifica com teste:
    - o arquivo novo na pasta ligada entra e é lido;
    - a mesma mudança não repete;
    - o do portal e o de "A REVISAR" ficam fora;
    - a pasta de duas fichas não é ligada;
    - o lote vai à tarefa "Receber documento".
- [x] 4.10 Ligar a rodada (P4.3): em `principal.ts`, junto da rodada do Drive, só com o Drive ligado e sem só leitura. Verifica com o teste da condição.
- [x] 4.11 ADR-017 (P4.3): o scanner pelo Drive, por quê e o que custa. Verifica: o arquivo em `docs/decisoes/`.
- [x] 4.12 O contrato assinado guardado (P4.4): a digitalização recebe o arquivo e o guarda como documento do caso; `GET .../contrato/assinado` devolve o arquivo. Verifica com `rotas/recepcao-contrato.test.ts`.
- [x] 4.13 A leitura do contrato (P4.4): `ler_contrato_assinado`, com a lista do kit; a regra de hoje decide; sem IA, vai à conferência com o motivo. Verifica com `rotas/recepcao-contrato.test.ts`.
- [x] 4.14 Sem ZapSign (P4.5): saem as rotas e a opção, e o serviço responde sempre `zapsign: false`. Verifica com `rotas/recepcao-contrato.test.ts`: com a variável, a rota não existe e o serviço diz falso.
- [x] 4.15 Um catálogo só, contrato (P4.6): os 34 com o id do servidor; `BENEFICIOS` e os mapas saem dele. Verifica com o teste do contrato: 34 mais "outro", e os 11 ids de hoje iguais.
- [x] 4.16 O catálogo no banco (P4.6): a migração 0031 com o CHECK.
  - Verifica com teste:
    - o caso da aposentadoria rural guarda o benefício;
    - a lista publicada vale no checklist;
    - sem lista, a liberação recusa.
- [x] 4.17 Só o conferido vai ao Drive (P4.7): o filtro na rodada. Verifica com `fluxo/arquivar.test.ts`.
- [x] 4.18 A pasta do cliente (P4.7): as pastas parecidas na criação da ficha, e `POST /api/fichas/:id/pasta`. Verifica com teste, com o Drive de mentira: liga; cria com CPF; recusa sem CPF e com o Drive só leitura.
- [x] 4.19 A cobrança na mensagem (P4.8). Verifica com o teste das mensagens: na Sênior, recusa; dentro do limite, sai.
- [x] 4.20 O caso escolhido no envio (P4.9). Verifica com `rotas/recepcao-documentos.test.ts`: com dois casos, sem escolher, recusa; com o caso escolhido, o documento vai a ele.
- [x] 4.21 O documento de antes do caso (P4.9). Verifica com `rotas/recepcao-contrato.test.ts`: o laudo de antes entra no caso que nasce e vira documento médico.
- [x] 4.22 As variáveis (P4.5, P4.10): a lista das variáveis do servidor sem `ZAPSIGN_API_TOKEN` e com `LEITURA_SIMULADA`. Verifica com `variaveis.test.ts`.
- [x] 4.23 Avisar o Pedro: o pedido lista o que muda para as telas.

  Feito no pedido da parte 4, na seção "Para o Pedro ligar nas telas".
- [x] 4.24 Rodar typecheck, lint, testes e Playwright; colar a saída; relatório final ao Mateus.

  Verificado em 13/10:
  - typecheck dos quatro pacotes sem erro, e lint sem erro (os 3 avisos da tela já existiam);
  - contratos 177/177;
  - tela 1653/1653, em 197 arquivos;
  - API 887/887 (3 pulados), em 100 arquivos. Na suíte inteira, 25 testes estouraram o tempo pela carga da máquina; repetidos sem carga, passaram. A única falha de verdade foi o glossário, que agora recebe os 23 benefícios novos na 0031;
  - Playwright 260/260.

## GGVP-158 · Parte 5 · Perícia, INSS e Justiça (13/10)

Só servidor, com teste junto; as telas são do Pedro. Branch `feat/GGVP-158-parte-5`, em cima do #74. Sem migração nem matriz nova. Na ordem contrato → teste → servidor.

- [x] 5.1 A orientação, o lembrete e a cobrança da perícia conferem a mensagem (P5.1, decisão 40): `mensagemId` opcional em `OrientacaoAoCliente` e em `MensagemConferida`; a rota acha a mensagem da pessoa, do modelo e do texto e recusa a que não saiu.
  - Verifica com `rotas/pericia.test.ts`:
    - a mensagem entregue registra;
    - a que não saiu recusa;
    - sem envio, recusa;
    - a ligação segue sem mensagem.

  Verificado em 13/10: `rotas/pericia.test.ts` 29/29, com os 3 novos de P5.1.
- [x] 5.2 O perito pelo nome (P5.2, decisão 41): `perito` na leitura da IA e na classificação; `peritoPeloNome` acha ou cria; a nomeação liga à perícia aberta.
  - Verifica com `rotas/publicacoes.test.ts` e `justica.test.ts` (contratos):
    - o perito novo nasce e liga;
    - a grafia conhecida não cria outro;
    - sem perícia aberta, nasce médico e fica no histórico.

  Verificado em 13/10: `rotas/publicacoes.test.ts` 23/23 (4 novos) e contratos `justica.test.ts` 24/24 (1 novo). A instrução da IA foi à versão 5.
- [x] 5.3 A pergunta de um clique com o nome novo (P5.2): `PeritoEscolhido` aceita `nome`, também no perito do laudo. Verifica com `rotas/pericia.test.ts`: o perito nasce e fica ligado à perícia.

  Verificado em 13/10, no teste de P5.2 de `rotas/pericia.test.ts` (sem nome nem id, 400).
- [x] 5.4 O perfil laudo a laudo (P5.2): o laudo da perícia social entra no perfil do perito. Verifica com `rotas/pericia.test.ts`.

  Verificado em 13/10: o mesmo teste leva a perícia social até o resultado, e o perfil da perita nova ganha o laudo.
- [x] 5.5 Os limites por parâmetro, nas regras (P5.3, decisão 42): cobrança, confirmação e remarcação recebem os limites, com os números do Lucas como padrão; no servidor, a remarcação é 1 sem nada salvo.
  - Verifica com os testes das regras:
    - com 3 tentativas, a segunda sem resposta não sobe;
    - com prazo externo, a próxima fica no dia antes.

  Verificado em 13/10: regras da tela 363/363 (3 testes novos). A remarcação lê `limiteDeRemarcacoes` da própria perícia, que o servidor põe a cada leitura. A regra comum segue com 2 na tela de exemplo: passar a 1 quebrava 8 testes de tela do Pedro.
- [x] 5.6 Os limites lidos da Configuração (P5.3): os parâmetros novos da confirmação; o servidor lê os quatro laços; `emUso` na Configuração.
  - Verifica com teste:
    - a cobrança da Recepção usa o limite salvo;
    - a confirmação também;
    - a remarcação sobe na segunda;
    - os de `contato.*` voltam `emUso: false`.

  Verificado em 13/10: `configuracao`, `recepcao-agenda` e `recepcao-checklist` 30/30, e `pericia` 31/31 (um novo em cada).
- [x] 5.7 A espera de fora (P5.4, decisão 43): as linhas da espera na Central da advogada, urgentes no dia útil; `POST /api/casos/:id/esperas/olhada`.
  - Verifica com teste:
    - INSS decidindo, no topo na terça;
    - fora do topo depois de "Olhei" e no sábado;
    - a perícia feita sem resultado também;
    - sem linha repetida com a "Trazer a resposta do INSS".

  Verificado em 13/10: `rotas/inss.test.ts` 13/13 (2 novos), e as nove suítes que leem a Central, 122/122. O "Olhei" vale para o caso inteiro: a tela não precisa saber o id da espera.
- [x] 5.8 A data do juiz na hora (P5.5, decisão 44): a exigência do juiz marca a perícia com a data da publicação, sem a tarefa de marcar; o resumo do processo diz `marcadaPeloSistema`.
  - Verifica com `rotas/exigencia-juiz.test.ts` e `rotas/processo.test.ts`:
    - com a data, a perícia marcada, sem tarefa de marcar, e a orientação "pelo sistema";
    - sem a data, a tarefa de marcar.

  Verificado em 13/10: `rotas/pericia.test.ts` 33/33 (2 novos), `rotas/processo.test.ts` 8/8 e `rotas/exigencia-juiz.test.ts`. A tarefa de marcar já fechava na distribuição; faltava a data na linha antes de alguém abrir a tela, e o aviso no resumo. `marcadaPeloSistema` é opcional no contrato porque um teste de tela do Pedro monta o resumo à mão.
- [x] 5.9 O item sem documento (P5.6, decisão 45): `semSaida` em `EncerrarSemProva`; a rota pede a dilação, a remarcação ou o porquê.
  - Verifica com `rotas/manifestacao.test.ts`:
    - sem nada, recusa;
    - com a dilação autorizada, encerra;
    - com o `semSaida`, encerra e guarda o porquê.

  Verificado em 13/10: `rotas/manifestacao.test.ts` 15/15 (3 novos; os de antes passam a dizer o porquê). O histórico guarda `tentou` (`dilacao`, `reagendamento` ou nulo) e o `semSaida`.
- [x] 5.10 Encerrar e liberar (P5.7, decisão 46).
  - Verifica com `rotas/vigilia.test.ts` e `rotas/conferencia.test.ts`:
    - o caso já despachado não encerra;
    - liberar de novo cancela o protocolo aberto, e o OK antigo não vale.

  Verificado em 13/10: `rotas/vigilia.test.ts` 10/10 e `rotas/conferencia.test.ts` (um novo em cada), com `inss` e `indeferimento`, 62/62. A tela da vigília também só oferece encerrar com o despacho esperando.
- [x] 5.11 Tribunal e assinatura, rotas (P5.8, decisão 47): `PUT /api/configuracao/tribunais` e `/assinatura`; o `GET` devolve os dois.
  - Verifica com `rotas/configuracao.test.ts`:
    - a Sênior salva, e fica no histórico;
    - o Atendimento recusa;
    - o tamanho fora da faixa recusa.

  Verificado em 13/10: `rotas/configuracao.test.ts` 7/7 (2 novos).
- [x] 5.12 A trava do pacote (P5.8, P5.9): falha sem tribunal e com a assinatura a completar; o protocolo recusa sem tribunal; o PDF não usa a assinatura "a configurar".
  - Verifica com `fluxo/travas.test.ts` e `rotas/peticao.test.ts`.

  Verificado em 13/10: `rotas/peticao.test.ts` 32/32 (2 novos; os de antes cadastram a assinatura de teste) e `fluxo/travas.test.ts`.
- [x] 5.13 O alarme da vigília (P5.10, decisão 48): a rodada presa vira falha; sem fonte na produção, a linha da Sênior e o alarme do dia; `avisarSuporte`, com o canal e o Jira.
  - Verifica com teste, com o fetch de mentira:
    - a presa;
    - o sem fonte, uma vez por dia;
    - a falha de qualquer tipo chama o canal e o Jira uma vez, sem texto de publicação;
    - a falha do Jira não derruba a rodada.

  Verificado em 13/10: `suporte.test.ts` 4/4, `vigilia/rodadas.test.ts` 10/10 (4 novos) e `rotas/vigilia-diario.test.ts`, 19/19. O teste antigo do "não rodou" passou a manter a fonte na segunda batida: sem fonte, agora é outro alarme.
- [x] 5.14 ADR-018 (P5.10): o alarme ao suporte pelo canal e pelo Jira, e o que cada variável liga. Verifica: o arquivo em `docs/decisoes/`.

  Feito em 13/10: `docs/decisoes/ADR-018-alarme-ao-suporte.md`, na lista do README.
- [x] 5.15 As variáveis (P5.10): as cinco `ALARME_*` na lista das variáveis do servidor e no documento da homologação.
  - Verifica com `variaveis.test.ts`.
  - O `.env.example` é do Mateus: a regra do repositório não deixa o agente ler nem editar `.env*`.

  Verificado em 13/10: `variaveis.test.ts` 4/4, com os cinco nomes que o Mateus pôs no arquivo de exemplo e a tabela da homologação.
- [x] 5.16 Feriados (P5.11, decisão 49): a carga aceita o ano; a linha "Carregar os feriados de <ano>" na Central da Sênior.
  - Verifica com `rotas/feriados.test.ts` e o teste da Central:
    - dezembro sem o ano seguinte mostra a linha;
    - a carga de 2028 entra, e a linha some.

  Verificado em 13/10: `rotas/feriados.test.ts` 5/5 (1 novo). A linha só aparece com a lista já em uso: a tabela vazia é a carga ao subir.
- [x] 5.17 Jurimetria no texto, regra (P5.12, decisão 50): `numeroDeJurimetriaNoTexto` em `packages/contratos`.
  - Verifica com o teste do contrato:
    - os formatos do G22 acusam;
    - o percentual de lei, o entendimento e o processo de exemplo passam;
    - o texto grande roda em tempo linear.

  Verificado em 13/10: contratos `ia.test.ts` 7/7 (3 novos).
- [x] 5.18 Jurimetria no texto, servidor (P5.12): a aprovação da petição, da manifestação e da dilação recusa e registra o G22. Verifica com `rotas/peticao.test.ts` e `rotas/manifestacao.test.ts`.

  Verificado em 13/10: `rotas/peticao.test.ts` 33/33 e `rotas/manifestacao.test.ts` 18/18 (4 novos). A manifestação e a dilação são lidas pela IA na aprovação; sem ela, aprovam com o aviso.
- [x] 5.19 A jurimetria só com `estudo.ver` (P5.13, decisão 51): os recortes do painel e a `visao` da perícia.
  - Verifica com `rotas/gestao.test.ts` e `rotas/pericia.test.ts`:
    - o líder do Atendimento e o Financeiro recebem 403 no recorte por perito;
    - a Documentação recebe a perícia sem os números.
  - 13/10, na revisão do #75 (junto com a main, que trouxe a mesma regra pelo #73, GGVP-156): fica uma trava só, a da
    GGVP-156 (perito, juízo, vara e tese). Na perícia, o perito segue para todos, sem os números e sem o resumo.
- [x] 5.19.1 A taxa por advogada só dos sócios (decisão do Mateus, 13/10): a ação `resultados.ver_por_advogada` (`socio`) na
  matriz 31; o servidor recusa o recorte por advogada sem ela, e a tela não o oferece.
  - Verifica com `rotas/gestao.test.ts` (a Sênior, a líder e o Financeiro recebem 403; o Sócio, 200) e `Resultados.test.tsx`.

  Verificado em 13/10: `rotas/gestao.test.ts` e `rotas/pericia.test.ts`, 42/42. Fora de `estudo.ver`, a perícia vem sem o perfil do perito (os números e o resumo); o teste antigo, que dizia que a Documentação via os números, mudou com a regra.
- [x] 5.20 O juízo com o juiz e o perito (P5.14, decisão 52); o resumo do processo com a vara, o juiz e o perito.
  - Verifica com `rotas/juizo.test.ts` e `rotas/processo.test.ts`:
    - dois casos com o mesmo juiz e perito contam 2;
    - o resumo do Atendimento sem números.

  Verificado em 13/10: `rotas/juizo.test.ts` 6/6 e `rotas/processo.test.ts` 9/9 (um novo em cada). O juízo ganhou `casosDoJuiz` e `perito`, sem mudar o `juiz` que a tela já usa; a vara e o juiz entram no resumo como opcionais, porque um teste de tela do Pedro monta o resumo à mão.
- [x] 5.21 O protocolo do recurso (P5.15, decisão 53): `POST /api/casos/:id/recurso/protocolo`.
  - Verifica com `rotas/recurso.test.ts`:
    - fecha a tarefa e guarda o comprovante;
    - sem tarefa, recusa;
    - a data depois de hoje recusa.

  Verificado em 13/10: `rotas/recurso.test.ts` 6/6 (1 novo).
- [x] 5.22 O padrão ao subir (P5.8): o tribunal e a assinatura do banco novo, só o que faltar, em `principal.ts`, como os feriados (sem migração). Verifica com teste: o banco novo tem os dois; o banco com a chave guarda o que tinha.

  Verificado em 13/10, no teste de `rotas/configuracao.test.ts`.
- [x] 5.23 Avisar o Pedro: o pedido lista o que muda para as telas, rota por rota.

  Feito no pedido da parte 5, na seção "Para o Pedro ligar nas telas".
- [x] 5.24 Rodar typecheck, lint, testes e Playwright; colar a saída; relatório final ao Mateus.

  Verificado em 13/10:
  - typecheck dos quatro pacotes sem erro, e lint sem erro (os 3 avisos da tela já existiam);
  - contratos 181/181 e `campos` 11/11;
  - tela 1656/1656, em 197 arquivos;
  - API 927 de 928 na suíte inteira (3 pulados), em 101 arquivos. A única falha foi a das variáveis, que rodou antes de o Mateus pôr os cinco nomes; depois, sozinha, 4/4;
  - Playwright 260/260;
  - `openspec validate --all --strict`, 16/16.

## GGVP-158 · Parte 6 · Desfecho, dinheiro e conversa (13/10)

Só servidor, com teste junto; as telas são do Pedro. Branch `feat/GGVP-158-parte-6`, em cima do #75; o #31 segue no pedido dele. Migração 0033 (a 0032 é a do recurso, que veio da main). Na ordem contrato → teste → servidor.

- [x] 6.1 O pedido #31 (P6.1, decisão 54): juntar a main na branch dele (merge, sem rebase), o texto da decisão só com `dado_saude.ver_detalhe`, e sair do rascunho para o Pedro.
  - Verifica com `rotas/desfecho.test.ts`:
    - a advogada lê o texto;
    - o Atendimento e a Documentação recebem o desfecho sem o texto.

  Feito pela outra sessão: o #31 entrou na main (63bf6254) com o texto da decisão só para quem vê dado de saúde. Verificado aqui em 13/10: `rotas/desfecho.test.ts` 8/8.
- [x] 6.2 A migração 0033 (decisões 56, 58 e 64): as colunas da prestação, `mensagem.chatwoot_mensagem_id`, `tarefa.caso_id` sem obrigação, `tarefa.pessoa_id` com o CHECK, `tarefa.atendimento_id`, e as pendências abertas viram linha.
  - Verifica com `banco/migracoes.test.ts` e com teste da migração:
    - a tarefa sem caso e sem pessoa é recusada;
    - a pendência aberta ganha a linha, ligada à conversa.

  Verificado em 13/10: `banco/migracoes.test.ts` 15/15 (2 novos). A última instrução da migração leva as pendências abertas para a tabela e roda de novo sem repetir. Depois, ela ganhou `tarefa.atendimento_id` (a conversa da tarefa), no lugar do id da tarefa guardado na conversa. Com a main da parte 5 (o #73 trouxe a 0032 do recurso), ela virou a 0033.
- [x] 6.3 A tarefa com `casoId` nulo (decisão 64): os usos conferidos pelo typecheck, e a Central geral sem a linha sem caso. Verifica com o typecheck e as suítes que leem a Central.

  Verificado em 13/10: o typecheck da API pegou 4 usos (Central e Financeiro), corrigidos; `rotas/inss.test.ts` e `rotas/financeiro.test.ts`, 17/17. A Central geral lê o caso pela junção e deixa de fora as linhas `D5`.
- [x] 6.4 O combinado no contrato (P6.2, decisão 55): `AcordoDoContrato` e `EnvioDoContrato.acordo`; a geração guarda e escreve no histórico.
  - Verifica com o teste do contrato e com `rotas/recepcao-contrato.test.ts`:
    - o combinado fica no contrato;
    - o valor errado recusa sem gerar;
    - gerar de novo sem ele mantém.

  Verificado em 13/10: contratos `prestacao.test.ts` (o combinado) e `rotas/recepcao-contrato.test.ts` 28/28 (1 novo): o combinado fica no contrato e no histórico, a versão 2 mantém, e o valor errado recusa sem kit novo.
- [x] 6.5 A regra da prestação (P6.3, decisão 56): `calcularPrestacao` com os honorários ajustados; `SalvarPrestacao` com a entrada, as parcelas e a parte na Caixa; Pix e boleto.
  - Verifica com o teste do contrato:
    - fecha em centavos, com e sem ajuste;
    - honorários acima do recebido recusam;
    - a parte na Caixa acima dos honorários recusa;
    - "dinheiro" recusa.

  Verificado em 13/10: contratos `prestacao.test.ts` e `calculo-prestacao.test.ts`, 15/15 (4 novos). A lista `FORMAS_DE_PAGAMENTO` fica com as quatro para ler as versões antigas e para não quebrar o teste de tela do Pedro, que conta as opções; a prestação nova aceita só `FORMAS_ACEITAS` (Pix e boleto).
- [x] 6.6 A prestação no servidor (P6.3): o `GET` com o combinado e as fontes; o `POST` grava os valores novos e as fontes.
  - Verifica com `rotas/prestacao.test.ts`:
    - abre com o contrato;
    - o ajuste fica com a fonte de quem conferiu, e o histórico com os dois valores;
    - o contrato sem o combinado vem nulo.

  Verificado em 13/10: `rotas/prestacao.test.ts` 29/29 (4 novos): abre com o combinado; as fontes do contrato, da carta e do sistema; o ajuste com a fonte de quem conferiu e o histórico com os dois valores; a forma antiga e a Caixa acima dos honorários recusam.
- [x] 6.7 A ida ao banco (P6.4, decisão 57): telefone e WhatsApp; o WhatsApp só depois da ligação, pelo correio, com o texto aprovado.
  - Verifica com `rotas/prestacao.test.ts` e `rotas/mensagens.test.ts`:
    - a ligação registra como hoje;
    - o WhatsApp antes da ligação recusa;
    - o que não saiu recusa e fica no histórico;
    - o que saiu fica na lista do cliente.

  Verificado em 13/10: `rotas/prestacao.test.ts` 31/31 (2 novos; os de antes avisam pela ligação) e `rotas/mensagens.test.ts`. O WhatsApp antes da ligação recusa; sem o Chatwoot, 409 com o motivo, a tentativa no histórico e fora dos avisos; com ele, sai pela conversa aberta, com o texto aprovado e o aviso da senha.
- [x] 6.8 O modelo ao subir (P6.4): `garantirModeloDaIdaAoBanco`. Verifica com teste: o banco novo ganha o modelo, e o mudado pela Sênior fica.

  Verificado em 13/10, no teste de `rotas/prestacao.test.ts`: o banco sem o modelo ganha o padrão; o desligado pela Sênior fica, e nada entra.
- [x] 6.9 O id do Chatwoot (P6.5, decisão 58): `enviar` devolve o id, e o correio grava. Verifica com `chatwoot.test.ts` e `rotas/mensagens.test.ts`.

  Verificado em 13/10: `rotas/mensagens.test.ts` (o envio guarda o id 9001 do Chatwoot) e o complemento da ida ao banco (o id 77). O cliente do Chatwoot não tem teste próprio: o fetch de mentira das rotas cobre o `enviar`.
- [x] 6.10 A rota de entrada (P6.5, decisão 59): o segredo, o log, a conta, a caixa e a trava da homologação.
  - Verifica com `rotas/chatwoot-entrada.test.ts`:
    - sem a variável e com outro segredo, 404;
    - outra conta ou caixa, ignorada;
    - fora da lista de teste, ignorada;
    - o endereço não vai ao log.

  Verificado em 13/10: `rotas/chatwoot-entrada.test.ts` (3 testes da rota): sem a variável e com outro segredo, 404; outra conta, outra caixa, nota privada, atividade, texto vazio e telefone fora da lista, 200 sem gravar nada; num servidor com o log ligado, o segredo não aparece. A trava de sessão de `/api` libera só esta rota, além de entrar: `sessao/rotas.test.ts` e `servidor.test.ts`, 36/36.
- [x] 6.11 A mensagem vira conversa (P6.5, decisão 60): a pessoa pelo telefone, o lead novo, a conversa que junta as mensagens e a resposta do escritório.
  - Verifica com `rotas/chatwoot-entrada.test.ts`:
    - a cliente conhecida;
    - o telefone novo vira lead;
    - 30 minutos depois, outra conversa;
    - mãe e filha no mesmo número.

  Verificado em 13/10: `rotas/chatwoot-entrada.test.ts` (6 testes): a cliente conhecida, com o celular sem o nono dígito, e a resposta do escritório na mesma conversa; o aviso repetido não entra; a senha sai do texto; o lead novo com o nome do contato (e "Contato do WhatsApp" com emoji); a resposta a um número sem ficha não cria lead; mãe e filha no mesmo número.
- [x] 6.12 A entrega e a leitura (P6.5): `message_updated` muda o status pelo id do Chatwoot, só para a frente. Verifica com `rotas/chatwoot-entrada.test.ts`.

  Verificado em 13/10, em `rotas/chatwoot-entrada.test.ts`: o aviso de mudança não traz o status (conferido no código do Chatwoot), e o portal pergunta; entregue, depois lida, e não volta; a mensagem que o portal não mandou não pergunta nada.
- [x] 6.13 A conversa do WhatsApp fecha e a IA lê (decisão 61).
  - Verifica com teste, com a IA de mentira:
    - a rodada fecha a conversa parada e analisa;
    - sem IA, a mensagem seguinte fecha a anterior, com o aviso;
    - nasce a tarefa do Atendimento.

  Verificado em 13/10, em `rotas/chatwoot-entrada.test.ts`: com a IA de mentira, a rodada fecha a conversa parada e a IA aponta o endereço dito; o Atendimento responde a pendência, e a Sênior confirma, e a ficha muda; sem a IA, a mensagem 30 minutos depois fecha a anterior, com o motivo, e nasce a conferência do Atendimento.
- [x] 6.14 ADR-019 e a variável (decisão 66): o documento, e `CHATWOOT_WEBHOOK_SEGREDO` na lista das variáveis e na doc da homologação.
  - Verifica com `variaveis.test.ts`.
  - O `.env.example` é do Mateus.

  Verificado em 13/10: `variaveis.test.ts` 4/4, com o nome que o Mateus pôs no arquivo de exemplo e a linha da doc da homologação. O ADR-019 está em `docs/decisoes/`, na lista do README.
- [x] 6.15 Só o que foi dito (P6.6, decisão 62): `apareceNaFala` e o filtro em `lerComIa`.
  - Verifica com o teste da regra e com `rotas/transcricao-conversa.test.ts`:
    - o endereço que não foi dito sai;
    - o telefone e a data ditos de outro jeito passam;
    - o fato novo segue.

  Verificado em 13/10: `regras/conversa-fala.test.ts` 6/6 (novo, com o texto grande em tempo linear) e `rotas/transcricao-conversa.test.ts` 8/8: o contato de apoio que não aparece na fala sai; o telefone que não foi dito também, e o id dos itens segue a lista que ficou.
- [x] 6.16 A Sênior confere (P6.6, decisão 63): a primeira conferência só com a pendência; as decisões só com `ficha.voltar_versao`; a tarefa `D5.04` da Sênior.
  - Verifica com `rotas/conversa.test.ts`:
    - a atendente que decide recebe 403;
    - a Sênior decide, e a tarefa fecha;
    - a conversa do WhatsApp, pelo Atendimento.

  Verificado em 13/10: `rotas/conversa.test.ts` 12/12 e `rotas/transcricao-conversa.test.ts` 8/8. A atendente que decide recebe 403 (e a recusa fica no histórico, portão `conferencia_da_senior`); a Sênior decide os cinco itens, e a tarefa dela fecha. A conversa do WhatsApp, pelo Atendimento, fica no teste da tarefa 6.13.
- [x] 6.17 O Playwright da conversa com a Sênior conferindo (decisão 63). Verifica com o Playwright da conversa.

  Verificado em 13/10: Playwright 260/260, com o da conversa. Ele não precisou mudar: usa a conversa só escrita, sem item da IA, e quem conduziu confere sem decidir nada.
- [x] 6.18 A pendência vira tarefa (P6.7, decisão 64): a linha na conferência, fechada na cumprida, com o prazo novo; a Central da conversa lê as linhas.
  - Verifica com `rotas/conversa.test.ts`:
    - o lead sem caso;
    - cumprida e prazo novo;
    - a Central sem ler todas as conversas.

  Verificado em 13/10: `rotas/conversa.test.ts` (1 novo): a pendência do lead sem caso é tarefa da pessoa e aparece na Central da responsável, não na geral; o prazo novo e o "cumprida" mudam a linha. A Central da conversa lê as linhas da tarefa e, para o "Registrar conversa", só as conversas de quem está no login.
- [x] 6.19 A verificação na conversa (P6.8, decisão 65): a rota, a regra do canal e o uso na conferência.
  - Verifica com `rotas/conversa.test.ts`:
    - a ligação com vídeo muda o telefone;
    - "no escritório" na ligação recusa;
    - sem verificação, recusa e fica no histórico.

  Verificado em 13/10, no teste da conferência de `rotas/conversa.test.ts`: "no escritório" na ligação recusa, na rota e na conferência, e fica no histórico; com a chamada de vídeo registrada pela Ana, a Sênior muda o telefone em contrato novo, e a verificação fica na conversa.
- [x] 6.20 Avisar o Pedro: o pedido lista o que muda para as telas, rota por rota.

  Feito no pedido da parte 6 (#78), na seção "Para o Pedro ligar nas telas", rota por rota.
- [x] 6.21 Rodar typecheck, lint, testes e Playwright; colar a saída; relatório final ao Mateus.

  Verificado em 13/10, com a main juntada (o #71 ao #74):
  - typecheck dos quatro pacotes sem erro, e lint sem erro (os 3 avisos da tela já existiam);
  - contratos 186/186 e `campos` 11/11;
  - tela 1668/1668, em 198 arquivos. A primeira rodada achou a regra de abrir a conversa aceitando o WhatsApp (o `in` enxergava a entrada não enumerável); corrigida, com o teste do Pedro como estava;
  - API 958 de 959 na suíte inteira (3 pulados), em 102 arquivos. A única falha foi a das variáveis, antes de o Mateus pôr o nome; depois, sozinha, 4/4, e as suítes da conversa e da entrada do Chatwoot de novo, 35/35;
  - Playwright 260/260;
  - `openspec validate --all --strict`, 16/16.

## GGVP-158 · Parte 7 · Telas lidas do banco, acervo e importação (13/10)

Só servidor, com teste junto; as telas são do Pedro. Branch `feat/GGVP-158-parte-7`, em cima do #78. Migração 0034. Na ordem contrato → teste → servidor.

- [x] 7.1 A migração 0034 (decisões 72 e 73): `caso.valor_causa`, `pessoa.renda_por_pessoa` e as colunas do Raio-X no `processo_acervo`. Verifica com `banco/migracoes.test.ts`.

  Verificado em 13/10: `banco/migracoes.test.ts` 15/15, com a 0034 (o valor da causa, a renda por pessoa e as colunas do Raio-X no acervo).
- [x] 7.2 A estratégia, a IA (P7.1, decisão 67): a finalidade `estrategia_do_caso`, o conteúdo montado no código e a saída conferida.
  - Verifica com teste, com a IA de mentira:
    - a proposta com as fontes;
    - a saída fora do formato não vale.

  Verificado em 13/10, em `rotas/estrategia.test.ts`: a proposta com o que o caso tem (o benefício, o indeferimento e o parecer) e as fontes; a saída fora do formato não vale e dá o aviso.
- [x] 7.3 A estratégia, as rotas (P7.1): `GET`, `POST` e a outra proposta; o preparo; a estratégia no resumo do processo.
  - Verifica com `rotas/estrategia.test.ts`:
    - a proposta pronta;
    - a versão salva com o ajuste vai ao histórico;
    - o Atendimento não lê, nem no resumo.

  Verificado em 13/10: `rotas/estrategia.test.ts` 5/5 e `rotas/processo.test.ts` 9/9. A proposta pronta na rodada, sem chamar de novo ao abrir; a versão ajustada com quem e quando, e o histórico sem o texto; a Sênior salva outra; o Atendimento recebe 403 e o resumo sem a estratégia; a proposta de outro caso recusa; pedir outra chama a IA de novo.
- [x] 7.4 As tarefas da Recepção, o módulo (P7.2, decisão 68): `sincronizarRecepcao` com a cobrança, o checklist, as boas-vindas e o fechamento.
  - Verifica com teste:
    - abre, fecha e atualiza o prazo;
    - uma linha por chave.

  Verificado em 13/10, em `rotas/recepcao-checklist.test.ts` (3 novos): a linha abre com a cobrança, atualiza o prazo e o detalhe na tentativa e fecha quando chega tudo; "Decidir cobrança" abre no limite e fecha com a decisão; "Conferir checklist" e "Enviar boas-vindas" pelas regras das telas; a rodada de novo não repete, e o banco recusa a segunda aberta da mesma chave.
- [x] 7.5 As tarefas da Recepção, as rotas (P7.2): a sincronização quando a ficha é guardada e na rodada de 5 minutos; a Central geral com a tarefa da pessoa sem caso e o id da tela.
  - Verifica com as suítes da cobrança, do checklist, das mensagens e do fechamento e com `rotas/inss.test.ts`:
    - a cobrança aberta e encerrada;
    - o fechamento do lead na Central do Atendimento.

  Verificado em 13/10: `rotas/recepcao-checklist.test.ts` e `rotas/recepcao-decisoes.test.ts` 32/32 (5 novos), e `inss`, `setor`, `conversa`, as suítes da Recepção e `banco/migracoes.test.ts`, 122/122. A Central do Atendimento mostra "Registrar fechamento" da pessoa, sem caso, com o id da tela; o líder atribui por esse id; registrar fecha; o recontato entra na data, pela rodada. Na tela, `dados/servidorLigado.test.ts` 35/35: as fontes da tela não repetem o caso do servidor. Contratos 189/189.
- [x] 7.6 O chat (P7.3, decisão 69): `criar_tarefa` só com `tarefa.atribuir`; `pedir_peca` só com a D3.05 aberta, sem outra.
  - Verifica com `rotas/chat.test.ts`:
    - a atendente não cria tarefa;
    - a peça antes do despacho recusa;
    - depois, a mesma tarefa.

  Verificado em 13/10: `rotas/chat.test.ts` 29/29. A atendente e a advogada não recebem a ferramenta de criar tarefa, e a Sênior recebe (os testes de criar tarefa passaram a ser da Sênior); a peça antes do despacho recusa, sem tarefa; depois, aponta para a mesma "Pedir a petição".
- [x] 7.7 A sugestão de benefício, a IA (P7.4, decisão 70): a finalidade `sugerir_beneficio`, a busca do acervo e a saída conferida contra o catálogo.
  - Verifica com teste, com a IA de mentira:
    - o benefício fora do catálogo não vale;
    - sem fonte, "Sem referência na casa".

  Verificado em 13/10, em `rotas/recepcao-decisoes.test.ts`: o benefício fora do catálogo não vale e dá o aviso; sem caso parecido, o porquê começa com "Sem referência na casa", sem fontes.
- [x] 7.8 A sugestão de benefício, as rotas (P7.4): o `GET` no servidor, o `POST` com a sugestão pronta, o preparo e o fim do acervo e do CNIS de exemplo no servidor.
  - Verifica com `rotas/recepcao-decisoes.test.ts`:
    - pronta, com as fontes;
    - a recusa no histórico;
    - sem a IA, o aviso.

  Verificado em 13/10: `rotas/recepcao-decisoes.test.ts` 13/13 (4 novos) e `regras/regras.test.ts` 79/79. A sugestão pronta na rodada, com a fonte do acervo; a tela abre e a decisão registra a mesma, sem chamar a IA de novo; o Atendimento recebe 403; a recusa vai ao histórico com o motivo e a sugestão recusada; a carência vem do CNIS registrado; sem a IA, o aviso, e o citado segue.
- [x] 7.9 O desfecho no acervo (P7.5, decisão 71): `desfechoNoAcervo` no deferimento do INSS, na ida ao banco, no caso perdido e na confirmação do desfecho de mérito (o #31, que entrou na main).
  - Verifica com `rotas/vigilia.test.ts` e `rotas/prestacao.test.ts`:
    - o deferimento entra no acervo;
    - a ida ao banco não duplica.

  Verificado em 13/10: `rotas/vigilia.test.ts`, `rotas/prestacao.test.ts` (1 novo), `rotas/estudo.test.ts`, `rotas/acervo.test.ts` e `fluxo/ficha-do-desfecho.test.ts`, 67/67. O deferimento entra no acervo na hora, com a data; a ida ao banco não duplica; o caso perdido segue pela mesma função. Depois do #31 na main: `rotas/desfecho.test.ts` 8/8, e o desfecho de mérito confirmado entra no acervo, com a data da decisão.
- [x] 7.10 Os valores (P7.6, decisão 72): as rotas, a regra de valores e o resumo do processo.
  - Verifica com `rotas/valores.test.ts`:
    - a advogada grava;
    - o Financeiro lê;
    - o Atendimento e a Sênior recebem 403;
    - o valor errado recusa.

  Verificado em 13/10: `rotas/valores.test.ts` 4/4 (novo) e `rotas/processo.test.ts` 9/9. A advogada grava; o Financeiro e o Sócio leem; o Atendimento, a Documentação e a Sênior recebem 403; o valor errado recusa; a prestação só para a advogada do caso na prestação de contas; o resumo do processo traz só o que o perfil vê.
- [x] 7.11 O Raio-X, a leitura (P7.7, decisão 73): o contrato, a leitura da planilha e o relatório, numa função pura.
  - Verifica com teste, com uma base inventada:
    - a linha sem número recusa;
    - as colunas pessoais são ignoradas;
    - os peritos, os juízes, as varas e a data de corte.

  Verificado em 13/10, em `fluxo/raio-x.test.ts` (novo): a linha sem número recusa; nome, CPF e telefone viram colunas ignoradas e nada deles entra; os peritos, os juízes, as varas e a data de corte; o número já no acervo fica; o repetido, o desfecho e o "sim ou não" desconhecidos recusam; sem a coluna cnj, nada.
- [x] 7.12 O Raio-X, a carga (P7.7): a simulação e a confirmação com a marca, sem duplicar, com o perito pelo nome.
  - Verifica com `rotas/raio-x.test.ts`:
    - a simulação não grava;
    - a confirmação grava uma vez;
    - a marca de outra planilha recusa.

  Verificado em 13/10: `rotas/raio-x.test.ts` 2/2 (novo), com `importacao` e `acervo`, 28/28. A simulação não grava nem registra; a marca de outra planilha recusa; a confirmação grava os dois processos uma vez, conferidos pela Sênior, com o perito pelo nome; o histórico guarda só as contagens; a mesma planilha de novo não duplica.
- [x] 7.13 O Raio-X, os indicadores (P7.7): a função pura e `GET /api/acervo/raio-x`.
  - Verifica com teste:
    - cada indicador com o número de casos;
    - a data da base;
    - sem base, vazio.

  Verificado em 13/10, em `fluxo/raio-x.test.ts` e `rotas/raio-x.test.ts`: cada indicador com o número de casos, no total e por safra; o cartório e o foro; a data da base; sem base, vazio; o Sócio lê e o Atendimento recebe 403.

  13/10, na revisão do #79: o "Onde julgam" é a taxa por juízo, jurimetria (GGVP-156 CA3, P5.13). Fora do `estudo.ver`, a
  rota manda a lista vazia; o Financeiro e a líder do Atendimento seguem com os outros indicadores. Teste em
  `rotas/raio-x.test.ts`.
- [x] 7.14 Avisar o Pedro: o pedido lista o que muda para as telas, rota por rota.

  Feito em 13/10: o pedido #79 lista, rota por rota, o que muda para as telas ("Para o Pedro ligar nas telas"): a estratégia, os valores, a definição do benefício, a Central, o chat e o Raio-X.
- [x] 7.15 Rodar typecheck, lint, testes e Playwright; colar a saída; relatório final ao Mateus.

  Verificado em 13/10, com a main juntada (o #78): typecheck dos quatro pacotes sem erro; lint sem erro (os 3 avisos da tela já existiam); contratos 189/189; `campos` 11/11; tela 1674/1674; API 989 de 996 na suíte inteira (3 pulados), com 4 falhas de testes que contavam todas as chamadas da IA na rodada (a estratégia também prepara), corrigidas e de novo 45/45; Playwright 262/262 na segunda rodada (a primeira achou o teste da jurimetria supondo o acervo parado, corrigido); `openspec validate --all --strict` 16/16.
- [x] 7.16 As palavras de desfecho do Raio-X (P7.7, decisão 73, 14/10): "Êxito", "Acordo", "Perdido(s) no mérito", "Extinto(s) sem mérito" e "Em andamento", sem o arquivo do Raio-X à mão.
  - Verifica com `fluxo/raio-x.test.ts`:
    - cada palavra vira o desfecho do acervo;
    - "Em andamento" entra sem desfecho e sem linha recusada.

  Verificado em 14/10: `fluxo/raio-x.test.ts` (1 novo), `rotas/raio-x.test.ts` e `fluxo/importacao.test.ts`, 13/13; typecheck e lint da API sem erro. Cada palavra vira o desfecho do acervo, e "Em andamento" entra sem desfecho, sem linha recusada. Na primeira rodada, um teste das rotas do Raio-X falhou uma vez, sem repetir nas três rodadas seguintes.
