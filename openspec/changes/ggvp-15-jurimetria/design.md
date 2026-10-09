# Design · GGVP-15 Jurimetria e dashboards de análise

## GGVP-75 · Painel de resultado para os sócios

### Context

Os dados já existem nas tabelas dos épicos anteriores:
- **`caso`:** `beneficio`, `advogada_responsavel_id`, `desfecho` (`deferido`, `procedente_total`, `procedente_parcial`, `improcedente`, `extinto_sem_merito`, `desistencia`), `causa_desfecho` (GGVP-37 CA5) e `encerrado_em`.
- **`resultado_inss`:** `resultado` deferido ou indeferido, com `data_decisao`.
- **`exigencia`:** `prazo` e `situacao` (aberta, cumprida, vencida, dilacao_pedida); os itens têm `cumprido_em`.
- **`parecer`:** `resultado` suficiente, insuficiente, contraditório ou dispensado.
- **`pericia`:** `perito_id` → `perito.nome`.
- **`prestacao_contas`:** `honorarios` e `recebida_em`.
- **`identificador_caso`:** `cnj`, que dá o juízo.

A Gestão (`gestao.ver`: Sócio, Sênior, líder do Atendimento e Financeiro) já tem Prazos, Tentativas bloqueadas, Uso do cofre e Configuração. A matriz diz que o Sócio vê só totais do escritório, neste painel (`valores.ver` é só do Financeiro).

### Goals / Non-Goals

**Goals:**
- indicadores do período calculados em código a partir dos desfechos gravados (CA1, CA7);
- recorte por benefício, perito, juízo e advogada;
- extinções sem mérito em destaque, com a causa (CA2);
- pareceres dispensados contra suficientes (CA3);
- totais em dinheiro só para Sócio e Financeiro (CA4);
- toda taxa com o número de casos e a data da base, sem amostra mínima (CA8, G22 de 07/10);
- Raio-X como referência e "sem dados ainda" na operação vazia (CA5) e na base do acervo (CA6).

**Non-Goals:** a lista de casos por trás de cada número; a exportação do painel; o acervo (GGVP-55); a jurimetria de perito e de juízo nos casos (GGVP-59, GGVP-64).

### Decisions

1. **Contrato** (`packages/contratos/src/resultados.ts`, novo):
   - `PedidoDoPainel` (`de`, `ate` em AAAA-MM-DD; `recorte`: benefício, perito, juízo ou advogada);
   - `Indicador`: `chave`, `rotulo`, `casos` (os que compõem o número), `valor` (taxa de 0 a 1, ou dias) e `situacao` (`ok`, `sem_dados`);
   - `PainelDeResultados`: período, indicadores do escritório, grupos do recorte, extinções por causa, pareceres, `totais` (nulo para quem não pode ver), operação e base do acervo;
   - `RAIO_X`: os agregados do Raio-X, numa constante que a tela lê do contrato (não passa pelo servidor).
2. **Cálculo** (`apps/api/src/fluxo/resultados.ts`), cada indicador pela data do seu evento no período:
   - **Deferimento no INSS:** a última decisão do caso no período (`data_decisao`); taxa = deferidos ÷ (deferidos + indeferidos).
   - **Procedência na Justiça:** casos encerrados no período com desfecho de mérito; taxa = procedentes (total ou parcial) ÷ (procedentes + improcedentes).
   - **Extinções sem mérito** (CA2): casos `extinto_sem_merito` encerrados no período, por `causa_desfecho` ("sem causa" quando falta), sobre os casos decididos no período ("3 de 59", como no protótipo). A meta é zero.
   - **Exigências cumpridas no prazo:** exigências cumpridas ou vencidas no período.
     - Está no prazo quando foi cumprida e o último `cumprido_em` dos itens é até o `prazo`.
     - Exigência sem `prazo` fica fora da conta: não há como dizer se foi no prazo (dado incerto, CA7).
     - Taxa = no prazo ÷ fechadas.
   - **Pareceres dispensados** (CA3): quantos casos com parecer `dispensado`, e a taxa de êxito deles (deferido no INSS ou procedente na Justiça, entre os decididos) contra a dos casos com parecer `suficiente`.
   - **Totais** (CA4, só com `valores.ver_totais`):
     - honorários recebidos = soma de `honorarios` das prestações com `recebida_em` no período;
     - tempo até o dinheiro = mediana dos dias entre a abertura do caso e o recebimento.
   - **Dado incerto** (CA7): caso sem a data do evento, ou com valor fora da lista, fica fora da conta e não trava nada.
