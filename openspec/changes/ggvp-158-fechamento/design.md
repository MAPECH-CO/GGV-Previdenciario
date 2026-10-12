# Design

## Context

- **Mensagens:** sem Chatwoot e com o contato da ficha, o correio (`apps/api/src/rotas/mensagens.ts`) grava a mensagem como `entregue`, embora nada tenha saído. O status é `enviada`, `entregue`, `lida` ou `falhou`, com uma CHECK no banco.
- **/saude:** devolve `ok`, `servico`, `banco` e `drive` (`Saude`, em `packages/contratos/src/index.ts`). A imagem é montada pelo `imagem.yml`, que já conhece o commit (`COMMIT`). O `Dockerfile` fixa `NODE_ENV=production`.
- **Banco:** `abrirBanco` (`banco/conexao.ts`), sem `DATABASE_URL`, abre o PGlite em memória com os usuários de exemplo. Isso vale também em produção.
- **Rotas:** 7 rotas `/api` não têm trava de permissão. São o chat (3 rotas), `/api/tarefas`, `/api/conversas/tarefas`, `/api/conversas/:id/pendencia/cumprida` e `/api/gravacoes/:id/arquivos/:doc`. A matriz está na versão 28.
- **Sugestão da IA:** 6 rotas gravam o `chamadaIaId` que a tela manda sem conferir de qual caso ele é: o indeferimento, a exigência do juiz, a recomendação da perícia, as duas da petição e o resumo do resultado.
- **Regra do "[completar]":** `faltaCompletar` usa `/\[completar[^\]]*\]/i`, que o CodeQL marca como regex lenta.
- **`@ggv/campos`:** só tem o script `test`, então o `pnpm -r typecheck` e o `pnpm -r lint` do CI pulam o pacote.
- **Erros:** o Fastify sobe com `logger: true` e sem tratador de erro.
- **Semente:** a do servidor (`banco/exemplo.ts`) não tem contrato da Recepção, leitura de documento, checklist, perito, juízo, agenda nem perícia.

## Goals / Non-Goals

**Goals:** a parte de código das partes 1 e 2 da GGVP-158, uma tarefa por vez, com teste.

**Non-Goals:**
- o que é fora do código: o Coolify, o GitHub, o Supabase e o CodeQL, que ficam com o Mateus;
- as partes 3 a 9;
- telas.

## Decisions

1. **"Simulado, não saiu" sem migração, num PR à parte** (Mateus, 11/10). Ele mescla junto com o Chatwoot ligado na homologação. A janela do Chatwoot (`ConviteChatwoot`) para quando a mensagem não sai, e sem o Chatwoot o convite, a confirmação e a cobrança do roteiro travariam.
   - Sem Chatwoot, o correio grava `falhou` com o motivo "simulado, não saiu: o Chatwoot não está ligado neste ambiente". O status `falhou` já existe na CHECK, então não precisa de migração.
   - O `RELACIONAMENTO_SIMULADO` continua dando o contato e a conversa à tela, para o fluxo andar; só a entrega deixa de ser fingida.
   - Com `RELACIONAMENTO_SIMULADO=entrega`, o Chatwoot de mentira entrega. Só o Playwright usa (`playwright.config.ts`), porque o convite, a confirmação e a cobrança dos testes de tela precisam da entrega para seguir. Na homologação e na produção, nunca.
   - O aviso de mudança dos dados (`seguranca.ts`) usa o mesmo correio e já devolve o motivo quando a mensagem não sai.
   - Os testes que esperavam "entregue" no simulado passam a esperar "não saiu". O que depende de entrega de verdade (não repetir na mesma conversa, a tentativa do complemento) passa a ser provado com o Chatwoot de mentira dos testes da GGVP-146.
2. **Versão no /saude** (contrato primeiro).
   - `Saude` ganha `versao: z.string()`.
   - `criarServidor` recebe `versao`, que o `principal.ts` lê de `VERSAO`; sem ela, `local`.
   - O `Dockerfile` recebe `ARG VERSAO=local` e `ENV VERSAO=$VERSAO`.
   - O `imagem.yml` passa `build-args: VERSAO=${{ env.COMMIT }}`.
3. **Cabeçalhos num `onSend` do servidor**, sem dependência nova:
   - o `helmet` não é necessário para quatro cabeçalhos;
   - a CSP é `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://api.openai.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`;
   - a tela montada só carrega arquivos dela mesma. A exceção é o texto ao vivo da entrevista, que vai do navegador direto à OpenAI com a chave temporária (`dados/audio.ts`), por isso a OpenAI entra no `connect-src`;
   - o HSTS sai só com o cookie seguro (HTTPS);
   - o cabeçalho que a rota já pôs vale. O arquivo do cliente (documento, kit, gravação) sai com a CSP de sandbox, mais estreita que a geral, e o `onSend` não a troca;
   - no navegador, o zod roda sem JIT. Ele testa o `eval`, a CSP barra e o console fica com erro a cada tela. O `jitless` fica num módulo dos contratos importado antes de todo schema, e só no navegador: o servidor, sem CSP, mantém o JIT.
