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
- "amostra insuficiente" abaixo do mínimo (CA8, G22);
- Raio-X como referência e "sem dados ainda" na operação vazia (CA5) e na base do acervo (CA6).

**Non-Goals:** a lista de casos por trás de cada número; a exportação do painel; o acervo (GGVP-55); a jurimetria de perito e de juízo nos casos (GGVP-59, GGVP-64).

### Decisions

1. **Contrato** (`packages/contratos/src/resultados.ts`, novo):
   - `PedidoDoPainel` (`de`, `ate` em AAAA-MM-DD; `recorte`: benefício, perito, juízo ou advogada);
   - `Indicador`: `chave`, `rotulo`, `casos` (os que compõem o número), `valor` (taxa de 0 a 1, ou dias) e `situacao` (`ok`, `amostra_insuficiente`, `sem_dados`);
   - `PainelDeResultados`: período, indicadores do escritório, grupos do recorte, extinções por causa, pareceres, `totais` (nulo para quem não pode ver), operação e base do acervo;
   - `RAIO_X`: os agregados do Raio-X, numa constante que a tela lê do contrato (não passa pelo servidor).
2. **Cálculo** (`apps/api/src/fluxo/resultados.ts`), cada indicador pela data do seu evento no período:
   - **Deferimento no INSS:** a última decisão do caso no período (`data_decisao`); taxa = deferidos ÷ (deferidos + indeferidos).
   - **Procedência na Justiça:** casos encerrados no período com desfecho de mérito; taxa = procedentes (total ou parcial) ÷ (procedentes + improcedentes).
   - **Extinções sem mérito** (CA2): casos `extinto_sem_merito` encerrados no período, por `causa_desfecho` ("sem causa" quando falta), sobre os casos decididos no período ("3 de 59", como no protótipo). A meta é zero.
   - **Exigências cumpridas no prazo:** exigências cumpridas ou vencidas no período.
     - Está no prazo quando foi cumprida e o último `cumprido_em` dos itens é até o `prazo`.
     - Taxa = no prazo ÷ fechadas.
   - **Pareceres dispensados** (CA3): quantos casos com parecer `dispensado`, e a taxa de êxito deles (deferido no INSS ou procedente na Justiça, entre os decididos) contra a dos casos com parecer `suficiente`.
   - **Totais** (CA4, só com `valores.ver_totais`):
     - honorários recebidos = soma de `honorarios` das prestações com `recebida_em` no período;
     - tempo até o dinheiro = mediana dos dias entre a abertura do caso e o recebimento.
   - **Dado incerto** (CA7): caso sem a data do evento, ou com valor fora da lista, fica fora da conta e não trava nada.
3. **Amostra mínima** (CA8, G22): `AMOSTRA_MINIMA = 8` casos no denominador, em código e com teste. É o mínimo que a Gestão do protótipo já usa. Abaixo dele, a taxa não sai e aparece "amostra insuficiente". Sem nenhum caso, aparece "sem dados ainda".
4. **Recortes:**
   - benefício: `caso.beneficio`, com o rótulo do catálogo;
   - perito: o perito da perícia do caso;
   - juízo: tribunal e origem do número CNJ, como "TRF3 · 6301";
   - advogada: a responsável pelo caso.

   Os mesmos indicadores saem por grupo, cada um com a sua amostra.
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

- **Poucos casos:** com poucos casos decididos, quase tudo sai "amostra insuficiente". É o que o G22 pede, e os dados de exemplo trazem um recorte com amostra para a tela poder ser conferida.
- **Matriz de permissões:** a versão 11 pode conflitar com outro PR que suba a matriz ao mesmo tempo. Resolve-se no merge, com a impressão digital nova.
- **Juízo pela origem do CNJ:** é o código da unidade, não o nome da vara. O nome entra quando houver o cadastro de juízos (GGVP-64).
