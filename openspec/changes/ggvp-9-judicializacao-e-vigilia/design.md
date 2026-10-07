# Design · GGVP-9 Judicialização e vigília

## Grupo 1 · GGVP-26, GGVP-30, GGVP-34, GGVP-37 e GGVP-74

### Context

O modelo de dados da fundação já tem `publicacao` (fonte, CNJ, caso, data de disponibilização, texto, hash único, classe), `rodada_vigilia` (fonte, prevista para, início, fim, situação, capturadas, erro, quem reprocessou), `prazo` (caso, origem, publicação, início, fim, regra), `feriado` (data, tribunal; nulo é nacional), `identificador_caso` (tipo `cnj`), `configuracao` e `tarefa`. `@ggv/campos` tem `normalizarCnj` e `validarCnj`. A Central do perfil vem de `GET /api/tarefas`, que já monta linhas calculadas para a Sênior (alerta da exigência do INSS). O prazo do INSS já é código (`apps/api/src/fluxo/prazo-inss.ts`).

### Goals / Non-Goals

**Goals:** fontes de publicação atrás de uma interface, com uma fonte de exemplo até as credenciais; rodadas 3 vezes por dia com registro, alarme, "não rodou" e reprocessamento (G13); casamento pelo CNJ com descarte de repetidas registrado; fila de revisão da Sênior; leitura e classificação por pessoa; prazo judicial em código, versionado, pelo lado seguro (G12, G19); encaminhamento pelo tipo de ato.

**Non-Goals:** AASP e DJEN reais (entram no grupo 4, em 07/10); IA (GGVP-14); tela de analisar a exigência do juiz (GGVP-79) e de confirmar o desfecho (GGVP-90); canal do alarme ao suporte técnico; prazo em dobro do INSS (CPC, art. 183) e regras de recurso por rito, que a pessoa informa ao classificar.

### Decisions

1. **Matriz versão 5**, ações novas: `vigilia.ver` (senior, advogada), `vigilia.reprocessar` (senior), `publicacao.casar` (senior: a fila sem CNJ, resposta do revisor de 06/10) e `publicacao.classificar` (advogada, senior).
2. **Fontes** (`apps/api/src/vigilia/fontes.ts`): `type Fonte = { nome: 'aasp' | 'djen' | 'exemplo'; buscar(de: Date, ate: Date): Promise<PublicacaoBruta[]> }`, com `PublicacaoBruta = { fonte, numeroCnj, disponibilizadaEm, texto, partes }`. `FONTES_PUBLICACAO` no ambiente escolhe quais rodam (padrão `exemplo`). A fonte de exemplo devolve publicações fixas dos casos de exemplo (uma exigência, uma de mérito, um andamento, uma sem CNJ, uma com CNJ desconhecido e a mesma exigência vinda de outra fonte), com a data do dia. AASP e DJEN entram como outras implementações da mesma interface, lendo `AASP_*` e `DJEN_*` do ambiente (CA10); nada no código nem no banco.
3. **Rodadas** (`apps/api/src/vigilia/rodadas.ts`): horários em `configuracao.vigilia.horarios` (padrão `["08:00", "13:00", "18:00"]`, horário de Brasília). `planejarDia` cria as rodadas `prevista` do dia por fonte (idempotente pela chave `fonte + prevista_para`). `rodar(rodada)` marca `rodando`, busca de 24 horas antes do horário previsto até ele (janela que se sobrepõe à anterior; a repetida é descartada pelo hash, CA6), grava início, fim, capturadas e `ok`, ou `falhou` com o erro (erro, tempo esgotado de 60 s ou credencial inválida, CA8). `marcarNaoRodou` marca `nao_rodou` a prevista que passou 30 minutos do horário sem rodar (CA9). Um relógio no processo da API (`setInterval` de 1 minuto, só em `principal.ts`, nunca nos testes) chama os três. Alternativa descartada por enquanto: pg-boss (dependência nova; entra quando houver fila de trabalho de verdade).
4. **Alarme** (CA1, CA3, CA11): rodada `falhou` ou `nao_rodou` não reprocessada vira linha calculada na fila da Sênior, no topo: título "Reprocessar vigília", contexto "Vigília das publicações · rodada das HH:MM (fonte): erro", tela `/vigilia`. Para isso, `TarefaDaCentral` ganha `contexto` (texto ou nulo) e `cliente` passa a aceitar nulo; a lista mostra o contexto no lugar do nome. Falha de credencial ou da API (erro com `credencial` ou `api`) grava também `alarme_suporte` no histórico e no registro do servidor (CA8, canal a definir).
5. **Reprocessar** (CA6, `POST /api/vigilia/rodadas/:id/reprocessar`, Sênior): roda de novo a mesma janela, grava `reprocessada_por` e `reprocessada_em`; a linha do alarme some quando todas as falhas do dia foram reprocessadas com sucesso (CA5).
6. **Casar** (`apps/api/src/vigilia/casar.ts`): hash = SHA-256 de `data | CNJ normalizado (ou "sem-cnj") | texto normalizado` (minúsculas, espaços simples), sem a fonte: a mesma publicação de AASP e DJEN é repetida (CA4). Repetida: grava em `publicacao_descarte` (fonte, CNJ, data, trecho do texto, motivo "repetida", publicação original, quando) (CA2, CA6). CNJ válido e de um caso (`identificador_caso` tipo `cnj`): liga ao caso e abre "Ler publicação" para a advogada (CA1, GGVP-74 CA6). Sem CNJ, ou CNJ desconhecido: `fila = 'revisao'` com o motivo (CA3, CA5).
7. **Fila de revisão** (`GET /api/publicacoes/fila`, `POST /api/publicacoes/:id/vinculo`, Sênior): cada item com data, fonte, texto, partes, motivo, idade em dias e o prazo mínimo que pode estar correndo (5 dias úteis a partir da publicação, CA12); item com mais de um dia mostra o alerta (CA10); item com esse prazo a 2 dias úteis ou menos sobe ao topo da fila da Sênior. Vincular exige CNJ válido de um caso existente (CA8) e segue como o item 6; "não é do escritório" encerra o item. Quem, quando e o processo ficam na publicação e no histórico (CA11).
8. **Prazo judicial em código** (`apps/api/src/fluxo/prazo-judicial.ts`, `REGRA_PRAZO_JUDICIAL` com versão 1): publicação = 1º dia útil depois da disponibilização; início = dia útil seguinte; fim = início + (dias − 1) dias úteis (CPC, art. 219; JEF, Lei 9.099, art. 12-A); sem prazo na decisão, 5 dias (CPC, art. 218, §3º). Dias úteis pulam sábado, domingo, feriados nacionais e os do tribunal do processo (o `J.TR` do número CNJ, cadastrado em `feriado.tribunal`; suspensões também) (CA9). Na dúvida (sem cadastro de feriado), a conta é a mesma e a tela avisa. Testes com véspera de feriado, fim de semana e suspensão (CA7). Cada `prazo` grava `regra` e `regra_versao` (CA6).
9. **Ler e classificar** (`GET /api/publicacoes/:id`, `POST /api/publicacoes/:id/classificacao`, advogada ou Sênior): classe (`andamento`, `exigencia`, `merito`); para exigência e mérito, os dias do prazo (o que a publicação diz) ou "sem prazo na decisão" (5). Grava classe, quem e quando; conta e grava o `prazo`; conclui "Ler publicação" e encaminha (item 10). Reclassificar grava `publicacao_reclassificacao` (de, para, quem, quando) (GGVP-34 CA10, GGVP-37 CA7).
10. **Encaminhar** (`apps/api/src/vigilia/encaminhar.ts`): `andamento` não cria tarefa (CA3); `exigencia` abre "Analisar exigência do juiz" (advogada, passo `D3a.02`, prazo = fim do prazo) e o caso na etapa `D3a` (CA1, CA4); `merito` abre "Confirmar desfecho" (advogada, passo `D4.02`, prazo do recurso) (CA2, CA5). Reclassificar cancela a tarefa que o encaminhamento anterior abriu, se ainda aberta, e encaminha de novo (CA7).
11. **Histórico do processo** (`GET /api/casos/:id/publicacoes`, `caso.ver`): publicações do caso com classe, prazo e quem leu (GGVP-74 CA5), e o filtro "só andamento" com o link para reclassificar (GGVP-74 CA7).
12. **Painel da vigília** (`GET /api/vigilia`, `vigilia.ver`): rodadas do dia por fonte e situação, contagem "Rodadas hoje n de 3 · Falhas n", situação do dia (`ok`, `incompleta` se há falha não reprocessada, `sem_publicacao` se as três rodadas foram OK sem nenhuma publicação em dia útil), a fila de revisão e os descartes do dia (CA2, CA4, CA5, CA12).
13. **Migração 0009**: `publicacao` ganha `fila` (`revisao` ou nulo), `motivo_fila`, `partes`, `vinculada_por`, `vinculada_em`, `fora_do_escritorio`; `prazo` ganha `regra_versao`; `rodada_vigilia` ganha `reprocessada_em`; tabelas novas `publicacao_descarte` e `publicacao_reclassificacao`.