3. **Sem amostra mínima** (CA8, regra do G22 de 07/10: Lucas, 06/10; Pedro, 07/10): toda taxa sai, com o número de casos e a data da base ao lado, como "73% em 11 casos · base de 07/10/2026".
   - A base é o fim do período, no máximo hoje.
   - Sem nenhum caso, aparece "sem dados ainda".
4. **Recortes:**
   - benefício: `caso.beneficio`, com o rótulo do catálogo;
   - perito: o perito da perícia do caso;
   - juízo: tribunal e origem do número CNJ, como "TRF3 · 6301";
   - advogada: a responsável pelo caso.

   Os mesmos indicadores do escritório saem por grupo, cada um com a sua amostra, inclusive os pareceres dispensados. Um caso entra no grupo quando tem decisão, exigência fechada ou parecer dispensado no período. Os totais em dinheiro (CA4) ficam só no escritório inteiro.
5. **Endpoint:** `GET /api/gestao/resultados?de&ate&recorte`, com `exigir('gestao.ver')`.
   - Período padrão: de 1º de janeiro até hoje, em Brasília. As datas são validadas pela `campos` no servidor.
   - Matriz versão 11: ação nova `valores.ver_totais` (Sócio e Financeiro).
6. **Raio-X** (CA5): os agregados de 979 processos (gerado em 21/09/2026) ficam numa constante do contrato: os seis indicadores, o que o cartório mais cobra na inicial (588 certidões) e onde julgam (foro pela origem do CNJ), lidos da Gestão do Sócio no protótipo (v2 de 02/10). O arquivo fica fora: tem nome de cliente e dado de saúde. A "Operação 2026" é só dado real.
7. **Base do acervo** (CA6): o acervo ainda não existe (GGVP-55), então a linha mostra "sem dados ainda".
8. **Sem dependência nova**, sem gráfico: números e barras simples em CSS.

### Campos de formulário

- "De" e "Até": data, com `normalizarData`, `validarData` e `dataParaIso` da `campos`, na tela e no servidor.
- "Recorte": seleção fixa (benefício, perito, juízo, advogada), validada pelo contrato.

### Telas

"Gestão · Resultados" (`/gestao/resultados`), com o link na barra do topo para quem tem `gestao.ver`, no padrão da Gestão do protótipo. A tela não esconde nada sozinha: o servidor manda `totais` nulo para quem não pode ver.

### Risks / Trade-offs

- **Poucos casos:** com poucos casos, a taxa oscila muito; o número de casos ao lado é o que deixa a pessoa julgar o número (G22).
- **Matriz de permissões:** a versão 11 pode conflitar com outro PR que suba a matriz ao mesmo tempo. Resolve-se no merge, com a impressão digital nova.
- **Juízo pela origem do CNJ:** é o código da unidade, não o nome da vara. O nome entra quando houver o cadastro de juízos (GGVP-64).
  - O tribunal sai de uma tabela fixa de 7 códigos J.TR (`TRIBUNAL_DO_JTR`): TRF1 a TRF6 e TJSP.
  - Os outros tribunais aparecem pelo próprio código, como "5.15 · 0001".
  - A tabela sai quando entrar o cadastro de juízos.
- **Leitura em memória:** o painel lê as tabelas inteiras (`caso`, `resultado_inss`, `exigencia`, `exigencia_item` e `parecer_medico`) e filtra o período em memória.
  - Serve para centenas de casos, o volume da entrega de 09/10.
  - Com milhares de casos, levar o período para o `where` de cada consulta, pela data do evento, e os grupos do recorte para um `group by`.
  - O limite também está anotado no código (`painelDeResultados`).

