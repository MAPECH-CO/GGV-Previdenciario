# Tasks

## GGVP-118 · Base de código: stack (ADR-001), monorepo, banco de dados e CI

- [x] 1.1 CA1 · Escrever `docs/decisoes/ADR-001-base-de-codigo-e-stack.md` e tirar o 001 da lista de pendentes em `docs/decisoes/README.md`; verifica lendo o arquivo.
- [x] 1.2 CA3 · `git mv kit/campos packages/campos` e trocar os caminhos em `kit/instalar.ps1`, `kit/instalar.sh`, `kit/LEIA-ME.md` e `packages/campos/README.md`; verifica com `pnpm --filter @ggv/campos test`.
- [x] 1.3 CA2, CA3 · Criar `package.json` e `pnpm-workspace.yaml` na raiz (scripts `dev`, `typecheck`, `lint`, `test`) e gerar o `pnpm-lock.yaml`; verifica com `pnpm -r ls --depth -1`.
- [x] 1.4 CA3, CA6 · Criar `packages/contratos` com `Saude` e `Pessoa` (validados por `@ggv/campos`) e `src/contratos.test.ts`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.5 CA2 · Criar `apps/api` com Fastify e `GET /saude` respondendo o contrato `Saude`, e `src/servidor.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.6 CA4 · Criar `apps/api/src/banco/esquema.ts`, gerar a migração em `apps/api/drizzle/` e o script `db:migrar`; teste `src/banco/migracoes.test.ts` aplica as migrações num Postgres em memória e confere as 4 tabelas; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.7 CA5 · Criar `.github/workflows/ci.yml` (typecheck, lint, testes, gitleaks); verifica no PR que o job roda e fica verde.
- [x] 1.8 CA2 · Rodar `pnpm dev` e conferir que a API responde em `/saude` e a tela abre em `localhost:5173`; verifica pela saída do `curl`.
- [x] 1.9 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [x] 1.10 CA7 · `exigencia.ts`, `inss.ts` e `vigilia.ts` contam o "hoje" com `hojeEmBrasilia` (as que já fazem a conta de Brasília à mão ficam como estão); teste da urgência às 22h30 de Brasília; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.11 CA7 · O fuso do teste de navegador fica como a main decidiu no #15, só na API do teste (Mateus, 09/10): sai do `playwright.config.ts` o `timezoneId` do navegador e o `TZ` do processo do teste; verifica com o Playwright da perícia (`pericia-comparecimento`, `pericia-marcar`, `pericia-servidor`).
- [x] 1.12 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-119 · Ambiente: homologação no Coolify com deploy a cada merge e Postgres de dev por pessoa

- [x] 2.1 CA4 · Contrato `Saude` ganha `banco` (`ligado`, `sem-banco`, `fora-do-ar`); `GET /saude` consulta o banco do `DATABASE_URL` e responde 503 com o banco fora do ar; verifica com `pnpm --filter @ggv/contratos test` e `pnpm --filter @ggv/api test`.
- [x] 2.2 CA1, CA2 · A API serve a tela montada (`apps/web/dist`) quando a pasta existe, com qualquer caminho caindo no `index.html`; teste em `src/servidor.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.3 CA1, CA5 · `Dockerfile` e `.dockerignore` na raiz: monta a tela, roda as migrações antes de subir e tem verificação de saúde em `/saude`; verifica localmente com `pnpm --filter @ggv/web build` e a API servindo a tela em `localhost:3000`.
- [ ] 2.4 CA3, CA6 · `.env.example` na raiz com a URL dos bancos `prev_homolog`, `prev_pedro` e `prev_mateus`, sem senha; verifica com o gitleaks no CI.
- [x] 2.5 CA1, CA3, CA5, CA6 · `docs/infra/homologacao.md`: criar os bancos e usuários, o app no Coolify (deploy a cada merge, segredos só lá), acesso ao banco de dev por túnel SSH e só dados de exemplo em homologação; verifica lendo o arquivo.
- [ ] 2.6 CA1, CA2, CA3 · Ligar a homologação ANTES de 09/10 (o Lucas testa no dia 09 de manhã), logo depois do login e dos perfis: banco no Supabase, projeto "Portal Operacional" (os dados atuais podem ser apagados), app no Coolify; segredo só no Coolify ou no .env local; ajustar `docs/infra/homologacao.md`; verifica abrindo a URL de homologação.
- [x] 2.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-117 · Entrar no portal com e-mail e senha

