# Design · GGVP-14 IA jurídica

## GGVP-106 · Guardrails de IA e do chat

### Context

O banco já separa a sugestão da IA da decisão da pessoa (`decisao.sugestao_ia`, `parecer_medico.sugestao_ia`, `publicacao.classe_sugerida_ia`), e todo portão é validado no servidor sobre a ação de uma pessoa (GGVP-109). Falta o lugar único por onde passa toda chamada à IA: quem chama, com que finalidade, o que voltou, e o registro para auditoria.

### Decisions

1. **Um módulo só** (`apps/api/src/ia/`), com duas portas: `sugerir` (OpenAI, Chat Completions) e `lerDocumento` (Mistral OCR). Chamada por `fetch` do Node, sem dependência nova. O `fetch` entra como parâmetro, e os testes nunca chamam o serviço de verdade.
2. **Sem chave, IA desligada:** `OPENAI_API_KEY` e `MISTRAL_API_KEY` vêm do ambiente (`.env.ia` local, que o `pnpm dev` da API passa a ler, e Coolify). Sem chave, ou com o serviço fora do ar, a função devolve "sem sugestão" e grava a tentativa; a tela segue manual e nada trava.
3. **Modelo configurável:** `OPENAI_MODELO` (padrão `gpt-4.1-mini`) e `MISTRAL_MODELO_OCR` (padrão `mistral-ocr-latest`). O modelo e a versão da instrução vão no registro (CA4).
4. **A IA só sugere** (CA1, CA2): o módulo não grava decisão, tarefa nem estado de caso; devolve uma `SugestaoDaIa` (marcada como sugestão, com as fontes, o modelo e o id da chamada). Quem grava a decisão é a rota da pessoa, com o perfil da sessão, como já é hoje.
5. **Registro de toda chamada** (CA4): tabela nova `chamada_ia` (migração 0013, RLS ligado): finalidade, fornecedor, modelo, versão da instrução, caso, quem pediu, entrada resumida (tamanho e hash, nunca o conteúdo), fontes, saída, situação (`ok`, `desligada`, `falhou`, `recusada`), erro e duração. A saída pode ter dado de saúde: a auditoria (`GET /api/casos/:id/ia`) mostra a saída só a quem tem `dado_saude.ver_detalhe` e grava o acesso em `acesso_dado_sensivel`.
6. **Dado de saúde só com autorização** (pergunta ao Lucas): cada finalidade diz se leva dado de saúde; documento com `sensivel = true` também. Enquanto `IA_PERMITE_DADO_DE_SAUDE` não for `sim` no ambiente, o módulo recusa (situação `recusada`) sem chamar o serviço.
7. **Números vêm de código** (CA11): a instrução de sistema de toda finalidade manda a IA não calcular e usar só os números que o sistema passa, com o número de casos ao lado (G22). O teste confere a instrução.
8. **Conteúdo de fora é dado, não ordem:** o texto do documento ou da publicação vai num bloco marcado como conteúdo, separado da instrução. A defesa completa e os testes de injeção são da GGVP-110 (CA12).

### O que fica com cada função (critérios do cartão)

- CA3 (versões da peça): `peticao_versao`, já na Judicialização; a minuta da IA grava a versão com quem pediu quando ligar.
- CA5 (benefício na entrevista), CA6 (laudo novo, G20 e G17) e CA7 (comprovante da perícia): entram nas histórias dessas telas, sobre `sugerir` e `lerDocumento`.
- CA8, CA9, CA10 e CA13 (cards do chat que executa): fora até 09/10; o chat só consulta.

### Contratos (`packages/contratos/src/ia.ts`)

- `SugestaoDaIa`: `{ chamadaId, sugestao: true, texto, fontes: { tipo, referencia, trecho? }[], modelo, geradaEm }`.
- `ChamadaDaIa` (auditoria): `{ id, finalidade, fornecedor, modelo, situacao, quem, quando, fontes, saida | null }`.

## GGVP-45 · Buscar no acervo antes de escrever