## GGVP-55 · Subir lote avulso de processos no acervo pelo chat e ver a base em uso na Gestão (a parte sem chat)

### Context

A tabela `processo_acervo` já existe e ninguém escreve nela ainda. Ela tem `desfecho`, `desfecho_conferido_por`, `fonte` e `criado_em`. O lote pelo chat (CA4, CA5) e a leitura dos PDFs pela IA ficam para depois de 09/10 (`kit/entrega-09-10.md`: chat com ação e IA fora). Esta entrega é a base do acervo na Gestão (CA3) e a conferência dos desfechos (CA7), sobre processos que já estão no acervo.

### Decisions

1. **Contrato** (`packages/contratos/src/acervo.ts`, novo):
   - `DESFECHOS_DO_ACERVO`: procedente, procedente em parte, acordo, improcedente, extinto sem mérito e desistência, como o Raio-X classifica;
   - `ConferenciaDoAcervo` (os pendentes e quantos já foram conferidos);
   - `ConferirDesfecho` (o desfecho conferido: o mesmo lido, ou o corrigido).

   O `baseDoAcervo` do painel ganha o caso com dados: processos, conferidos, aguardando conferência e data da base.
2. **Sem tabela nova e sem migração:**
   - aguardando conferência = desfecho lido e sem `desfecho_conferido_por`; nas contas = conferido;
   - corrigir troca o desfecho e grava o antes e o depois no histórico;
   - a data da base é a da entrada mais recente, em Brasília;
   - nada se apaga: a entrada nova soma à anterior.
3. **Item da Central:** a Sênior vê "Conferir desfechos do lote · N processos" (D4.05) só enquanto houver pendente.
   - É como a fila de revisão da vigília, sem linha em `tarefa`, que exige caso.
4. **Endpoints:** `GET /api/acervo/conferencia` e `POST /api/acervo/processos/:id/conferencia`, com `exigir('acervo.conferir_desfecho')`.
   - Matriz versão 12, ação nova só da Sênior.
   - Processo já conferido: 409.
5. **Tela "Conferir desfechos do lote"** (`/acervo/conferencia`): uma linha por processo, com "Confere" e "Corrigir".
   - Ficam de fora a seleção múltipla e a confiança da IA: são sugestões da v2, e ainda não há IA.

### Campos de formulário

- "Corrigir": seleção fixa (`DESFECHOS_DO_ACERVO`), validada pelo contrato na tela e no servidor.
- Número do processo: só exibido, com `formatarCnj` da `campos`.

### Telas

- "Conferir desfechos do lote" (`/acervo/conferencia`), aberta pela Central da Sênior.
- A linha "Base do acervo" na tela Resultados da Gestão.

### Risks / Trade-offs

- **Desfecho lido sem a IA:** enquanto não há lote pelo chat, os processos do acervo vêm dos dados de exemplo; a conferência funciona igual quando o lote chegar.
- **Matriz de permissões:** a versão 12 vem logo depois da 11 deste mesmo PR; conflito com outro PR se resolve no merge, com a impressão digital nova.

## GGVP-64 · Juízo identificado: mostrar a jurimetria (parte 1)

### Context

- **Na tela:** a sobreposição do juízo na página do caso existe (GGVP-86, do Pedro), com números de exemplo no navegador. A página do caso ainda não lê do servidor: não há `GET /api/casos/:id`.
- **No painel (GGVP-75):** o juízo já sai do número CNJ, como "TRF3 · 6301": o tribunal pelo J.TR (`TRIBUNAL_DO_JTR`) e a unidade de origem pelos 4 últimos dígitos.
- **No acervo (`processo_acervo`):** há `numero_cnj`, `caso_id`, `beneficio`, `desfecho`, `desfecho_conferido_por` e `data_decisao`. A tabela `juizo` existe, mas ninguém escreve nela.
- **Datas:** o protocolo da inicial fica em `protocolo_judicial.protocolado_em`. O acervo gravado pelo portal (o aviso do deferido, GGVP-98) ainda não tem a data da decisão.
- **Minuta da petição (GGVP-63):** monta as fontes (`FonteDaIa`) e chama o motor.
- **Vara e juiz:** nenhuma fonte de publicação traz o nome da vara nem o do juiz.