### Contratos (`packages/contratos`, arquivo novo `justica.ts`)

`PainelDaVigilia`, `ItemDaFila`, `VincularPublicacao` (CNJ por `validarCnj`, ou "não é do escritório"), `PublicacaoParaLer`, `ClassificarPublicacao` (classe; dias inteiro de 1 a 120 ou "sem prazo na decisão"), `PublicacoesDoCaso`; `TarefaDaCentral` com `contexto`.

### Campos de formulário

| Campo | Como |
|---|---|
| Número CNJ (vincular) | `normalizarCnj`, `validarCnj` e `formatarCnj` de `@ggv/campos` |
| Dias do prazo | `somenteDigitos` na digitação; o contrato confere 1 a 120 |

### Telas

Painel da vigília (`/vigilia`, Sênior e advogada; reprocessar e a fila de revisão só para a Sênior), Ler publicação (`/publicacoes/:id`) e Publicações do processo (`/casos/:id/publicacoes`).

### Dados de exemplo

Dois casos judiciais com número CNJ (TRF3, JEF) e a configuração dos horários; a fonte de exemplo traz as publicações do dia; uma rodada de exemplo falhou de manhã (para o alarme aparecer).

### Risks / Trade-offs

- O relógio dentro do processo da API não roda se a API estiver parada; o "não rodou" (CA9) aparece quando ela volta. Em homologação, a API fica sempre de pé no Coolify.
- Sem IA, toda publicação casada passa pela fila da advogada, inclusive os andamentos: mais trabalho até o épico IA, mas nenhum prazo escapa (GGVP-37 CA6).
- Prazo em dobro do INSS e prazos de recurso por rito ficam com a pessoa (ela informa os dias); a regra fica versionada para quando o Lucas detalhar.
- Feriados e suspensões dos tribunais começam vazios; a tela avisa até alguém cadastrar.

## Grupo 2 · GGVP-79, GGVP-83 e GGVP-87

### Context

O grupo 1 deixa, para a exigência do juiz, a tarefa "Analisar exigência do juiz" (advogada, passo `D3a.02`) com o prazo processual em `prazo` (ligado pela `tarefa.prazo_processual_id` e pela publicação), e a etapa `D3a.02` aberta. A exigência do INSS (GGVP-39) já tem o mesmo desenho que este grupo precisa: `exigencia` (com `origem = 'juizo'` aceito pelo banco e `publicacao_id`), `exigencia_item` (setor, prazo, prova, situação), cobrança em `tentativa` com o limite da configuração (G15), escalada à Sênior, abertura de perícia e alerta perto do vencimento. O banco tem `peticao` (tipo `manifestacao` e `dilacao`), `peticao_versao` (número, hash, quem aprovou e quando) e `protocolo_judicial` (versão, tribunal, data, comprovante, quem).

### Goals / Non-Goals

**Goals:** a advogada distribui a exigência do juiz em itens por setor, com o prazo interno até o processual (G5, G21); cada setor cumpre com tentativas limitadas e prova (G15, G21), e sobe para a Sênior quando não consegue; com tudo provado, a advogada anexa a versão, aprova (G6) e protocola, e o processo volta para a vigília; perto do vencimento, a Sênior é avisada; vencido, decide.

