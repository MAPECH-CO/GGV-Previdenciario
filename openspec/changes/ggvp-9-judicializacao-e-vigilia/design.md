# Design · GGVP-9 Judicialização e vigília

## Grupo 1 · GGVP-26, GGVP-30, GGVP-34, GGVP-37 e GGVP-74

### Context

O modelo de dados da fundação já tem `publicacao` (fonte, CNJ, caso, data de disponibilização, texto, hash único, classe), `rodada_vigilia` (fonte, prevista para, início, fim, situação, capturadas, erro, quem reprocessou), `prazo` (caso, origem, publicação, início, fim, regra), `feriado` (data, tribunal; nulo é nacional), `identificador_caso` (tipo `cnj`), `configuracao` e `tarefa`. `@ggv/campos` tem `normalizarCnj` e `validarCnj`. A Central do perfil vem de `GET /api/tarefas`, que já monta linhas calculadas para a Sênior (alerta da exigência do INSS). O prazo do INSS já é código (`apps/api/src/fluxo/prazo-inss.ts`).

### Goals / Non-Goals

**Goals:** fontes de publicação atrás de uma interface, com uma fonte de exemplo até as credenciais; rodadas 3 vezes por dia com registro, alarme, "não rodou" e reprocessamento (G13); casamento pelo CNJ com descarte de repetidas registrado; fila de revisão da Sênior; leitura e classificação por pessoa; prazo judicial em código, versionado, pelo lado seguro (G12, G19); encaminhamento pelo tipo de ato.

**Non-Goals:** AASP e DJEN reais (entram com as credenciais, em 07/10); IA (GGVP-14); tela de analisar a exigência do juiz (GGVP-79) e de confirmar o desfecho (GGVP-90); canal do alarme ao suporte técnico; prazo em dobro do INSS (CPC, art. 183) e regras de recurso por rito, que a pessoa informa ao classificar.

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