### Decisions

1. **Juízo = tribunal + unidade de origem do CNJ**, a mesma regra do painel, numa função só (`juizoDoCnj`), que o painel também passa a usar.
   - O CNJ do processo do acervo vem do `numero_cnj` ou, quando vazio, do identificador `cnj` do caso ligado.
   - Não há tabela nova. A tabela `juizo` fica para quando houver o nome da vara (parte 2).
2. **Contrato** (`packages/contratos/src/juizo.ts`, novo): `JurimetriaDoJuizo`.
   - `juizo`: o rótulo, como "TRF3 · 6301".
   - `base`: a data, em AAAA-MM-DD.
   - `porBeneficio`: benefício, procedentes, decididos e o texto do G22, como "58% em 12 processos · base de 08/10".
   - `tempoAteASentenca`: meses e processos, ou nulo.
   - `processos`: o CNJ e o desfecho de cada processo do juízo que entrou na conta.
3. **Cálculo em código** (`apps/api/src/fluxo/juizo.ts`), só com desfecho conferido (GGVP-55 CA7):
   - **Procedência por benefício** = procedentes (total ou parcial) ÷ decididos no mérito (procedentes e improcedentes), a mesma regra do painel. Acordo, extinção e desistência ficam fora da taxa.
   - **Tempo até a sentença** = média em meses entre o protocolo da inicial e a data da decisão, só dos processos que têm as duas datas. Os outros ficam fora da conta e nada trava.
   - **Base** = hoje, em Brasília. Toda taxa sai com o número de processos e a data da base, sem amostra mínima (G22, regra de 07/10).
4. **Rota:** `GET /api/casos/:id/juizo`, com `exigir('estudo.ver')`, que é do Jurídico.
   - A jurimetria é interna: nunca vai ao cliente nem ao Atendimento. Não há versão nova da matriz.
   - Caso sem número do processo: 404 com "O caso ainda não tem número de processo".
5. **Minuta da petição** (CA3, CA6): com o juízo identificado, a resposta ganha uma fonte do tipo `acervo` com as taxas do juízo, no texto do G22, que a advogada vê nas fontes.
   - A fonte entra depois do modelo: o modelo não recebe os números do juízo, nem no conteúdo nem nas fontes que vão a ele, então o número não tem como entrar no texto que vai ao juiz.
   - O teste confere o pedido enviado ao modelo.
6. **Dados de exemplo:** processos conferidos no acervo na unidade do caso judicial de exemplo, com benefícios variados. Alguns têm a data da decisão e estão ligados a caso com protocolo, para a taxa e o tempo aparecerem.

### Campos de formulário

Nenhum nesta parte.

### Telas

Nenhuma tela nova.
- A fonte nova aparece na lista de fontes da minuta, que já existe.
- A sobreposição da página do caso continua com os números de exemplo até a página ler do servidor (parte 2).

### Risks / Trade-offs

- **Unidade de origem não é a vara:** onde a unidade tem várias varas (por exemplo, o JEF de São Paulo, 6301), a conta junta as varas. O nome da vara e o do juiz entram na parte 2.
- **Poucos processos:** a taxa oscila. O número de processos ao lado é o que deixa a advogada julgar (G22).
- **Tempo até a sentença:** hoje, só os processos protocolados pelo portal com a data da decisão gravada têm as duas datas. Os importados ficam fora até o estudo trazer a data da distribuição.
- **A inicial ainda não tem número:** a minuta da petição inicial é escrita antes do protocolo, quando o caso quase nunca tem número de processo. A fonte do juízo só vem quando o caso já tem um número (por exemplo, um novo processo depois de um perdido). Prever o juízo pela cidade do cliente fica para a parte 2, se o escritório quiser.

## GGVP-64 · Juízo identificado: mostrar a jurimetria (parte 2, 09/10)