**Non-Goals:** IA (sugestão de itens e minuta); a decisão da Sênior sobre o laço que passou do limite (GGVP-94); marcar e remarcar a perícia (épico Perícia); peticionar no sistema do tribunal (o protocolo é feito lá e registrado aqui).

### Decisions

14. **Reaproveitar a exigência** com `origem = 'juizo'`: `exigencia` (texto = a publicação, `publicacao_id`, prazo = o fim do prazo processual), `exigencia_item` (um por setor e pedido) e a mesma cobrança limitada da configuração (`cobranca.limite`, `cobranca.intervalo_dias`). Nada de tabela nova para a exigência.
15. **Setores**: Atendimento (`atendimento`), Jurídico (`juridico_adm`, resposta do revisor de 06/10: o Jurídico entra), Documentação (`documentacao`) e Perícia (tipos médica ou social, abre a tarefa de perícia do Jurídico administrativo com a origem D3a).
16. **Analisar** (`GET` e `POST /api/casos/:id/exigencia-juiz`, `exigencia_juiz.analisar`, que já existe na matriz para advogada e Sênior; a confirmação da distribuição fica só com a advogada, ação nova `exigencia_juiz.distribuir`): `ciencia` grava a decisão (quem e quando), conclui a tarefa e a etapa `D3a.02` e volta para a vigília, sem tarefa (CA2, CA6). `cumprir` exige ao menos um item ou perícia; cada item tem setor, o que cumprir, prova esperada (opcional) e prazo interno (calendário), que não passa do fim do prazo processual (CA7). Para cada item, uma tarefa "Cumprir exigência do juiz" (passo `D3a.03`, perfil do setor, prazo = próximo lembrete ou o prazo interno, limite do G15); a etapa `D3a.E2` (esperando o cliente) abre.
17. **Laço do setor** (tela `/casos/:id/exigencia-juiz/setor`, `exigencia_juiz.cumprir`, nova, para atendimento, documentacao e juridico_adm): o setor vê só os itens do seu perfil, com o pedido, quem pediu, o prazo interno, o processual e as tentativas (CA4). "Ainda não" registra a tentativa (data, canal, resultado), conta no limite e marca o próximo lembrete; no limite, sobe para a Sênior ("Exigência do juiz sem retorno", passo `D3a.03`) e a tarefa continua com o setor (CA5, CA8). "Não vou conseguir" exige o motivo e sobe antes do limite (CA14). "Consegui" exige a evidência (PDF ou imagem), que vira a prova do item; a tarefa conclui e o lembrete some (CA6, CA11).
18. **Manifestar** (`GET /api/casos/:id/manifestacao`, `POST .../versoes` multipart, `POST .../versoes/:n/aprovacao`, `POST .../protocolo` multipart; `exigencia_juiz.manifestar`, nova, advogada): quando o último item ganha prova (e a perícia pedida tem resultado), nasce "Manifestar no processo" (passo `D3a.04`) (CA1). A advogada anexa versões (arquivo; cada uma numerada, com o hash e o documento) a qualquer momento (CA6); aprovar marca `aprovada_por` e `aprovada_em` (G6). Protocolar exige a data (calendário, sem data futura), o comprovante, a última versão aprovada e nenhum item sem prova (G21); versão nova depois da aprovação bloqueia até nova aprovação, e a tentativa fica no histórico (CA3, CA9). Grava `protocolo_judicial` (tribunal pelo CNJ), conclui a exigência, as tarefas e as etapas, e o processo volta para a vigília (CA2, CA10).
19. **Dilação** (CA12): a Sênior autoriza (`POST /api/casos/:id/manifestacao/dilacao`, `exigencia_juiz.autorizar_dilacao`, nova); a advogada protocola a peça de dilação (`peticao.tipo = 'dilacao'`) com os itens pendentes listados e o motivo, sem o bloqueio do G21.
20. **Tribunal fora do ar** (CA13): a advogada registra a indisponibilidade com a prova e a data da volta; o fim do prazo passa a ser o primeiro dia útil depois da volta (Lei 11.419, art. 10, §2º), em código (`prazoDepoisDaIndisponibilidade` em `prazo-judicial.ts`), num `prazo` novo com a regra.
21. **Alerta da Sênior** (GGVP-87 CA4): `alertasDeExigencia` passa a olhar as duas origens; o título diz "do juiz" ou "do INSS". Vencida com item sem prova: a mesma decisão da exigência do INSS ("pedi dilação" ou "registrar a perda").
22. **Matriz versão 6**: `exigencia_juiz.distribuir` (advogada), `exigencia_juiz.cumprir` (atendimento, atendimento_lider, documentacao, juridico_adm), `exigencia_juiz.manifestar` (advogada), `exigencia_juiz.autorizar_dilacao` (senior).
23. **Migração 0010**: `exigencia_item.tarefa_id` (a tarefa do setor), `exigencia_item.prova_esperada`, `peticao_versao.documento_id`.

24. **Ajuste da homologação local (Mateus, 06/10)**: no card do setor, a ação principal é "Enviar documento e concluir" (o campo se chama "Documento", não "evidência"); "Registrar cobrança ao cliente" e "Avisar a Sênior" ficam recolhidos abaixo. Na análise da advogada, "Prova esperada" virou "Documento que comprova", e a perícia aparece entre os setores acionados, com quem marca (Jurídico administrativo), porque a tarefa dela vai para outra Central e parecia não ter subido.