4. **Produção exige banco.** `abrirBanco` recusa abrir o embutido quando `NODE_ENV=production`, com a mensagem de que falta o `DATABASE_URL`. Os testes e o `pnpm dev` seguem como hoje.
5. **Lista das variáveis com teste.**
   - O `.env.example` na raiz tem só os nomes e um comentário por grupo; a mesma lista entra em `docs/infra/homologacao.md`.
   - Um teste lê o código do servidor (`process.env.X` e `ambiente.X`) e confere cada nome no `.env.example`.
6. **Trava nas 7 rotas.** A matriz vai para a versão 29, no fim da parte 2 e sobre a main mais nova, com a impressão digital nova no teste.
   - `chat.usar` e `tarefa.ver` entram para os 8 perfis, porque todo perfil tem chat e Central. O chat usa `chat.usar`, e as duas listas de tarefas usam `tarefa.ver`.
   - `tarefa.cumprir` entra para todos menos o Sócio, que não é responsável de pendência. A pendência cumprida usa essa permissão. Não usa `conversa.registrar`, porque a pendência pode ser da Documentação, do Jurídico administrativo ou do Financeiro. A conferência de dentro da rota fica: só o responsável ou a Sênior.
   - O arquivo da gravação usa `entrevista.ver`. A conferência de dentro da rota fica, porque é mais estreita: a permissão da gravação e o dado de saúde.
   - A recusa fica no histórico pelo `exigir` de sempre.
   - Na partida, um `onRoute` em `servidor.ts` recusa rota `/api` sem trava e diz qual é. Rota nova sem trava não passa nem nos testes.
   - Ficam fora da conferência as rotas da sessão (`/api/sessao`) e a que declara o motivo em `config.semTrava`. Hoje só uma declara: a que impede editar ou apagar o histórico. Ela recusa sempre, para todo perfil, e registra a tentativa.
7. **`chamadaDoCaso`** (em `apps/api/src/ia/ia.ts`): confere no `chamada_ia` que a chamada existe e é do caso. As 6 rotas recusam com 400 "A sugestão da IA não é deste caso." antes de gravar: as 5 do cartão e o resumo do resultado (`resultado.ts`), que grava a chamada do mesmo jeito.
8. **Tratador de erro do Fastify.**
   - O erro de validação mantém a mensagem e o status dele.
   - O erro inesperado responde 500 "Algo deu errado." e registra só a rota, o código e o nome do erro, nunca o SQL nem os parâmetros (o Drizzle põe os dois na mensagem).
   - O logger ganha `redact` para o cookie, a autorização e o `set-cookie`. A opção `logger` de `criarServidor` segue booleana.
9. **Regra do "[completar]" sem regex:** usa `indexOf` do "[completar" e depois do "]", em tempo linear.
10. **drizzle-orm 0.45.2 ou mais**, com o drizzle-kit da mesma família.
    - O teste das migrações confere que todas seguem aplicando, e a suíte inteira roda.
    - Se a versão mudar a API usada, o ajuste fica na mesma tarefa.
11. **`@ggv/campos`** ganha o `tsconfig.json` e os scripts `typecheck` (`tsc --noEmit`) e `lint` (`oxlint`), que o CI já roda por `pnpm -r`.
12. **Exemplos dos recursos novos só no preparo da homologação** (`semearRecursosNovos`, em `banco/exemplo.ts`). Entram os peritos de exemplo da tela, com o perfil, os entendimentos do "TRF3 · 6301" e uma reunião na agenda.
    - Ficam fora da semente da máquina e dos testes de tela. Nesses testes, um exemplo novo muda o que eles contam.
    - Cada exemplo entra só se falta (`onConflictDoNothing`, ou o título da reunião), então rodar o preparo de novo acrescenta sem duplicar.
    - O contrato da Recepção, a leitura, o checklist, as boas-vindas, a cobrança e a perícia ficam fora. Nascem no roteiro (lead novo e perícia decidida pela advogada). O kit do contrato precisa dos modelos do Word, que ainda não subiram.

## Campos de formulário

Nenhum.

## Risks / Trade-offs

- **CSP:** um recurso de fora que a tela use quebraria.
  - Os testes ponta a ponta não pegam isso, porque a tela deles vem do Vite, sem a CSP.
  - Por isso, a tarefa dos cabeçalhos abre a tela montada (`dist`) servida pela API e confere o console.
- **Matriz 29:** outro pedido com matriz nova conflita na impressão digital, e quem entrar depois renumera.
- **drizzle-orm:** a versão nova pode mudar tipos. A suíte inteira roda antes do "Agora ok?".
- **"Falhou" sem Chatwoot:** a homologação passa a mostrar as mensagens como não enviadas até o Chatwoot ser ligado, o que é o comportamento pedido.