### Context
- A parte 1 está no PR #11, em revisão: o juízo pelo CNJ (`juizoDoCnj`), a jurimetria em código e `GET /api/casos/:id/juizo`.
- A página do processo ainda roda com dados de exemplo no navegador; ligá-la ao servidor é da GGVP-146 (Pedro, em andamento).
- A recomendação de recurso depende da GGVP-100, travada pela Q26.
- O nome do órgão do DJEN só vem com o PR das fontes reais (AASP e DJEN), ainda aberto.
- A tabela `juizo` (tribunal, nome) existe e ninguém escreve nela.

### Decisions
1. **Vara e juiz pela leitura da publicação** (CA1):
   - a leitura da IA (`classificar_publicacao`, versão 4) devolve também `vara` e `juiz` quando estão escritos no texto, ou nulo;
   - a tela de leitura ganha os campos "Vara" e "Juiz", preenchidos pela sugestão; a pessoa confere e manda junto com a classificação;
   - o caso guarda os dois (`caso.vara` e `caso.juiz`, migração nova); campo vazio não apaga o que já estava; o histórico guarda o antes e o depois.
2. **Entendimentos recorrentes** (CA2, CA5):
   - a IA (finalidade `entendimentos_do_juizo`, versão 1, JSON, leva dado de saúde, barra CID) lê as decisões de mérito dos processos do mesmo juízo (as publicações de mérito dos casos com CNJ daquele juízo, as últimas 10), cada uma sem dado pessoal (`anonimizar`, com o nome do cliente);
   - devolve até 5 entendimentos, cada um com os números dos processos de exemplo; o código só aceita processos que estavam no conteúdo, e não há porcentagem no texto;
   - roda em segundo plano, pela sugestão pronta, e fica na tabela `juizo` (uma linha por juízo, `nome` com o rótulo do CNJ, como "TRF3 · 6301"; colunas novas `entendimentos` e `entendimentos_em`). Decisão nova no juízo, a rodada refaz.
3. **Contrato:** `JurimetriaDoJuizo` ganha `vara` e `juiz` (do caso, ou nulos) e `entendimentos` (texto e processos); `LeituraDaPublicacaoPelaIa` e `ClassificarPublicacao` ganham `vara` e `juiz` opcionais, até 120 caracteres.
4. **Na peça** (CA6): quando o caso já tem juízo, a minuta manda ao modelo os entendimentos e os processos de exemplo, sem número do juízo; as fontes da advogada mostram o que foi usado. Antes do protocolo, sem juízo, nada muda.
5. **Sem dependência nova.**

### Campos de formulário
- **"Vara"** e **"Juiz"** (leitura da publicação): texto curto, até 120 caracteres, opcionais, validados pelo contrato na tela e no servidor. Não são dados da biblioteca `campos` (não é CPF, data, número nem nome de pessoa a validar).

### Telas
Nenhuma tela nova. A leitura da publicação ganha "Vara" e "Juiz". A sobreposição da página do processo continua com os números de exemplo até a página ler do servidor.

### Risks / Trade-offs
- **Entendimentos com poucas decisões:** com uma ou duas decisões, o "recorrente" é fraco; cada entendimento mostra os processos de exemplo, e a advogada julga.
- **Vara digitada de dois jeitos:** fica como foi conferida; o juízo da jurimetria continua sendo o do CNJ.

## GGVP-141 · Acervo alimentado pelo que as telas do Pedro conferem, com busca por significado (parte 1)

### Context

- **A busca de hoje** (`buscarNoAcervo`, GGVP-45) é por palavra, com o full text do PostgreSQL calculado na hora. Ela olha cinco fontes: a petição aprovada, a decisão de mérito, o motivo de indeferimento, o modelo de petição e o estudo de caso da IA. O trecho sai anonimizado (`anonimizar`).
- **O motor** (`ia.ts`) registra cada chamada em `chamada_ia`. Dado de saúde só passa com `IA_PERMITE_DADO_DE_SAUDE=sim`.
- **A conversa do Relacionamento** fica em `atendimento.dados` (JSON), com `conferidaEm` quando a pessoa confere. A análise marca a mudança de saúde (`saude`), e a gravação pode ser só do Jurídico (`soJuridico`).
- **No banco embutido:** o PGlite dos testes (0.3.16) traz a extensão `vector`, e o Drizzle 0.44 tem o tipo `vector`.
- **A escolha técnica** foi registrada pelo Pedro na GGVP-134 (08/10) e vira o ADR-013.