### Decisions
- **Busca por texto no PostgreSQL, sem tabela nova.** `buscarNoAcervo` (`apps/api/src/ia/acervo.ts`) junta, numa consulta, petições aprovadas, decisões de mérito publicadas e motivos de indeferimento de outros casos (mesmo benefício quando o caso tem) e os modelos de petição ativos; ordena por `ts_rank` com `to_tsvector('portuguese')` contra as palavras do pedido (OU entre elas) e devolve até 3. Calculado na hora, sem índice: o acervo é pequeno. Índice GIN ou embeddings (pgvector) quando o volume ou a qualidade pedirem.
- **Só o que uma pessoa aprovou ou registrou.** Versão não aprovada, rascunho da IA e publicação sem classe não entram.
- **Anonimizar antes de sair do banco.** CPF, CEP, telefone, e-mail, endereço e o nome do cliente de origem viram marcadores; o trecho tem até 400 caracteres.
- **A fonte diz a origem.** `tipo: 'acervo'`, `referencia: 'caso:<id>'` (ou `modelo:<id>`), `trecho: '<de onde>: <texto>'`.

## GGVP-54 · A IA analisa o motivo do indeferimento

### Decisions
- Finalidade `analisar_indeferimento` (JSON, leva dado de saúde, não barra CID: é leitura interna da Sênior). Saída validada por `AnaliseDoIndeferimentoPelaIa`; fora do formato, sem sugestão.
- A análise chega pronta (ver "Sugestão pronta") e preenche o formulário; o prazo continua pergunta da Sênior.
- `Despachar` aceita `chamadaIaId`; o despacho grava `decisao.sugestao_ia = { chamadaId }` (a saída completa está em `chamada_ia`).

## GGVP-67 · A IA faz outra versão da petição

### Decisions
- A IA não grava versão: a sugestão cai na caixa de "Editar eu mesma" e a rota de versões que já existe grava (com o tratamento do CA7 depois da aprovação). Uma rota de gravação só, um caminho para a versão nova.
- Finalidade `nova_versao_peticao`: recebe a última versão e o pedido; mantém o resto do texto; mesmas regras da minuta (não inventar, sem organização interna, sem número de jurimetria). Leva dado de saúde e não barra CID (a peça cita o CID do laudo do caso).
- A marca fica em `peticao_versao.gerada_por` ("<nome> · versão da IA"), como na versão 1 da minuta; a chamada vai para o histórico da versão nova (`chamadaIa`).

## GGVP-79 · A IA sugere as tarefas da exigência do juiz

### Decisions
- Mesmo desenho da análise do indeferimento: finalidade `analisar_exigencia_juiz` (JSON, leva dado de saúde, não barra CID), saída validada por `AnaliseDaExigenciaPelaIa`, pronta ao abrir, sem gravar nada. O acervo é consultado pelo texto da publicação (GGVP-45).
- A sugestão preenche decisão, itens (setor, o que cumprir, prova esperada) e perícia; o prazo interno fica vazio, porque é decisão da advogada e o servidor confere que não passa do processual.
- A decisão `D3a.02` grava `sugestao_ia = { chamadaId }` quando a advogada partiu da sugestão.

## Sugestão pronta, sem botão (Mateus, 07/10)

### Context
Com o botão "Sugerir com a IA", a pessoa às vezes nem clica e a sugestão fica para trás. Pedido do Mateus: em toda tarefa, a sugestão já aparece quando a pessoa abre; botão só para pedir algo novo (outra versão da petição).

### Decisions
- **Guardada pelo conteúdo, na tabela do registro.** `chamada_ia` já guarda `entrada_hash` (sha256 do conteúdo). `sugerir` procura a última chamada `ok` com a mesma finalidade, versão da instrução, modelo, caso e `entrada_hash` e devolve essa, sem chamar a IA. Sem tabela nova nem migração. ponytail: sem índice; índice em (`caso_id`, `entrada_hash`) quando o registro crescer.
- **Só fica guardado o que passou no formato.** As rotas passam `validar` para `sugerir`; saída que não passa fica `falhou` ("saída fora do formato") e não é reaproveitada. A tela mostra uma mensagem só: "A IA não respondeu agora".
- **Preparo em segundo plano.** Cada rota com IA registra no `preparo` como achar o que está esperando (tarefas abertas do passo, publicações sem classe) e como preparar a sugestão de um, com a mesma função da rota. `principal.ts` roda uma rodada ao subir e a cada 5 minutos; sem chave, não roda. Em segundo plano, cada conteúdo tem uma tentativa (`soPreparar`): falhou, só tenta de novo quando a pessoa abre.
- **Pedidos iguais ao mesmo tempo, uma chamada.** `sugerir` junta numa chamada só os pedidos iguais em curso. ponytail: por processo; com mais de uma instância da API, trava no banco.
- **A tela pede sozinha.** Ao abrir a tarefa, a tela chama a rota da sugestão (que devolve a guardada na hora) e preenche o formulário se a pessoa ainda não mexeu. Botão só para pedir de novo: "Escrever de novo com a IA" (minuta) e "Pedir outra versão à IA" (petição), que passam `refazer`.
- **Minuta com o padrão do pedido.** Pronta com todos os documentos do caso marcados (na ordem em que chegaram, sem a carta, que entra sempre), "usar precedentes do acervo" marcado e sem instruções; a tela abre com o mesmo padrão marcado, para a minuta e o pacote baterem.
- **Chance.** O histórico `chance_mostrada` continua só quando a tela mostra; a rodada de preparo não registra.

