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

## GGVP-142 · Chat e Suporte pelo motor de IA de verdade

### Context

- **O chat de hoje** (GGVP-82) roda inteiro na tela, no servidor de exemplo. As intenções, as travas, os números e as ações saem de regras puras (`apps/web/src/regras/chat.ts`, `parecer.ts` e `pericia.ts`) e do banco de exemplo (`apps/web/src/dados/chat.ts`). Com o servidor ligado (homologação), ele não vê os casos do banco.
- **O contrato já existe:** `PerguntaDoChat`, `RespostaDoChat`, `CartaoDeAcao` e `ConfirmacaoDoCartao`, com a ponta para ligar descrita na change `ggvp-5-experiencia-e-chat`.
- **O motor** (`ia.ts`) registra cada chamada em `chamada_ia`, protege a entrada (GGVP-110) e barra CID por finalidade. O acervo tem a busca híbrida (`buscarNoAcervo`).
- **A página do processo** no servidor (`GET /api/casos/:id/processo`) já monta o caso na visão do perfil, com o acesso a dado de saúde registrado.
- **Rotas que as ações reaproveitam:**
  - o pedido da peça (`POST /api/casos/:id/peticao/pedido`, com o G17);
  - a perícia (`/pericia/comprovante/leitura` e `/pericia/marcacao`).
  
  A `main` não tem rota de envio de arquivo do caso (fica com a Recepção, PR #22) nem do lote do acervo (GGVP-55).

### Decisions

1. **Kit de agentes da OpenAI em TypeScript** (`@openai/agents` 0.18.0, a versão de setembro, com `zod` 4), decisão do Mateus em 09/10. O ADR-016 registra a escolha (o 014 está reservado para a fonte da jurimetria).
   - **Modelo:** pelo mesmo endpoint de chat completions do motor, com o cliente da OpenAI criado com o `fetch` injetado; o teste passa um falso (CA4).
   - **Rastreamento do kit desligado:** nada vai para o painel da OpenAI (LGPD).
   - **Ferramentas de ação com aprovação da pessoa:** o kit para na aprovação, e o servidor guarda o estado da conversa até o clique.
2. **`POST /api/chat`**, só com a sessão: o chat é de todos os perfis, sem permissão nova na matriz.
   - **Antes do modelo, como código, com as mesmas regras puras da tela:**
     - as recusas do G17 e do G11 (a do G11 vai ao histórico);
     - "o que é o G8?";
     - os portões do pedido;
     - o pedido de outro perfil.
   - **O contexto:**
     - o caso do contexto ou o do cliente citado pelo nome, lido pela rota da página do processo com a sessão de quem pergunta;
     - o acervo, com a regra de saúde;
     - a lista fixa de ações do perfil.
   - **Saúde:** para o Jurídico (`dado_saude.ver_detalhe`) e para o Sócio, uma exceção do chat (decisão do Mateus). Para o Sócio, o resumo médico do caso vem da documentação médica, com o acesso registrado em `acesso_dado_sensivel`.
   - **O registro:** cada conversa vira uma chamada em `chamada_ia`, com:
     - a finalidade `chat` (sem saúde, barra CID) ou `chat_juridico` (com saúde);
     - o modelo, a entrada, a saída e as fontes.
   - **Depois do modelo:**
     - a barra de CID para quem não vê saúde;
     - os links vêm do código (o caso e as telas das tarefas), nunca do texto do modelo.
3. **Ferramentas do agente:**
   - **de leitura, sem aprovação:** ver o caso, buscar no acervo, as tarefas da pessoa e explicar um portão;
   - **de ação, com aprovação, só as da lista do perfil:** criar tarefa e pedir a peça;
   - **as que dependem de enviar arquivo** (marcar a perícia com o comprovante, anexar laudo, enviar documento, lançar o comprovante de RPV e subir no acervo) respondem com o link da tela. Na perícia, a IA lê o comprovante e a pessoa confere antes de marcar (Mateus, 09/10).
4. **O cartão** (`CartaoDeAcao`) nasce da aprovação pedida pelo kit.
   - Traz os passos, o que conferir, as travas e o responsável (pela regra do responsável da tela).
   - Fica em memória até o clique, com quem pediu.
   - Expira em 30 minutos ou quando o servidor reinicia ("Peça de novo").
5. **`POST /api/chat/acoes/:id`:** só quem pediu, com o perfil da ação.
   - O servidor aprova e o kit continua.
   - A ação roda pela rota da tela, com a sessão de quem confirmou, então permissões e portões valem de novo.
   - O histórico do caso ganha a ação com "feito pelo chat".
   - `DELETE /api/chat/acoes/:id` descarta o cartão.
6. **Na tela** (`dados/chat.ts`), no modo misto (Mateus, 09/10):
   - vai ao servidor a pergunta sobre um caso do servidor (pelo processo ou pelo cliente citado) e a consulta sem cliente; `confirmarAcao` e `cancelarAcao` seguem quem fez o cartão;
   - seguem no chat simulado a pergunta sobre um caso ou um cliente da semente e, sem cliente, as listas, os números e as ações que ele calcula por código sobre a semente (perícias da semana, jurimetria e as outras);
   - as tarefas que o chat cria no servidor aparecem na Central pela lista de tarefas do servidor.

### Campos de formulário

Nenhum campo novo. A pergunta é texto livre (até 2000 caracteres), validada pelo contrato na tela e no servidor.

### Telas

Nenhuma tela nova. O chat das Centrais e a aba Suporte (`ChatDoPortal`) passam a falar com o servidor.

### Risks / Trade-offs

- **Dependência nova:** o kit é recente (0.x) e muda rápido, então a versão fica fixa. Se atrapalhar, as ferramentas viram chamadas do motor de hoje.
- **Cartão em memória:** reiniciar o servidor perde os cartões em aberto, e a pessoa pede de novo. Guardar no banco se virar problema.
- **Cliente citado pelo nome:** compara o nome inteiro com as pessoas que têm caso. Nomes parecidos viram a pergunta "qual deles?".
- **Sócio com saúde no chat:** é uma exceção à matriz, em que o Sócio não vê dado de saúde nas telas. Se a matriz mudar, a exceção sai.