### Decisions

1. **ADR-013** (`docs/decisoes/ADR-013-base-de-conhecimento.md`):
   - pgvector no PostgreSQL do Supabase, com índice HNSW;
   - busca híbrida, misturada por RRF;
   - embeddings da OpenAI (`text-embedding-3-small`, 1536 dimensões);
   - TypeScript dentro da API, sem banco nem serviço novo.
2. **Tabela `acervo_trecho`** (migração nova), com RLS ligado:
   - `origem`: o rótulo da fonte;
   - `referencia`: `caso:<id>` ou `modelo:<id>`, a mesma da busca de hoje;
   - `caso_id` e `beneficio`;
   - `texto`: já anonimizado;
   - `so_juridico`;
   - `embedding vector(1536)`: nulo até ser calculado, com índice HNSW pela distância de cosseno;
   - `hash`: único, para não duplicar (CA3);
   - `criado_em`.

   A migração liga a extensão (`create extension if not exists vector`), e o banco embutido passa a carregá-la.
3. **Vetor pelo motor** (CA4): `ia.vetor(texto, { saude })` chama o endpoint de embeddings da OpenAI e registra em `chamada_ia`, com a finalidade `vetor_acervo`.
   - Sem chave, ou com saúde sem autorização, devolve nulo, e a busca segue só por palavra.
4. **Alimentar o acervo** (CA1, CA3): `alimentarAcervo` lê as fontes de hoje e as conversas conferidas, anonimiza com a mesma `anonimizar` e calcula o hash.
   - Grava só o que ainda não está lá e depois calcula o vetor do que falta.
   - Roda em segundo plano numa chamada própria do servidor, na mesma batida de 5 minutos da sugestão pronta, logo depois dela. Dentro da rodada das sugestões, ela mexeria nos testes das rotas que rodam essa rodada.
   - Entram com `so_juridico`:
     - os documentos do caso (petição aprovada, decisão de mérito, motivo de indeferimento e estudo de caso), que podem trazer dado de saúde;
     - a conversa com mudança de saúde ou com gravação só do Jurídico.

     O modelo da casa não tem dado de cliente.
5. **Busca híbrida** (CA2): `buscarNoAcervo` faz a busca por palavra de hoje e, quando há vetor da consulta, a busca por significado nos trechos.
   - As duas listas se misturam pelas posições (RRF, k = 60).
   - A saída são as mesmas fontes de hoje: `tipo: acervo`, a referência e o trecho.
   - O mesmo caso fica de fora, e o benefício filtra como hoje.
   - Trecho `so_juridico` só entra com `saude: true`. Os 5 fluxos que buscam no acervo passam a saúde pela finalidade da IA, e todas essas finalidades já levam dado de saúde: a minuta da petição, o estudo de caso, a análise do indeferimento, a exigência do juiz e a recomendação da perícia.

### Campos de formulário

Nenhum.

### Telas

Nenhuma tela nova. As fontes aparecem onde já aparecem.

### Risks / Trade-offs

- **Número da migração:** a Perícia entrou antes na `main` com a 0018 (08/10), e a migração do acervo foi renumerada para 0019 (`0019_base_de_conhecimento`).
- **Extensão no Supabase:** se o usuário do banco não puder criar a extensão, a migração falha e o container não sobe; o Coolify mantém a versão anterior. Ligar a extensão no painel do Supabase antes do deploy.
- **Custo:** só o que é novo ganha vetor, porque o hash evita recalcular. A consulta também gasta uma chamada de embeddings.
- **Leitura das fontes:** a cada rodada, alimentar lê as fontes inteiras e compara pelo hash. Com milhares de itens, guardar a última data lida por fonte.

## GGVP-59 · Perito nomeado: identificar e mostrar a jurimetria (parte 1)

### Context

