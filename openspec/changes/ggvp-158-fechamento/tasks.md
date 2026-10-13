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

Só servidor, com teste junto; as telas são do Pedro. Branch `feat/GGVP-158-parte-5`, em cima do #74. A migração 0032 sai no fim, sobre a main mais nova. Na ordem contrato → teste → servidor.

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
- [ ] 5.7 A espera de fora (P5.4, decisão 43): as linhas da espera na Central da advogada, urgentes no dia útil; `POST /api/casos/:id/esperas/olhada`.
  - Verifica com teste:
    - INSS decidindo, no topo na terça;
    - fora do topo depois de "Olhei" e no sábado;
    - a perícia feita sem resultado também;
    - sem linha repetida com a "Trazer a resposta do INSS".
- [ ] 5.8 A data do juiz na hora (P5.5, decisão 44): a exigência do juiz marca a perícia com a data da publicação, sem a tarefa de marcar; o resumo do processo diz `marcadaPeloSistema`.
  - Verifica com `rotas/exigencia-juiz.test.ts` e `rotas/processo.test.ts`:
    - com a data, a perícia marcada, sem tarefa de marcar, e a orientação "pelo sistema";
    - sem a data, a tarefa de marcar.
- [ ] 5.9 O item sem documento (P5.6, decisão 45): `semSaida` em `EncerrarSemProva`; a rota pede a dilação, a remarcação ou o porquê.
  - Verifica com `rotas/manifestacao.test.ts`:
    - sem nada, recusa;
    - com a dilação autorizada, encerra;
    - com o `semSaida`, encerra e guarda o porquê.
- [ ] 5.10 Encerrar e liberar (P5.7, decisão 46).
  - Verifica com `rotas/vigilia.test.ts` e `rotas/conferencia.test.ts`:
    - o caso já despachado não encerra;
    - liberar de novo cancela o protocolo aberto, e o OK antigo não vale.
- [ ] 5.11 Tribunal e assinatura, rotas (P5.8, decisão 47): `PUT /api/configuracao/tribunais` e `/assinatura`; o `GET` devolve os dois.
  - Verifica com `rotas/configuracao.test.ts`:
    - a Sênior salva, e fica no histórico;
    - o Atendimento recusa;
    - o tamanho fora da faixa recusa.
- [ ] 5.12 A trava do pacote (P5.8, P5.9): falha sem tribunal e com a assinatura a completar; o protocolo recusa sem tribunal; o PDF não usa a assinatura "a configurar".
  - Verifica com `fluxo/travas.test.ts` e `rotas/peticao.test.ts`.
- [ ] 5.13 O alarme da vigília (P5.10, decisão 48): a rodada presa vira falha; sem fonte na produção, a linha da Sênior e o alarme do dia; `avisarSuporte`, com o canal e o Jira.
  - Verifica com teste, com o fetch de mentira:
    - a presa;
    - o sem fonte, uma vez por dia;
    - a falha de qualquer tipo chama o canal e o Jira uma vez, sem texto de publicação;
    - a falha do Jira não derruba a rodada.
- [ ] 5.14 ADR-018 (P5.10): o alarme ao suporte pelo canal e pelo Jira, e o que cada variável liga. Verifica: o arquivo em `docs/decisoes/`.
- [ ] 5.15 As variáveis (P5.10): as cinco `ALARME_*` na lista das variáveis do servidor e no documento da homologação.
  - Verifica com `variaveis.test.ts`.
  - O `.env.example` é do Mateus: a regra do repositório não deixa o agente ler nem editar `.env*`.
- [ ] 5.16 Feriados (P5.11, decisão 49): a carga aceita o ano; a linha "Carregar os feriados de <ano>" na Central da Sênior.
  - Verifica com `rotas/feriados.test.ts` e o teste da Central:
    - dezembro sem o ano seguinte mostra a linha;
    - a carga de 2028 entra, e a linha some.
- [ ] 5.17 Jurimetria no texto, regra (P5.12, decisão 50): `numeroDeJurimetriaNoTexto` em `packages/contratos`.
  - Verifica com o teste do contrato:
    - os formatos do G22 acusam;
    - o percentual de lei, o entendimento e o processo de exemplo passam;
    - o texto grande roda em tempo linear.
- [ ] 5.18 Jurimetria no texto, servidor (P5.12): a aprovação da petição, da manifestação e da dilação recusa e registra o G22. Verifica com `rotas/peticao.test.ts` e `rotas/manifestacao.test.ts`.
- [ ] 5.19 A jurimetria só com `estudo.ver` (P5.13, decisão 51): os recortes do painel e a `visao` da perícia.
  - Verifica com `rotas/gestao.test.ts` e `rotas/pericia.test.ts`:
    - o líder do Atendimento e o Financeiro recebem 403 no recorte por perito;
    - a Documentação recebe a perícia sem os números.
- [ ] 5.20 O juízo com o juiz e o perito (P5.14, decisão 52); o resumo do processo com a vara, o juiz e o perito.
  - Verifica com `rotas/juizo.test.ts` e `rotas/processo.test.ts`:
    - dois casos com o mesmo juiz e perito contam 2;
    - o resumo do Atendimento sem números.
- [ ] 5.21 O protocolo do recurso (P5.15, decisão 53): `POST /api/casos/:id/recurso/protocolo`.
  - Verifica com `rotas/recurso.test.ts`:
    - fecha a tarefa e guarda o comprovante;
    - sem tarefa, recusa;
    - a data depois de hoje recusa.
- [ ] 5.22 A migração 0032 (P5.8): o tribunal e a assinatura do banco novo, com `ON CONFLICT DO NOTHING`, sobre a main mais nova. Verifica com teste: o banco novo tem os dois; o banco com a chave guarda o que tinha.
- [ ] 5.23 Avisar o Pedro: o pedido lista o que muda para as telas, rota por rota.
- [ ] 5.24 Rodar typecheck, lint, testes e Playwright; colar a saída; relatório final ao Mateus.