25. **Manifestar sem uma prova (ajuste do Mateus, 06/10)**: quando o documento não existe ou a perícia não tem como ser feita, a advogada encerra o item, ou a perícia, na tela da manifestação (`POST /api/casos/:id/manifestacao/sem-prova`, `exigencia_juiz.manifestar`), com o motivo obrigatório. Não é um atalho do portão: o motivo é a prova em texto que a GGVP-68 (CA2) já admite ("documento anexado ou texto"), e o G21 continua bloqueando enquanto algum item não tiver prova, por documento ou por justificativa. Item: `exigencia_item.situacao = 'nao_cumprido'`, `motivo`, `cumprido_por` e `cumprido_em` (quem encerrou), e a tarefa do setor é cancelada. Perícia: uma `decisao` (`D3a.04`, `pericia_sem_resultado`, a perícia em `resultado`, o motivo em `justificativa`), sem tocar na tabela da perícia, que é do épico Perícia; sem nenhuma perícia pendente, a tarefa de marcar é cancelada. O protocolo leva a lista dos encerrados sem a prova para o histórico. "Manifestar no processo" passa a nascer na distribuição, com o prazo do processo, para a advogada ter onde acompanhar e desbloquear. Leitura do G21 a confirmar com o Lucas.

### Contratos (`packages/contratos/src/justica.ts`)

`ExigenciaDoJuiz` (texto, prazo processual com a regra, itens com setor e status, perícias, quem falta, `podeDistribuir`), `AnalisarExigenciaJuiz` (`ciencia`, ou `cumprir` com itens e tipos de perícia), `ItensDoSetor`, `RegistrarTentativa`, `NaoVouConseguir`, `Manifestacao` (versões, aprovada, bloqueios, `podeProtocolar`), `ProtocolarManifestacao` (data), `RegistrarIndisponibilidade` (data da volta).

### Campos de formulário

| Campo | Como |
|---|---|
| Prazo interno, data do protocolo, data da volta do sistema | calendário do navegador, com `isoParaData` e `hojeIso` de `@ggv/campos` |
| O que cumprir, prova esperada, motivo | texto, aparado; o contrato exige quando é obrigatório |

### Telas

Analisar a exigência do juiz (`/casos/:id/exigencia-juiz`, advogada; a Sênior e o Jurídico veem o status de cada setor), Cumprir a exigência do juiz (`/casos/:id/exigencia-juiz/setor`, um setor por vez) e Manifestar (`/casos/:id/manifestacao`).

### Risks / Trade-offs

- A mesma tabela serve às duas exigências; uma mudança na do INSS pode afetar a do juiz. Os testes das duas rodam juntos.
- Sem IA, a advogada monta todos os itens à mão. É mais lento, mas nada nasce sem ela (G5).
- O protocolo no tribunal é feito fora do portal; aqui fica o registro (data, comprovante, versão). Se alguém registrar sem protocolar de fato, o portal não percebe: a Sênior confere pela publicação seguinte.

## Grupo 3 · GGVP-52, GGVP-54, GGVP-58, GGVP-63, GGVP-67 e GGVP-71

### Context

O indeferido (GGVP-48, `rotas/vigilia.ts`) já põe o caso na fase `judicial`, abre a etapa e a tarefa `D3.01` "Registrar indeferimento" (advogada) com a carta como evidência, e guarda o motivo do INSS em `resultado_inss`; a Sênior já pode encerrar o caso com motivo (`POST /api/casos/:id/encerrar`, `caso.encerrar`). A exigência do juiz (grupo 2) já tem o laço do setor inteiro: itens, tarefas com o limite da configuração (G15), tentativas, "não vou conseguir", prova, subida à Sênior e a perícia com a tarefa do Jurídico administrativo (`abrirPericiasDaExigencia`). O banco já tem `peticao` (tipo `inicial`), `peticao_versao` (número, conteúdo, hash, quem gerou, pedido de mudança, aprovação) e `protocolo_judicial`; a matriz já tem `caso.despachar_indeferimento` (Sênior), `peticao.pedir`, `peticao.aprovar` (advogada) e `peticao.ver` (Jurídico). Não existe rota para baixar documento, nem gerador de PDF, e nenhuma pessoa de exemplo tem CPF. O Drive fica fora até 09/10 (ADR-001, GGVP-107).

### Goals / Non-Goals

**Goals:** do indeferido ao protocolo da petição inicial, com uma pessoa em cada decisão: o motivo escrito pela advogada, o despacho da Sênior (G4), os laços dos setores com limite e prova (G15), o pedido e a versão 1 escrita pela advogada, a conferência com a diferença entre versões e a aprovação (G6, G18), o pacote em PDF com as três travas (G7) e o protocolo que põe o processo na vigília.

**Non-Goals:** IA em qualquer passo (GGVP-14); jurimetria (GGVP-15, GGVP-64); parecer médico no pedido (GGVP-63 CA5, v2); a decisão da Sênior no laço que passou do limite (GGVP-94); remarcar a perícia (épico Perícia); atribuição pelo líder; tela da linha do processo (GGVP-99; aqui, o histórico grava); enviar o pacote ao tribunal.

### Decisions