## GGVP-19 · Estudo de caso do processo perdido

### Decisions
- **Automático, pelo preparo.** A rota de estudos registra no `preparo` os casos perdidos (`improcedente`, `extinto_sem_merito`) sem estudo `ok`; a rodada faz o estudo (finalidade `estudo_de_caso`, JSON, leva dado de saúde, não barra CID: é estratégia interna). Uma vez por caso: com estudo, o caso sai da lista.
- **O estudo é a chamada da IA.** Sem tabela nova: o estudo é a saída `ok` (validada por `EstudoDaIa`) da finalidade `estudo_de_caso` em `chamada_ia`; a tela lê a mais nova de cada caso. A revisão da Sênior é uma `decisao` (passo `D3b.05`, tipo `estudo_caso`), com a chamada em `sugestao_ia`.
- **CA4: o estudo abre a explicação.** Feito o estudo, `abrirExplicacaoDoResultado` (que agora não reabre se o caso já teve a tarefa); a confirmação do resultado, quando existir, chama a mesma função sem depender da IA.
- **Tarefa só com novo processo.** Estudo com `novoProcesso` abre, uma vez por caso, "Revisar estudo de caso" (passo `D3b.05`) para a Sênior, que leva a `/estudos`. Decidir fecha a tarefa; abrir o novo processo é da GGVP-124.
- **Chance sem número.** "Tínhamos mais/menos chance" é a leitura da IA sobre as provas do caso, não porcentagem (número é código, G19/G22).
- **Permissões novas.** `estudo.ver` (Jurídico) e `estudo.revisar` (Sênior); matriz v13. Quem mesclar com o PR #23 renumera a versão, como já previsto.
- **No acervo.** `buscarNoAcervo` passa a ler o motivo e o aprendizado dos estudos, como "Estudo de caso da IA".
- **Baixar.** O arquivo é texto simples, montado na tela com os estudos listados (sem rota nova).

## GGVP-38 · Recomendação sobre a perícia

### Decisions
- **Pronta, pelo preparo.** A rota de perícias registra no `preparo` as perícias sem resultado e sem recomendação aprovada; a rodada faz a recomendação (finalidade `recomendacao_pericia`, JSON validado por `RecomendacaoDaIa`, leva dado de saúde; não barra CID, porque os quesitos podem citar o CID do laudo, e a instrução tira CID e diagnóstico do "o que levar", que vai ao cliente). Feita a recomendação, nasce "Conferir a recomendação da perícia" (`DP.00`) para a advogada, uma por caso.
- **Judicial é a do juiz.** A origem vem da etapa que pediu a perícia: `D3a` (exigência do juiz) é judicial e traz quesitos e assistente técnico; `D2` (INSS) e `D3` (despacho) não.
- **Aprovação sem tabela nova.** A aprovação é uma `decisao` (passo `DP.00`, tipo `recomendacao_pericia`) com o que a advogada aprovou em JSON na justificativa (com o id da perícia) e a chamada da IA em `sugestao_ia`. A tarefa fecha quando nenhuma perícia do caso espera aprovação.
- **Permissões que já existem.** Ver: `dado_saude.ver_detalhe` (Jurídico), porque a recomendação sai do parecer e dos laudos; aprovar: `pericia.decidir` (advogada), a mesma de "Precisa de perícia?". Sem versão nova da matriz.
- **Sem o perito.** O perito ainda não é identificado (GGVP-59); o conteúdo diz "perito não identificado" e a recomendação sai sem a jurimetria dele.

## GGVP-41 · Medir ganho e perda e gravar no acervo (parte 1)