- **A Perícia está no servidor** (GGVP-137 e GGVP-139, PR #8):
  - o perfil do perito (`perito.perfil`), com um laudo por linha, atualizado quando a advogada confere o resultado (GGVP-73);
  - a pergunta de um clique que liga o perito (`POST /api/processos/:id/pericia/perito`, GGVP-61 CA6);
  - a orientação pelo perfil na Justiça e a padrão no INSS;
  - os números do perito calculados em código, com o G22 (as regras `periciaNoCaso` das telas do Pedro, rodando no servidor).
- **A leitura da publicação** (GGVP-34, 37 e 74) classifica em andamento, exigência e mérito. O prazo é contado em código (`prazoJudicial`), e `encaminhar` abre a tarefa da advogada pela classe. Sem prazo na decisão, valem 5 dias (CPC, art. 218, §3º).
- **A tabela `perito`** tem o nome, o nome normalizado e as grafias conhecidas.
- **Passos do BPMN:** o DP.05 (identificar o perito nomeado) e o D4.02N, ainda sem desenho no Miro.
- **A tarefa** não tem campo de descrição: o perito vai ao histórico do caso.

### Decisions

1. **Classe nova** `nomeacao_perito` em `CLASSES_DE_ATO`, com o rótulo "Nomeação de perito".
   - Entra na leitura da IA (`LeituraDaPublicacaoPelaIa`) e na instrução de `classificar_publicacao`, que ganha versão nova.
   - A IA só sugere; quem classifica é a pessoa.
2. **Prazo dos quesitos:** sem prazo no despacho, 15 dias (CPC, art. 465, §1º: quesitos, assistente técnico e impugnação do perito), no lugar dos 5 do art. 218.
   - Com prazo no despacho, vale o do despacho.
   - A contagem é a do prazo judicial: dias úteis e feriados do tribunal; na dúvida, a data mais cedo (G12).
3. **Destino:** `encaminhar` abre a etapa DP e a tarefa "Quesitos e assistente técnico" (DP.05) para a advogada, com o prazo. Reclassificar desfaz como hoje: a tarefa aberta da nomeação é cancelada (GGVP-37 CA7).
   - Na Central, a tarefa abre a tela de perícias do caso (`/casos/:id/pericias`), onde a advogada escreve os quesitos (ajuste do "Agora ok?", Mateus, 08/10).
4. **O perito do texto** (`peritoDaPublicacao`): procura, no texto normalizado (minúsculo e sem acento), o nome normalizado e as grafias de cada perito da base. Se mais de um bater, vale o nome mais longo.
   - Achou: o histórico grava `perito_nomeado`, com o perito e quantos laudos o perfil tem.
   - Não achou: o histórico grava que o perito não foi reconhecido, e nada trava. A pergunta de um clique da Perícia resolve (CA6).
5. **Banco:** a migração `0021_nomeacao_de_perito` troca a restrição da classe da publicação para aceitar a classe nova. A lista de classes vem do contrato: uma só para a tela, o servidor e o banco.
   - Nasceu como 0020 e passou a 0021 no merge da `main` de 08/10, quando a documentação médica (#6) entrou com a 0019 e o acervo (GGVP-141) foi para a 0020.

### Campos de formulário

- **"Tipo de ato":** seleção fixa (`CLASSES_DE_ATO`), com a opção nova, validada pelo contrato na tela e no servidor.
- **"Dias":** o mesmo campo de hoje (1 a 120), ou "sem prazo na decisão", que mostra os dias que valem: 15 na nomeação de perito, 5 nos outros tipos.

### Telas

Nenhuma tela nova. A tela de leitura da publicação ganha a opção "Nomeação de perito" e a frase de destino: "Quesitos e assistente técnico na Central da advogada".

### Risks / Trade-offs

- **Nome do perito no texto:** o reconhecimento é pelo nome e pelas grafias da base. Perito novo, ou grafia diferente, fica como não reconhecido, e a pessoa liga pela pergunta de um clique.
- **Perícia judicial:** nesta parte, o perito não é ligado direto na perícia judicial a partir da publicação; isso mexe no modelo da Perícia do Pedro e fica para a parte 2.