26. **Matriz versão 7**, ações novas: `pendencia.cumprir` (atendimento, atendimento_lider, documentacao) e `peticao.protocolar` (advogada). O resto reaproveita o que já existe: o motivo do indeferimento usa `inss.registrar_resposta` (advogada, Sênior e Jurídico administrativo, "a advogada responsável ou a equipe do Jurídico" do cartão); despachar, `caso.despachar_indeferimento`; não judicializar, `caso.encerrar`; pedir, `peticao.pedir`; conferir e aprovar, `peticao.aprovar`; ver, `peticao.ver`.
27. **Migração 0011**: `exigencia.origem` aceita `despacho`; `exigencia_item.informacao` (a informação que o Atendimento registra como prova); `resultado_inss.motivo_escrito`, `motivo_escrito_por` e `motivo_escrito_em` (o banco de motivos); `peticao.instrucoes`, `peticao.opcoes` (jsonb) e `peticao.citados` (jsonb: os documentos citados, na ordem, com o nome do que ainda falta); `peticao_versao.pacote` (jsonb: os arquivos na ordem, com o documento, o nome e o hash) e `pacote_gerado_em`.
28. **Banco de motivos** (GGVP-52 CA2, CA5) são os motivos escritos em `resultado_inss`, com o caso: gravar de novo atualiza a mesma linha, numa transação, e nunca duplica. Alternativa descartada: tabela nova só para o texto. O acervo da IA lê dali quando o épico IA entrar.
29. **Registrar o motivo** (`rotas/indeferimento.ts`; `GET /api/casos/:id/indeferimento`, `caso.ver`; `POST /api/casos/:id/indeferimento/motivo`, `inss.registrar_resposta`, multipart): o `GET` traz o cliente, o benefício, a data da decisão, o motivo do INSS, a carta e o motivo escrito com quem e quando. O `POST` exige o motivo e a carta (a do registro do indeferido vale; o arquivo só é pedido se faltar, CA4), só com a `D3.01` aberta; grava o motivo, conclui a tarefa e a etapa `D3.01`, abre "Despachar caso" (`D3.03`, Sênior) e grava `indeferimento_motivo_registrado` no histórico (linha do processo, CA6, CA7).
30. **Baixar documento** (`rotas/documentos.ts`, `GET /api/casos/:id/documentos/:doc`, `caso.ver`): serve o arquivo do armazenamento privado com o nome original. Documento sensível (dado de saúde) só com `dado_saude.ver_detalhe`, e cada leitura grava `acesso_dado_sensivel`; nada do conteúdo vai para log. Serve a carta (GGVP-52 CA3) e os arquivos do pacote (GGVP-71 CA11).
31. **Despachar** (`rotas/indeferimento.ts`; `GET /api/casos/:id/despacho`, `caso.ver`; `POST`, `caso.despachar_indeferimento`, só a Sênior; a recusa fica no histórico pelo `exigir`, CA8): o `GET` traz o histórico do caso (benefício, decisão do INSS com a data, carta, motivo do INSS, motivo escrito com quem e quando), o despacho feito e o status de cada setor. Entrada: `nada_falta`, ou `acionar` com itens (setor Atendimento ou Documentação, o que obter, "Essa tarefa tem prazo?" e a data com "Sim") e tipos de perícia. Grava a `decisao` (`D3.03`, `despacho`, o resultado e os setores, quem, o perfil; `sugestao_ia` vazia até o épico IA, G4, CA4, CA9). `acionar` reaproveita a exigência com `origem = 'despacho'`, sem prazo de fora, com um item e uma tarefa "Cumprir pendência" (`D3.04`, perfil do setor, prazo = próximo lembrete ou a data de entrega, limite do G15) por pedido; a perícia abre a tarefa de marcar do Jurídico administrativo (`ORIGEM_DESPACHO`, diagrama `D3`); abre a espera `D3.E1` (cliente). Nos dois casos nasce "Pedir a petição" (`D3.05`, advogada), que mostra quem falta até todos os setores fecharem, como "Manifestar no processo" (decisão 25).
32. **Laço do setor nas duas origens** (GGVP-58): as quatro rotas do setor de `rotas/exigencia-juiz.ts` passam a ser registradas também em `/api/casos/:id/pendencias/...`, com `pendencia.cumprir` e a exigência `despacho` do caso. Muda só o que a história pede: título "Cumprir pendência"; prazo processual nulo, que a tela esconde (CA5); o Atendimento sobe com a informação escrita ou um documento, a Documentação com o documento (CA1, CA2, CA7); no limite ou com "não vou conseguir", sobe para a Sênior ("Pendência sem retorno", `D3.04s`) e continua com o setor (CA4, CA9); com o último item provado e a perícia resolvida, fecha a espera `D3.E1` (CA8). Alternativa descartada: copiar as rotas para outro arquivo (o mesmo laço em dois lugares).
33. **Pedir a petição** (`rotas/peticao.ts`; `GET /api/casos/:id/peticao`, `peticao.ver`; `POST .../peticao/pedido`, `peticao.pedir`): o `GET` traz quem falta (itens e perícia do despacho), o pedido, as versões, a atual inteira com a diferença para a anterior, o pacote, as travas e os tribunais. O pedido só passa sem setor pendente (CA1); grava a `peticao` (`inicial`, quem pediu, instruções, opções e os documentos citados na ordem, com o nome do que falta) e a versão 1 escrita pela advogada (`gerada_por = 'advogada'`, hash SHA-256 do texto); conclui `D3.05` e abre "Conferir petição" (`D3.06`) (CA9, CA10). A carta de indeferimento entra sempre no pacote (Tema 350).
34. **Conferir** (`POST .../peticao/versoes`, "Editar eu mesma"; `POST .../peticao/versoes/:n/aprovacao`; os dois com `peticao.aprovar`): editar grava a versão seguinte, numerada, com o que mudou; as anteriores ficam (GGVP-67 CA1, CA5, CA10). A diferença é por parágrafo, em código com teste (`fluxo/diferenca.ts`, LCS de linhas; sem dependência, são poucas linhas) (CA3, CA4). Aprovar exige as três marcações ("Li a petição na íntegra", "Fundamentos, pedidos e valores conferem com o caso", "Nada contradiz o requisito do benefício (G18)"), grava quem e quando (o hash já é o identificador, G6, CA2, CA6), gera o pacote (decisão 35), conclui `D3.06` e abre "Protocolar na Justiça" (`D3.07`). Versão nova depois da aprovação (CA7): a aprovada não muda; o pacote dela deixa de valer, `D3.07` é cancelada, `D3.06` volta e a tentativa fica no histórico. "Pedir outra versão à IA" e os pontos de atenção não aparecem até o épico IA.
35. **Pacote** (`fluxo/pacote.ts`; GGVP-67 CA6, GGVP-71 CA1, CA8, CA11): na ordem, a petição em PDF (o texto aprovado, a assinatura padrão de `configuracao.peticao.assinatura` e, no rodapé e nos metadados, o hash da versão), a carta de indeferimento e os documentos citados na ordem do pedido; imagem vira PDF de uma página. Cada arquivo é guardado como `documento` (`pacote_peticao`) no armazenamento privado, com o hash, e a lista vai para `peticao_versao.pacote`. **Dependência nova: `pdf-lib`** (MIT, sem código nativo), porque o tribunal só aceita PDF e o portal precisa gerar o PDF da petição e converter as imagens; escrever PDF à mão, com fonte, acentos e quebra de linha, é mais código e mais risco.
36. **Travas** (`fluxo/travas.ts`, funções puras com teste; GGVP-71 CA2, CA6, CA7): Tema 350, a carta de indeferimento está no pacote; CPF conferido, todo CPF escrito na petição (`normalizarCpf`, `validarCpf`) é igual ao do cadastro, e a petição tem ao menos um; pacote completo, nenhum citado falta, cada arquivo foi lido do armazenamento e cabe no formato e no tamanho do tribunal escolhido. Cada trava devolve o status e a evidência (o CPF dos dois lados, a carta, o que falta).
37. **Documento que falta** (GGVP-71 CA13): a advogada sobe o arquivo (`POST .../peticao/citados/:i/documento`, `peticao.pedir`) ou pede à Documentação (`POST .../peticao/citados/:i/pedido`: um item "Cumprir pendência" na exigência `despacho` do caso, criada se não houver); com o documento, o citado é ligado e o pacote é gerado de novo.
38. **Protocolo** (`POST .../peticao/protocolo`, `peticao.protocolar`, multipart; GGVP-71 CA3 a CA5, CA9, CA10): tribunal da configuração, CNJ (`validarCnj`), data (sem data futura), comprovante e a confirmação de cada trava pela evidência. Recusa dizendo a trava que falha; confere o hash de cada arquivo do pacote no armazenamento e, divergindo, recusa e grava `pacote_divergente` no histórico. Grava `protocolo_judicial` (versão aprovada, tribunal, número, data, comprovante, quem), o CNJ do caso em `identificador_caso` (para a vigília casar as publicações) e as travas confirmadas (`decisao` `D3.07`, `trava_g7`, com a evidência); conclui `D3.07` e a etapa; o processo entra na vigília (D3a). O botão do tribunal abre o site da configuração numa página nova; o portal não envia nada (CA11).
39. **Tribunais na configuração** (resposta do revisor de 06/10, Q8): `configuracao.tribunais`, uma lista com nome, site de peticionamento e tamanho máximo por arquivo (parâmetros, Q8); o tipo é sempre PDF, porque o pacote converte as imagens. A semente traz a Justiça Federal da 3ª Região, com valores de exemplo; a Estadual entra só na configuração. O documento que falta também pode ser um documento do caso já existente (o que a Documentação entregou), e há "Gerar o pacote" para quando o armazenamento falhou na aprovação.
40. **Central**: `TELA_DO_PASSO` ganha `D3.01` (`/casos/:id/indeferimento`), `D3.03` e `D3.04s` (`/casos/:id/despacho`), `D3.04` (`/casos/:id/pendencias`), `D3.05`, `D3.06` e `D3.07` (`/casos/:id/peticao`). Os títulos são os das histórias, com o nome do cliente na Central.

