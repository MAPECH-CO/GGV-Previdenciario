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
