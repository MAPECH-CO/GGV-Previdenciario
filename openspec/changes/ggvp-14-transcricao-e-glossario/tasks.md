# Tarefas · GGVP-14 Transcrição e glossário

## GGVP-143 · Glossário do escritório

- [x] 1.1 Contratos `TIPOS_DE_TERMO`, `TermoDoGlossario`, `SalvarTermo` e `GlossarioDoEscritorio` (`packages/contratos/src/glossario.ts`); matriz versão 17 (`glossario.editar`, só a Sênior); testes em `glossario.test.ts` e `permissoes.test.ts`.
- [x] 1.2 CA3 · Tabela `glossario_termo` com RLS e a migração com a semente (benefícios do catálogo, siglas, peritos e juízos); teste da semente em `apps/api/src/rotas/glossario.test.ts` e contagem em `migracoes.test.ts`.
- [x] 1.3 CA1, CA2 · Rotas GET, POST, PUT e DELETE do glossário com `exigir`, histórico por `registrarHistorico` e `termosDoGlossario` (`apps/api/src/rotas/glossario.ts`, `apps/api/src/fluxo/glossario.ts`); testes por perfil, do histórico e da leitura.
- [x] 1.4 Seção "Glossário do escritório" na Configuração (`apps/web/src/paginas/Configuracao.tsx`); testes de tela.
- [x] 1.5 Playwright: a Sênior acrescenta, corrige e tira um termo; a mudança aparece no histórico da configuração (`apps/web/e2e/glossario.e2e.ts`).
- [x] 1.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-133 · Transcrição de áudio de verdade (parte 2: a entrevista)

- [x] 2.1 CA1, CA9, CA11 · A terceira porta do motor, `transcrever` (OpenAI, com quem fala), com o registro do modelo, da duração e do custo em `chamada_ia` (colunas novas) e a trava de dado de saúde (`apps/api/src/ia/ia.ts`); teste com `fetch` falso.
- [x] 2.2 CA3, CA5, CA7 · A finalidade `arrumar_transcricao` (glossário e contexto do caso, quem fala, o original ao lado) e o fluxo da transcrição com `tirarSenhas` no servidor (`apps/api/src/fluxo/transcricao.ts`); testes.
- [x] 2.3 CA1, CA2, CA6, CA8, CA10 · O áudio de verdade vira documento nas rotas que já existem da entrevista (só acréscimo em `rotas/recepcao-entrevista.ts`), a transcrição pelo motor, o texto na pasta do cliente e o preparo em segundo plano; testes da API.
- [x] 2.4 CA4 · A chave temporária do texto ao vivo, pelo servidor (`apps/api/src/rotas/transcricao.ts`); teste.
- [x] 2.5 CA2, CA4, CA8 · Tela: gravar com o microfone e mandar o áudio; texto ao vivo; a caixa do áudio de fora manda o arquivo, com o aviso da ligação do Chatwoot; testes de tela.
- [x] 2.6 Playwright: a advogada sobe a gravação de uma ligação na entrevista.
- [x] 2.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-133 · Transcrição de áudio de verdade (parte 3: a conversa do Relacionamento)

- [x] 3.1 CA1, CA2, CA4, CA6, CA10 · A rota do áudio da conversa aceita o arquivo da ligação (com o aviso, G10) e a parte do microfone; a transcrição de verdade com a IA ligada (sem a chave, segue o exemplo do Relacionamento); a chave do texto ao vivo só na conversa no escritório; o preparo (só acréscimo em `rotas/conversa.ts`); testes em `transcricao-conversa.test.ts`.
- [x] 3.2 CA2, CA4 · O gancho comum do microfone (`dados/gravacaoDeVerdade.ts`), na entrevista e na conversa; a caixa da ligação manda o arquivo; o servidor falso dos testes do Relacionamento aceita o arquivo; testes de tela.
- [x] 3.3 Playwright: a Atendimento sobe a gravação da ligação na conversa (`e2e/transcricao-ligacao.e2e.ts`).
- [x] 3.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