### Contratos (`packages/contratos/src/justica.ts`)

`Indeferimento` e `RegistrarMotivo` (motivo); `Despacho` e `Despachar` (`nada_falta`, ou `acionar` com itens: setor, o que obter, `temPrazo` e a data quando `temPrazo`; e tipos de perícia); `ItensDoSetor` com `origem`, `prazoProcessual` nulo e `informacao`; `SubirInformacao` (texto); `PeticaoInicial` (quem falta, pedido, versões, atual com a diferença, pacote, travas, tribunais, `podePedir`, `podeAprovar`, `podeProtocolar`); `PedirPeticao` (instruções, opções, citados e o texto da versão 1); `NovaVersao` (texto e o que mudou); `AprovarPeticao` (as três marcações); `ProtocolarPeticao` (tribunal, CNJ, data, travas confirmadas).

### Campos de formulário

| Campo | Como |
|---|---|
| Motivo com as suas palavras, o que obter, instruções, texto da petição, o que mudou, informação do Atendimento | texto, aparado; o contrato exige quando é obrigatório |
| Data de entrega ("Essa tarefa tem prazo?" Sim) e data do protocolo | calendário do navegador, com `isoParaData` e `hojeIso` de `@ggv/campos` |
| Número do processo | `normalizarCnj`, `validarCnj` e `formatarCnj` de `@ggv/campos` |
| CPF da trava (servidor) | `normalizarCpf`, `validarCpf` e `formatarCpf` de `@ggv/campos` |
| Carta, documento que falta, comprovante | arquivo PDF ou imagem, até 25 MB (`TIPOS_DE_ANEXO`) |

### Telas

O motivo com as suas palavras fica na tela da vigília do INSS, no registro do indeferido (decisão 41); Despachar caso (`/casos/:id/despacho`; a Sênior despacha ou encerra; a advogada vê só a leitura), Cumprir pendência (a tela do setor da exigência do juiz, com a origem, em `/casos/:id/pendencias`) e Petição inicial (`/casos/:id/peticao`: pedir, conferir, pacote e protocolo, conforme a situação, como a tela Manifestar).

### Dados de exemplo

Um quarto cliente de exemplo esperando o INSS, Vicente Prado, fica para o caminho deste grupo (os outros três já servem aos testes da via administrativa, que rodam ao mesmo tempo). Os clientes que esperam o INSS ganham CPF de exemplo válido; a configuração ganha `tribunais` (Justiça Federal, exemplo) e `peticao.assinatura` (exemplo). O caminho começa com a advogada registrando o indeferido com a carta ("Trazer a resposta do INSS"), porque a semente não grava arquivos no armazenamento.

### Risks / Trade-offs

- [O laço serve duas origens] mudar o laço afeta a exigência do juiz → os testes das duas rodam juntos.
- [PDF de texto corrido] a petição sai sem a formatação do Word, e caractere fora do conjunto da fonte padrão vira "?" → a advogada abre o PDF do pacote antes de protocolar; com o épico IA, a minuta já nasce no portal.
- [Valores do tribunal] site, tipos e tamanho são de exemplo → o escritório confirma na configuração, sem código.
- [Sem IA] a advogada escreve a versão 1 e marca os citados → mais trabalho até o épico IA, mas nada é inventado (G6).
- [Grupo grande] seis histórias e três telas novas → dois pontos de "Agora ok?", depois da GGVP-58 e depois da GGVP-71.

### Migration Plan

