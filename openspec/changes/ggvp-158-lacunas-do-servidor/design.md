# Design

## Context

- **Acervo no chat:**
  - `ferramentasDeLeitura` (`apps/api/src/rotas/chat.ts`) dá `buscar_no_acervo` a todo perfil e chama `buscarNoAcervo` com `saude: veSaudeNoChat(perfil)`.
  - Sem saúde, a busca (`apps/api/src/ia/acervo.ts`, `FONTES` e `buscarPorSentido`) devolve o que não é `so_juridico`:
    - o modelo de petição ("Modelo da casa");
    - a conversa conferida sem fato de saúde;
    - a transcrição conferida de entrevista que não é só do Jurídico (`gravacao_recepcao.so_juridico` falso, a entrevista que não foi do Jurídico, `recepcao-entrevista.ts`).
  - Pela matriz e por `perfis.md`:
    - o Financeiro não vê entrevista, peça nem o caso;
    - a Documentação e o Atendimento não veem peça nem estratégia jurídica;
    - a Documentação também não vê entrevista (`entrevista.ver`).
  - Os outros chamadores de `buscarNoAcervo` são fluxos do Jurídico, com a finalidade da IA: ficam como estão.
- **Prestação:**
  - `SalvarPrestacao` (`packages/contratos/src/prestacao.ts`) exige só `conferiCarta`.
  - `POST /api/casos/:id/prestacao` (`apps/api/src/rotas/prestacao.ts`) grava a versão com o OK da Sênior e não lê os dados bancários.
  - `PrestarContas.tsx` tem uma caixa.
  - O texto do aviso ao cliente é o modelo "Confirmação da ida ao banco", que a Sênior ajusta na Configuração e o Financeiro manda depois do OK.
- **Dados bancários** (GGVP-111, `rotas/seguranca.ts`): cada mudança nasce como pedido (`dado_bancario` sem `confirmado_em`) e só vale com a segunda confirmação de outra pessoa (líder, advogada ou Sênior).

## Goals / Non-Goals

**Goals:** cada lacuna com o teste que falhava antes; a trava no servidor, e a tela da prestação acompanhando o contrato novo.

**Non-Goals:**
- decidir o CA1 e o prazo do CA10;
- mudar a matriz;
- o botão do scanner simulado.

## Decisions

1. **L1: a ferramenta só para quem tem `peticao.ver`, e não um filtro por fonte.**
   - Tudo o que o acervo guarda é material jurídico: peça aprovada, decisão, parecer, perícia, estudo de caso, modelo de petição, e a conversa e a entrevista de outros clientes.
   - `peticao.ver` (Jurídico e Sócio) é o mesmo conjunto de `dado_saude.ver_detalhe`.
   - Para os outros perfis, a busca sem saúde só devolveria o que eles não podem ver. Uma linha em `ferramentasDeLeitura`, sem tocar no `acervo.ts`.
   - Sem a ferramenta, o modelo nem a recebe. O teste prova antes, pelo que chega ao modelo, que o trecho vazava.
2. **L2: as quatro conferências são campos do contrato** (`z.literal(true)`), como `conferiCarta`:
   - `conferiHonorarios`: "Conferi os honorários com o contrato";
   - `conferiDadosBancarios`: "Conferi que o Atendimento confirmou os dados bancários do cliente";
   - `revisouAviso`: "Revisei o texto do aviso ao cliente".

   A carta segue como a primeira: as fontes (carta ou sentença) estão com o Lucas. O `GET` passa a devolver `aviso`, o texto do modelo ativo da ida ao banco (`.nullable().default(null)`, sem quebrar quem já lê o contrato). A tela mostra o texto antes da caixa: revisar pede ver.
3. **L3: pedido aberto trava o OK com 409**, antes de gravar: "Os dados bancários do cliente mudaram e esperam a segunda confirmação, na ficha do cliente. O OK vem depois dela."
   - Não depende do prazo: a mudança sem confirmação é "alterada e não verificada" em qualquer prazo.
   - Sem dados bancários no portal, o OK segue: no INSS o cliente recebe no banco.
   - Não entra na lista de tentativas bloqueadas, porque é pré-condição, como a carta.

## Risks / Trade-offs

- [L1 tira a busca no acervo do chat do Atendimento] → o que ela devolvia ao Atendimento era o modelo de petição e a conversa e a transcrição de outros clientes, e a peça e a estratégia jurídica estão no "nunca vê" do Atendimento. Se o Mateus quiser o Atendimento de volta, a trava passa a `entrevista.ver` e o modelo sai por filtro. O teste 16.4 passa a esperar três ferramentas para o Atendimento.
- [L2 muda o contrato que a tela do Pedro manda] → a tela entra no mesmo PR: três caixas, o texto do aviso e o botão só com as quatro. O e2e `fechamento-financeiro.e2e.ts` marca as quatro.
- [L3 trava a Sênior quando o pedido aberto é dela] → quem pediu não confirma (GGVP-111): outra pessoa, líder, advogada ou Sênior, confirma na ficha. A mensagem diz onde.