- [x] 3.1 Contratos em `packages/contratos`: `Entrar` (e-mail por `validarEmail` de `@ggv/campos`), `UsuarioDaSessao`, `TrocarSenha` (mínimo de 8 caracteres) e `Erro`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 3.2 CA2 · Regra da trava em `apps/api/src/sessao/regras.ts` (5 erros seguidos travam 15 minutos; sessão de 8 horas) com teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.3 CA6 · Tabelas `usuario` e `sessao` no esquema e migração nova; senha só como hash bcrypt; verifica com o teste das migrações.
- [x] 3.4 CA1, CA2, CA5, CA6, CA7 · Rotas `POST/GET/DELETE /api/sessao` e `POST /api/sessao/senha`, cookie httpOnly, 401 em toda rota `/api` sem sessão, histórico de login e logout; teste em `src/sessao/rotas.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.5 Banco local de exemplo: sem `DATABASE_URL`, a API usa Postgres embutido em `apps/api/.banco-local/` com usuários de exemplo; comandos `usuario:criar` e `usuario:destravar` (resposta do Lucas, Q1 e Q2); verifica com `pnpm dev` e entrando na tela.
- [x] 3.6 CA1, CA2, CA3, CA4 · Telas "Entrar", "Trocar a senha" e "Sem perfil"; o portal confere a sessão e manda ao login com a volta para a mesma tela; "Sair" na barra do topo; testes Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 3.7 CA1, CA2, CA3, CA4 · Playwright do login com a API no ar; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 3.8 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?". Rodado na revisão geral de 07/10 (branch com a regra dos valores): typecheck e lint sem erro; campos 9, contratos 20, API 37, tela 51, Playwright 14, todos passando (com a máquina carregada, 3 testes de tela estouraram o tempo e passaram rodados um por vez). De novo em 07/10, com o teste do CA16 e do GGVP-129: contratos 20, API 39, tela 51, Playwright 14.

## GGVP-129 · Modelo de dados do portal (base de todos os épicos, decisão de 05/10)

- [x] 4.1 Desenhar o modelo por área e as regras de LGPD em `design.md` ("Modelo de dados do portal"); verifica lendo o arquivo.
- [x] 4.2 Esquema Drizzle por área em `apps/api/src/banco/esquema/` (37 tabelas novas; `pessoa`, `caso` e `tarefa` ganham colunas), estados com `check` e RLS em todas; migração `0003_modelo_de_dados`; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.3 Histórico só cresce: gatilho recusa `update` e `delete` em `evento_auditoria` e `acesso_dado_sensivel` (migração `0004_historico_so_cresce`); teste em `migracoes.test.ts`.
- [x] 4.4 Testes de confiança: estado fora da lista, CPF repetido, número de processo em dois casos, prestação com a mesma pessoa no OK e no recebimento e aviso antes do OK; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.6 CA3 · O teste do histórico também cobre `acesso_dado_sensivel`; spec `specs/ggvp-129/spec.md`; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.5 Aplicar no Supabase "Portal Operacional" com `pnpm --filter @ggv/api db:migrar`; verifica pelo conector: 43 tabelas, todas com RLS.

## GGVP-96 · Perfis e permissões

- [x] 5.1 CA2, CA4, CA5, CA6, CA7, CA12, CA15 · Matriz em `packages/contratos/src/permissoes.ts`: 8 perfis, ações, `pode(perfil, acao)` e versão com impressão digital; teste por perfil; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 5.2 Banco: `usuario.perfis` (lista) no lugar de `usuario.perfil`, `sessao.perfil_ativo`; migrações; verifica com o teste das migrações.
- [x] 5.3 CA3, CA8, CA10 · API: login abre no primeiro perfil; `POST /api/sessao/perfil` só para perfil atribuído, com histórico; `exigir(acao)` recusa com 403 e histórico; comando `usuario:perfis` só por Sócio, com histórico; verifica com `pnpm --filter @ggv/api test`.
- [x] 5.4 CA9, CA10, CA11 · Tela: "Entrar como…" na barra do topo com os perfis da pessoa; Central pelo perfil ativo; "Sem permissão"; verifica com `pnpm --filter @ggv/web test`.
- [x] 5.5 Playwright: trocar de perfil e ver a recusa; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 5.7 CA16 · Teste do caminho real: o OK já dado e o recebimento registrado depois pela mesma pessoa é recusado, por outra é aceito (`migracoes.test.ts`); verifica com `pnpm --filter @ggv/api test`.
- [x] 5.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?". Rodado na revisão geral de 07/10 (branch com a regra dos valores): typecheck e lint sem erro; campos 9, contratos 20, API 37, tela 51, Playwright 14, todos passando (com a máquina carregada, 3 testes de tela estouraram o tempo e passaram rodados um por vez). De novo em 07/10, com o teste do CA16 e do GGVP-129: contratos 20, API 39, tela 51, Playwright 14.

> CA13 e CA14 da GGVP-96 saíram desta change (revisão geral de 07/10): o CA13 entra com as rotas que devolvem dado de saúde (conferência no PR #14, documentos no PR #18) e o CA14 com a exportação e o relatório de prazos (PR #18), cada um com teste lá.

## GGVP-126 · Homologação com usuários e dados de teste

- [x] 6.1 CA4 · A semente olha se os usuários de exemplo já estão no banco (antes, qualquer usuário), só no começo de `semearExemplos` (`apps/api/src/banco/exemplo.ts`); verifica com `pnpm --filter @ggv/api test`.
- [x] 6.2 CA1, CA2, CA3, CA4, CA5 · Comando `homologacao:preparar` (`apps/api/src/banco/homologacao.ts`): recusa sem `AMBIENTE=homologacao`; semente e senhas numa transação; senha provisória aleatória por usuário de exemplo, com troca no primeiro acesso; limites de cobrança se faltarem; teste no banco embutido; verifica com `pnpm --filter @ggv/api test`.
- [x] 6.3 Como rodar no Coolify e entregar as senhas, em `docs/infra/homologacao-dados-de-teste.md`; verifica lendo.
- [ ] 6.4 CA3, a parte que falta · Recepção, Abertura, documentação médica, Perícia e Relacionamento com caso de exemplo no banco, quando a GGVP-125 e a GGVP-132 ligarem essas telas no servidor; o teste do CA3 passa a afirmar esses passos; verifica com `pnpm --filter @ggv/api test`.
- [x] 6.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [x] 6.6 CA1 · Correção da homologação de 08/10. No terminal do app, o comando parava com a rodada repetida (`rodada_unica`) e não gravava nada. A semente grava a rodada de exemplo das 08:00 de hoje, e o relógio da vigília, com o servidor no ar, já a tinha criado.
  - Correção: a semente só marca a falha de exemplo na rodada que já existe (`onConflictDoUpdate` pela chave fonte + horário).
  - Teste novo: `planejarDia` antes do comando, como no servidor. Antes da correção, ele falhava com o mesmo erro da homologação.
  - Revisão do PR #40: o teste confere só a rodada das 08:00 (uma, com a falha) e que as outras seguem previstas, sem depender dos horários padrão da vigília.
- [x] 6.7 Verificação de 08/10, na máquina carregada:
  - typecheck e lint sem erro; `openspec validate --all --strict` com 14 de 14;
  - os 9 testes do comando passaram, com o novo; Playwright da vigília (judicialização) com 6 de 6;
  - API inteira: dos 53 arquivos, só 43 iniciaram. Deles, 42 passaram; o que falhou (linha de comando do CA5, por tempo) passou rodando sozinho. A suíte inteira roda no CI do PR.