Migração 0011 junto com as 0009 e 0010: `db:migrar` no Supabase depois do merge. Sem volta automática: as colunas novas são nulas e a origem nova só amplia a lista.

### Open Questions

- O site de peticionamento e o tamanho máximo por arquivo do tribunal: valores da configuração, que o escritório confirma; não mudam o código.

### Ajustes da homologação local (Mateus, 06/10)

41. **O motivo vai no registro do indeferido.** Quem registra o indeferido em "Trazer a resposta do INSS" já escreve o motivo com as suas palavras (`RespostaDoInss.motivoEscrito`, obrigatório no indeferido), que vai para o banco de motivos com quem e quando; a etapa `D3.01` fica concluída na hora, e a Sênior recebe "Despachar caso" (`D3.03`) com a carta. Saem a tarefa "Registrar indeferimento", a tela e as rotas `GET /api/casos/:id/indeferimento` e `POST .../indeferimento/motivo` (decisão 29) e o `D3.01` da Central (decisão 40): a advogada fazia a mesma coisa duas vezes. Isso muda a GGVP-48 (CA1 e CA3: a primeira tarefa deixa de ser "Registrar indeferimento"); fica registrado nos cartões, e o Lucas confirma na homologação.
42. **Um pedido por setor no despacho.** No despacho, cada setor se marca uma vez (caixa por setor, com o que obter e "Essa tarefa tem prazo?"), e o contrato recusa o mesmo setor duas vezes. Antes, a lista de pedidos com a escolha do setor deixava pedir duas vezes ao mesmo setor sem perceber, e um despacho para a Documentação e o Atendimento saiu com os dois pedidos para o Atendimento.
43. **A resposta do INSS e o passo seguinte numa tela só, se quem registrou quiser** (pedido do Mateus, 06/10; histórias GGVP-35, GGVP-39 e GGVP-44, do épico Via administrativa, feitas aqui porque a tela da vigília já mudou na decisão 41). Registrada a exigência, a tela da vigília mostra "Tratar exigência do INSS" ali mesmo; registrado o deferido (igual ou diferente do pedido), mostra "Prestar contas". As duas telas ganharam a forma embutida (`Moldura`: um cartão com o título, sem a volta ao início). A tarefa nasce como antes e fica na Central para depois; feito ali, ela conclui como sempre, pela mesma rota. Só aparece para quem faz o passo (`exigencia_inss.tratar`, `prestacao.dar_ok`); o servidor não mudou. O indeferido já segue numa tela só (decisão 41).

## Grupo 4 · GGVP-26 e GGVP-30 com as fontes reais (07/10)

### Context

A vigília roda com `fonteDeExemplo`. `fontesAtivas` lê `FONTES_PUBLICACAO` e, para `aasp` e `djen`, devolve uma fonte "não ligada": a rodada falha com "credencial ausente" e o alarme avisa (G13). A rodada pede a janela das 24 horas antes do horário previsto, com o tempo-limite de 60 s, e o casamento descarta a repetida pelo hash de data, CNJ e texto normalizado, sem a fonte (GGVP-26 CA4).

A consulta de 07/10 ao DJEN com a OAB de uma advogada do escritório, de 01/09 a 07/10, voltou 1.911 comunicações: TRF3 157, TJSP 124 e perto de 1.430 da Justiça do Trabalho (TRT2 1.291, TST 103, TRT15 38). Outros achados da mesma consulta:
- 45 de 50 textos vêm em HTML;
- a OAB escrita com ponto (como 123.456) volta zero;
- a data vem como AAAA-MM-DD e o processo como 20 dígitos.

### Goals / Non-Goals

**Goals:** as fontes DJEN e AASP atrás da mesma interface `Fonte`, configuradas só pelo ambiente; o texto chega limpo; só entram os tribunais da vigília; a falha diz a fonte e o tipo (credencial ou API), sem expor a chave.

**Non-Goals:** o canal do suporte técnico (GGVP-30 CA8, a definir); o `diferencial` da AASP; tela nova, porque o painel da vigília já mostra fonte, contagem e erro.

### Decisions

44. **DJEN** (`apps/api/src/vigilia/djen.ts`): `GET https://comunicaapi.pje.jus.br/api/v1/comunicacao`, pública e sem chave.
    - **Consulta:** para cada OAB de `DJEN_OABS` (`numero/UF`, número só com dígitos, como `123456/SP`) e cada tribunal da vigília, envia `numeroOab`, `ufOab`, `siglaTribunal`, `dataDisponibilizacaoInicio` e `dataDisponibilizacaoFim`, com os dias da janela no horário de Brasília. Usa `itensPorPagina=50`, página a página até cobrir o `count`.
    - **Ritmo:** meio segundo entre as chamadas. Sem resposta em 25 s (rede fora ou tempo esgotado) ou HTTP 5xx tenta de novo uma vez, depois de 2 s; as duas tentativas cabem nos 60 s da rodada. A nova tentativa sem resposta é ajuste de 07/10: na rodada real, um soluço da rede tinha virado alarme.
    - **Filtros:** a mesma comunicação achada por duas OABs conta uma vez, pelo `id`. Comunicação cancelada (`ativo` falso ou `data_cancelamento` preenchida) fica de fora.
    - **Mapa:** `numero_processo` → `numeroCnj`; `data_disponibilizacao` → `disponibilizadaEm`; `texto` sem HTML → `texto`; os nomes de `destinatarios` → `partes`.