### Context
- O caso ganho já entra em `processo_acervo` (fonte `portal`) na ida ao banco (GGVP-98), sem conferência; o código deixa essa conferência para esta história.
- "Conferir desfechos" (GGVP-55) lista todo desfecho sem conferência, também os do portal, e só o conferido conta.
- O estudo de caso (GGVP-19) já tira do caso perdido a matéria, a vara, a tese, o resumo e o aprendizado.
- O painel (GGVP-75) recorta por benefício, perito, juízo e advogada, com o G22.
- Na `main`, o desfecho de mérito do caso só existe pela semente e pela desistência: a confirmação do resultado na Justiça é da GGVP-90 e da GGVP-100, com o Lucas.

### Decisions
1. **Contrato** (`packages/contratos/src/acervo.ts` e `resultados.ts`):
   - `FichaDoDesfecho`: `materia`, `vara` (ou nula), `tese` (até 80 caracteres, ou nula quando não dá para saber), `resumo` e `licao`.
   - `ConferenciaDoAcervo.pendentes[]` ganha `ficha`; nula quer dizer "a IA ainda não leu este desfecho".
   - `ConferirDesfecho` ganha `tese` (opcional, até 80 caracteres): a Sênior confirma ou corrige.
   - `DESFECHOS_DO_ACERVO` ganha `deferido` ("Deferido no INSS"): o caso ganho no INSS entra no acervo assim (GGVP-98), e a conferência não aceitava (ajuste do Mateus, 08/10).
   - `RECORTES` ganha `tese`, com o rótulo "Tese".
2. **Banco:** `processo_acervo` ganha `materia`, `vara`, `tese`, `resumo` e `licao` (migração nova; quem entrar depois renumera). Sem tabela nova: a ficha é do registro do acervo.
3. **A ficha pela IA, em segundo plano** (finalidade `ficha_do_desfecho`, versão 1, JSON validado por `FichaDoDesfecho`, leva dado de saúde, barra CID), em `fluxo/ficha-do-desfecho.ts`, registrada no `preparo` por `rotas/acervo.ts`:
   - entram os registros do portal (com `caso_id` e desfecho) sem ficha;
   - o conteúdo leva o benefício, o desfecho, a última decisão de mérito ou o resultado do INSS e a petição aprovada, cortada como no estudo;
   - a instrução pede a tese jurídica sem doença, diagnóstico nem CID, e a lição numa frase;
   - antes de gravar, o resumo e a lição passam por `anonimizar`, com o nome do cliente (CA10);
   - se falhar ou não houver chave, a ficha fica nula, a conferência mostra "a IA ainda não leu este desfecho" e o preparo tenta de novo no dia seguinte (CA11): uma tentativa por conteúdo e por dia, a regra de toda IA em segundo plano (GGVP-106), confirmada pelo Mateus em 08/10. A falha fica em `chamada_ia`.
4. **O caso perdido entra pelo estudo** (CA1, CA4, CA9): saindo o estudo `ok`, o caso entra em `processo_acervo` (fonte `portal`, com o desfecho do caso) e a ficha do estudo (o aprendizado vira a lição), anonimizada, sem outra chamada à IA. Um registro por caso: se ele já existe, só completa a ficha que falta.
5. **Conferência** (CA7): a linha do portal mostra a ficha. "Conferir" leva o desfecho e a tese, a da IA ou a corrigida, e o histórico guarda o antes e o depois, com a tese. Só a ficha conferida entra nas contas.
6. **Recorte por tese** (CA3, CA5, CA8): `gruposDoRecorte` lê a tese dos registros conferidos com `caso_id`. Sem tese, o caso fica fora do recorte (CA5). Os indicadores e o G22 são os do painel. A matéria é o recorte por benefício e a vara é o recorte por juízo, que já existem.
7. **Sem dependência nova.**

### Campos de formulário
- **"Tese"** (Conferir desfechos): texto curto, até 80 caracteres, validado pelo contrato na tela e no servidor. Não é dado da biblioteca `campos` (não é CPF, data, número nem nome).
- **"Desfecho"**: a mesma seleção de hoje (`DESFECHOS_DO_ACERVO`).
- **"Recorte"** (Gestão): a mesma seleção, com a opção "Tese".

### Telas
Nenhuma tela nova. "Conferir desfechos" mostra a ficha na linha do portal e ganha o campo "Tese"; "Resultados" ganha a opção "Tese" no recorte.

### Risks / Trade-offs
- **Tese em texto livre:** a mesma tese escrita de dois jeitos vira dois grupos; a Sênior corrige na conferência. Um catálogo de teses fica para quando houver dado.
- **Perdido na Justiça:** hoje só a semente tem desfecho de mérito; o caminho pelo portal vem com a GGVP-100.
