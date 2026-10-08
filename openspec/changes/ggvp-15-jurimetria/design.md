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