45. **AASP** (`apps/api/src/vigilia/aasp.ts`): `GET https://intimacaoapi.aasp.org.br/api/Associado/intimacao/json?chave=...&data=...`, para cada dia da janela e cada chave de `AASP_CHAVES`.
    - **Chave:** uma por associado, fornecida pela AASP; é segredo.
    - **A chave vai na URL:** por isso nenhuma mensagem de erro, log ou registro leva a URL. HTTP 401 e 403 viram erro com "credencial" (alarme ao suporte, CA8); o resto, erro com "api".
    - **Formato** (a documentação não traz esquema; sonda de 07/10 com a chave do `.env.aasp`, sobre 84 intimações de 06/10):
      - resposta `{ intimacoes: [...], erro, status }`; `erro` verdadeiro vira falha com "api";
      - cada intimação traz `jornal` (`nomeJornal`, `dataDisponibilizacao_Publicacao` em AAAA-MM-DDThh:mm:ss, `termoReferenciaData` sempre "Disponibilização" na amostra), `textoPublicacao` (texto simples, sem HTML), `titulo` (o órgão, não as partes), `cabecalho`, `rodape`, `numeroPublicacao`, `numeroArquivo`, `codigoRelacionamento` e `numeroUnicoProcesso` (CNJ com máscara);
      - a `data` vai em AAAA-MM-DD.
    - **Mapa:** `numeroUnicoProcesso` só com dígitos → `numeroCnj`; os 10 primeiros caracteres de `jornal.dataDisponibilizacao_Publicacao` → `disponibilizadaEm`; `textoPublicacao` → `texto`. `partes` fica nulo, porque a AASP não separa as partes.
    - **Na amostra:**
      - quase tudo é republicação do DJEN (`DJENTRT2`, `DJENTRF3`, `DJENTJSP`...);
      - das 84 intimações, 10 eram do TRF3 ou do TJSP;
      - 3 dessas 10 não vieram pela consulta do DJEN por OAB, então a AASP amplia a cobertura.
    - **Sem `diferencial`:** a rodada não usa o filtro "só as não consultadas"; pede a janela inteira, para o reprocessamento (GGVP-30 CA6) funcionar igual nas duas fontes.
46. **Texto limpo** (`textoDoHtml` em `fontes.ts`, usado pelas duas fontes): tira as tags, troca `<br>` e o fim de parágrafo por quebra de linha, decodifica as entidades (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;` e as numéricas) e junta os espaços. Sem dependência nova: poucas linhas cobrem o que o DJEN manda.
47. **Tribunais da vigília** (`VIGILIA_TRIBUNAIS`, siglas): TRF3 e TJSP, por decisão do Mateus em 07/10. O acidentário corre na Justiça Estadual, e a Justiça do Trabalho fica de fora. Valem estas regras:
    - o DJEN consulta só esses tribunais;
    - na AASP, publicação de processo de outro tribunal fica de fora antes do casamento, pelo `J.TR` do CNJ (TRF1 a TRF6 = 4.01 a 4.06; TJSP = 8.26);
    - sem CNJ, a publicação segue para a fila de revisão, como hoje (GGVP-26 CA3).
48. **Ambiente** (GGVP-30 CA10):
    - `FONTES_PUBLICACAO=aasp,djen` liga as duas; as outras variáveis são `DJEN_OABS`, `AASP_CHAVES` e `VIGILIA_TRIBUNAIS`.
    - Sem a variável da fonte, ela segue "não ligada" (falha com "credencial ausente" e alarme ao suporte).
    - Nada no código nem no banco: `.env` local e Coolify. Na máquina, a chave da AASP fica no `.env.aasp` (fora do git), separada do `.env.supabase`.
49. **Sem contrato novo e sem tela nova:** `Fonte` e `PublicacaoBruta` não mudam; o painel da vigília já mostra fonte, contagem e erro. Sem dependência nova: `fetch` do Node 22.
50. **Testes** com respostas gravadas sem dado real (texto e nomes inventados) e `fetch` trocado no teste. Cobrem:
    - paginação até o `count`;
    - comunicação cancelada fora;
    - mesma comunicação achada por duas OABs;
    - 5xx com nova tentativa;
    - tribunal fora da lista;
    - HTML virando texto;
    - 401 da AASP virando "credencial" sem a chave na mensagem;
    - a mesma publicação das duas fontes descartada como repetida (GGVP-26 CA4).

51. **Repetida entre as fontes** (GGVP-26 CA4; aprovada pelo Mateus em 07/10). O hash não basta.
    - **O que a sonda mostrou:** dos 7 processos de 06/10 que vieram pelas duas fontes, nenhum ficou com o texto igual depois de normalizado. Em 6, o texto da AASP contém o do DJEN inteiro; o sétimo só fica contido sem a pontuação. O texto do DJEN ocupa de 51% a 98% do da AASP.
    - **Regra:** antes de gravar, a publicação com CNJ procura outra de fonte diferente, com a mesma data e o mesmo CNJ. Os dois textos são normalizados (minúsculas, sem pontuação, espaços simples). Se um contém o outro, e o menor tem pelo menos metade do tamanho do maior, ela é repetida, e o descarte fica registrado com a original (CA2, CA6).
    - **Sem CNJ:** vale só o hash exato, como hoje.

### Risks / Trade-offs

- **Repetida falsa** (decisão 51): esconderia uma publicação. Três exigências deixam a regra estreita: mesma data, mesmo CNJ e outra fonte. Além disso, o texto menor precisa ter pelo menos metade do maior. Todo descarte continua na lista de descartes (GGVP-26 CA6) para conferir. O teste cobre dois atos diferentes do mesmo processo no mesmo dia, que não podem virar repetida.
- **DJEN sem limite publicado:** ele não publica limite de taxa (há relatos de HTTP 500 sob rajada) nem SLA. A nova tentativa e o alarme cobrem; uma falha repetida vira "vigília incompleta", nunca dia vazio (G13).
- **IP de fora do Brasil:** o DJEN recusa (há relatos de 403). O servidor do Coolify fica em São Paulo.
- **Volume:** perto de 6 publicações do TRF3 por dia útil para essa OAB, mais as da AASP. Com os casos do escritório cadastrados, só o CNJ desconhecido vai para a fila da Sênior.

### Open Questions

- **Tribunais da vigília:** respondida pelo Mateus em 07/10. São TRF3 e TJSP (decisão 47).
- **Fontes reais em homologação** (Lucas): a homologação recebe só dado inventado (`docs/infra/homologacao.md`), e as fontes reais trazem publicação real de cliente, às vezes com dado de saúde. Até a decisão, a homologação segue com a fonte de exemplo, e o teste real é na máquina, com o banco na memória e mostrando só contagens.
- **Canal do alarme ao suporte técnico** (GGVP-30 CA8): segue a definir.
