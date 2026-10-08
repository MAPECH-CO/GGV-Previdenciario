# Design · GGVP-8 Via administrativa no INSS

Base: o modelo de dados da fundação (`caso`, `etapa`, `tarefa`, `decisao`, `documento`, `requerimento_inss`, `pericia`, `credencial_govbr`, `evento_auditoria`) e a matriz de permissões de `@ggv/contratos`.

## Grupo 1 · GGVP-27 e GGVP-31

### Contratos (`packages/contratos`)

| Contrato | Uso |
|---|---|
| `TarefaDaCentral` | `GET /api/tarefas`: tarefas abertas do perfil ativo (id, caso, cliente, passo, título, detalhe, prazo, urgente) |
| `CasoParaProtocolo` | `GET /api/casos/:id/protocolo`: cliente, benefício, OK da Sênior (quem e quando), documentos na ordem (só tipo e nome, nunca o conteúdo) e se há senha no cofre |
| `RegistrarProtocolo` | `POST /api/casos/:id/protocolo` (multipart): número do requerimento, DER (`dd/mm/aaaa` por `validarData` e `dataParaIso` de `@ggv/campos`), "Revisei o requerimento antes de enviar" (precisa ser `true`) e o comprovante (PDF ou imagem) |
| `SenhaDoCofre` | `POST /api/casos/:id/cofre`: a senha e por quantos segundos a tela pode mostrá-la (60) |
| `DecidirPericia` | `POST /api/casos/:id/pericia`: `precisa` (sim ou não) e, se sim, `tipos` (perícia médica, avaliação social ou as duas; ao menos um) |

### Campos de formulário

| Campo | Função de `@ggv/campos` |
|---|---|
| Número do requerimento | `somenteDigitos` (só número) |
| DER | `validarData`, `dataParaIso` |

### Servidor

- `exigir('protocolo_inss.registrar')` nas rotas do protocolo e do cofre; `exigir('pericia.decidir')` na decisão (ação nova na matriz, versão 2: advogada).
- G2: o protocolo só é aceito com a última decisão `D2.01 · aprovacao_inss` do caso = `aprovado`. A fila do Jurídico administrativo só traz esses casos (CA5).
- G9: a senha é decifrada (AES-256-GCM, chave `COFRE_CHAVE` do ambiente; sem chave em produção, a API não sobe) e o uso vai para o histórico (quem, quando, caso).
- Comprovante: `documento` com hash SHA-256; o arquivo vai para o armazenamento (Supabase Storage, bucket privado `documentos`, quando há `SUPABASE_URL` e a chave de serviço; senão, a pasta local `apps/api/.arquivos-local`).
- Junção do D2 ("protocolo feito e perícia resolvida ou sem perícia"): uma função só, chamada depois do protocolo, da decisão de perícia e do resultado da perícia; quando fecha, abre a etapa `D2.04` aguardando o INSS. Teste para as quatro combinações.
- Decisão de perícia: grava `decisao` (`D2.03`, autora e horário) e, se precisa, uma `pericia` por tipo e a tarefa `DP.01` para o Jurídico administrativo, aberta pelo sistema (ninguém tem a ação `pericia.abrir_tarefa`).

### Tela

- Central do Jurídico administrativo e da advogada: a fila vem de `GET /api/tarefas` (a mesma linha de tarefa do Atendimento).
- Protocolar no Meu INSS (`/casos/:id/protocolo`) e Decidir perícia (`/casos/:id/pericia`), dentro de `<Exige>`.

### Dados de exemplo

O banco local ganha casos de exemplo, marcados como exemplo: um caso aprovado pela Sênior, com documentos, senha no cofre e as tarefas de protocolar e de decidir perícia.

### Dependências novas e por quê

- `@fastify/multipart`: receber o comprovante do protocolo na mesma requisição dos campos.

## Grupo 2 · GGVP-23, GGVP-35 e GGVP-48

### Context

O grupo 1 já tem: a Central do perfil vinda do servidor, a decisão `D2.01 · aprovacao_inss` lida como o OK da Sênior (G2), a junção do D2 abrindo a etapa `D2.04` e os casos de exemplo. Faltam a conferência que grava esse OK, a tarefa que a junção deve abrir e o registro da resposta do INSS. O banco já tem `parecer_medico`, `documento_medico`, `kit_documento`, `ficha_atendimento`, `resultado_inss` e `decisao`.

### Goals / Non-Goals

**Goals:** a Sênior aprova ou reprova no servidor, com os portões G1, G2 e G17; a junção abre "Trazer a resposta do INSS"; o Jurídico registra decisão ou exigência; o indeferido abre a Justiça com a carta e o motivo.

**Non-Goals:** liberar o caso ao Jurídico (GGVP-18, outro épico; aqui o caso já chega liberado pelos dados de exemplo), fazer o parecer médico (GGVP-20), a tela do D3.01 (GGVP-52), o card do chat da CA10 da GGVP-23 (sem chat ainda), a contagem do prazo da exigência (GGVP-34).

### Decisions

1. **Matriz versão 3**, três ações novas: `caso.ver` (ver o caso só para leitura: todos os perfis menos Financeiro e Sócio), `inss.registrar_resposta` (advogada, Sênior e Jurídico administrativo) e `caso.encerrar` (Sênior). Alternativa descartada: reaproveitar `entrevista.ver`, que tem outro sentido.
2. **Contratos** em `packages/contratos`: `CasoParaConferencia` (resumo, benefício, checklist com o que falta, documentos, parecer item a item, laudo novo esperando, ficha, kit assinado, `podeDecidir`), `DecidirConferencia` (`aprovar`, ou `reprovar` com motivo e "tem prazo?" com data `dd/mm/aaaa`), `DispensarParecer` (justificativa), `RespostaDoInss` (decisão deferido ou indeferido, ou exigência com texto e data; comunicação anexada; benefício concedido diferente do pedido) e `EncerrarCaso` (motivo).
3. **Campos**: data do ajuste e data da exigência por `validarData` e `dataParaIso`. Nenhum outro campo de pessoa.
4. **Portões no servidor**: aprovar recusa sem checklist completo (G1: todos os itens obrigatórios do `kit_documento` do benefício com documento), sem parecer `suficiente` ou `dispensado` (G17) e com laudo novo sem conferência; cada recusa diz qual portão e vai para o histórico. Sem `kit_documento` cadastrado para o benefício, o checklist conta como completo e a tela avisa "kit do benefício não cadastrado".
5. **Aprovar** grava a decisão (quem e quando) e abre as duas tarefas na mesma transação (CA2). **Reprovar** grava a decisão com o motivo, conclui a tarefa da Sênior e abre "Ajustar o caso" para o Atendimento, com a data quando houver prazo. Nova liberação cria nova tarefa da Sênior; o OK continua sendo só a última decisão (CA9).
6. **Junção**: ao abrir a `D2.04`, abre também "Trazer a resposta do INSS" para a advogada (CA1 da GGVP-35).
7. **Resposta do INSS** num envio com arquivo (a comunicação ou a carta), como o comprovante do protocolo: deferido grava `resultado_inss` e abre "Prestar contas" (GGVP-44) ou, se diferente do pedido, "Analisar deferimento diferente do pedido"; indeferido grava `resultado_inss` com o motivo do INSS, muda o caso para `judicial`, abre a etapa `D3.01` e a tarefa "Registrar indeferimento" com a carta (GGVP-48); exigência grava `exigencia` (origem INSS) e abre "Tratar exigência do INSS" (GGVP-39), com o prazo "a calcular".
8. **Encerrar** (Sênior): caso `encerrado`, desfecho `desistencia`, motivo em `causa_desfecho`, tarefas abertas canceladas, histórico.
9. **Datas** (ajuste de 05/10, pedido do Mateus na homologação local): a DER e a data da exigência usam o calendário do navegador, já em hoje, sem data futura; `hojeIso` entrou em `@ggv/campos`, e o contrato recusa data futura no servidor.

### Telas

A Central do Atendimento (tela do GGVP-120, do Pedro) passa a mostrar no topo as tarefas que o servidor tem para o perfil, acima das de exemplo, para o ajuste pedido pela Sênior aparecer (CA3; decisão do Mateus em 05/10, avisada ao Pedro no PR). Conferência (`/casos/:id/conferencia`, só leitura para quem não é Sênior), Vigília (`/casos/:id/vigilia`: o que o caso espera e desde quando, e o registro da resposta) e o botão "Encerrar sem judicializar" para a Sênior no caso indeferido.

### Risks / Trade-offs

- O prazo da exigência fica "a calcular" até a GGVP-34 (calendário dos tribunais com o Lucas). A tarefa nasce sem prazo; risco de passar despercebida, mitigado por aparecer no topo da fila da advogada.
- Sem `kit_documento` cadastrado, o G1 não barra nada; o aviso na tela deixa isso visível até a GGVP-65 cadastrar os kits.

## Grupo 3 · GGVP-39 e GGVP-44

### Context

O grupo 2 deixa a exigência gravada (`exigencia`, origem INSS) com a tarefa "Tratar exigência do INSS" para a advogada, e o deferido com "Prestar contas" e o `resultado_inss` ligado à comunicação. O banco já tem `exigencia_item` (prova e quem cumpriu), `tarefa` com `tentativas`, `limite_tentativas` e escalada, `tentativa` (G15), `pericia`, `prestacao_contas` (G8 e "pessoas diferentes" no próprio banco), `agendamento` (tipo `ida_ao_banco`), `mensagem`, `modelo`, `configuracao` e `feriado`. A matriz já tem `prestacao.ver`, `prestacao.dar_ok` e `prestacao.registrar_recebimento`.

### Goals / Non-Goals

**Goals:** a advogada decide o que a exigência pede e o sistema abre as tarefas certas com o prazo contado em código; a Documentação cobra, junta a prova item a item e responde (G21, G15); a Sênior é avisada perto do vencimento; a prestação de contas calcula os valores em código, versiona e, ao concluir, abre o Financeiro e o Atendimento juntos; o Atendimento agenda a ida ao banco e registra a confirmação revisada.

**Non-Goals:** IA (classificação sugerida e resposta redigida: épico GGVP-14); envio automático pelo WhatsApp; a contagem de prazos judiciais e o calendário dos tribunais (GGVP-34); registrar o resultado da perícia (épico Perícia); custas, lançamento e recibo no Financeiro; agenda visual (só a data na tarefa e no agendamento).

### Decisions

1. **Matriz versão 4**, quatro ações novas: `exigencia_inss.tratar` (advogada), `exigencia_inss.cumprir` (documentacao), `exigencia_inss.decidir_vencida` (senior) e `banco.agendar` (atendimento, atendimento_lider). A prestação usa as que já existem (`prestacao.ver`, `prestacao.dar_ok`, `prestacao.registrar_recebimento`).
2. **Prazo da exigência do INSS em código** (`apps/api/src/fluxo/prazo-inss.ts`), pela regra que a GGVP-34 já traz no CA11: dias corridos, começando no dia seguinte ao da exigência; o fim em sábado, domingo ou feriado da tabela `feriado` passa para o próximo dia útil (Lei 9.784, art. 66). O número de dias é o que está na comunicação do INSS, informado pela advogada (obrigatório, inteiro de 1 a 120). Teste com fim de semana, feriado e véspera. A contagem só vale para o INSS; a judicial continua com a GGVP-34.
3. **Dias úteis do alerta** (CA14) pela mesma tabela `feriado`. O alerta é calculado ao montar a fila da Sênior (`GET /api/tarefas`), sem agendador: item pendente e prazo a 5 dias úteis ou menos vira a linha "Exigência perto do prazo" (urgente); a 2 ou menos, vai para o topo; vencido, a linha é "Exigência vencida: pedir dilação ou registrar a perda" e abre a tela da exigência com as duas ações da Sênior.
4. **Decidir a exigência** (`POST /api/casos/:id/exigencia`, advogada): `pede` = `documentos` | `pericia` | `pericia_e_documentos`; itens (texto, ao menos um quando há documentos); tipos de perícia (ao menos um quando há perícia); dias do INSS; prazo de entrega da Documentação (calendário, obrigatório quando há documentos, até o prazo do INSS). Grava `exigencia.pede`, `exigencia.prazo`, os `exigencia_item` (Documentação) e conclui "Tratar exigência do INSS". Documentos ou os dois: abre "Cumprir exigência do INSS" (`D2.05d`, documentacao) com prazo, limite do G15 e a etapa `D2.E3` "cliente entregar o documento". Só perícia: cria as `pericia` e abre a tarefa de perícia do Jurídico administrativo, como a GGVP-31.
5. **Limites (Q1)** vêm de `configuracao`: `cobranca.limite` (tentativas) e `cobranca.intervalo_dias` (próximo lembrete). Sem configuração, o card avisa "limite de cobranças não configurado" e não escala; os dados de exemplo trazem 3 e 2. Nenhum número fixo no código.
6. **Cobrança** (`POST /api/casos/:id/exigencia/cobrancas`, Documentação): canal (`whatsapp`, `telefone`, `email`, `sms`, `presencial`) e resultado (`entregou`, `sem_resposta`, `vai_entregar`); grava `tentativa`, soma em `tarefa.tentativas` e marca o próximo lembrete (`tarefa.prazo` = hoje + intervalo, sem passar do prazo de entrega). Com o limite atingido e resultado sem entrega, a tarefa escala (`escalada_em`, `escalada_para = senior`) e abre "Cobrança sem retorno" para a Sênior (CA5).
7. **Item** (`POST /api/casos/:id/exigencia/itens/:item`, multipart, Documentação): anexa a prova (PDF ou imagem) e marca cumprido, ou marca "não cumprido" com motivo. Colunas novas `exigencia_item.situacao` (`pendente`, `cumprido`, `nao_cumprido`) e `exigencia_item.motivo`.
8. **Responder no portal** (`POST /api/casos/:id/exigencia/resposta`, multipart, Documentação): recusa sem prova em todos os itens (G21); data da resposta (calendário, sem data futura) e comprovante obrigatórios. Grava a exigência como `cumprida`, conclui o card e a `D2.E3`. Com perícia pedida (`pericia_e_documentos`): cria as `pericia` e abre a tarefa de perícia (CA3, CA6). Sem perícia: abre a etapa `D2.E4` (aguardando "INSS analisar a resposta") e a tarefa "Trazer a resposta do INSS", para a vigília seguir (CA4).
9. **Volta da perícia** (`avancarExigencia`, em `apps/api/src/fluxo/`): com o resultado de todas as perícias chamadas pela exigência, devolve o caso à vigília como no item 8. Quem chama é o registro do resultado da perícia (épico Perícia); aqui fica a função com teste.
10. **Sênior no vencido** (`POST /api/casos/:id/exigencia/vencida`): `dilacao` (exigência `dilacao_pedida`, novo prazo pelo calendário) ou `perda` (exigência `vencida`, tarefas da exigência canceladas); histórico nos dois.
11. **Prestação de contas** (`GET` e `POST /api/casos/:id/prestacao`, advogada): valor recebido (atrasados, por `normalizarDecimal` e `validarDecimal` de `@ggv/campos`), percentual (vem de `contrato.percentual_honorarios`; sem ele, a advogada informa), forma e prazo de pagamento, "Conferi os valores com a carta de concessão". Cálculo em código (`calcularPrestacao` em `packages/contratos`, o mesmo na prévia da tela e no servidor), em centavos inteiros: honorários = piso(recebido × percentual / 100), repasse = recebido − honorários. Teste com centavos quebrados. A carta é a comunicação do deferido (`resultado_inss.documento_id`), ligada à tarefa quando ela nasce (CA4, ajuste na rota da vigília).
12. **Concluir** grava a versão com o OK da advogada e, na mesma transação, conclui "Prestar contas" e abre "Receber a prestação de contas" (financeiro, passo `D2.06r`, código proposto para a tela do recebimento) e "Agendar ida ao banco" (atendimento, `D2.06b`). **Alterar** depois de concluída cria a versão seguinte (nova linha, `versao` + 1, com quem e quando), mantém a anterior e reabre o recebimento do Financeiro se ainda não houve.
13. **Recebimento** (`POST /api/casos/:id/prestacao/recebimento`, Financeiro): `recebido` grava quem e quando (o banco já recusa a mesma pessoa do OK); `divergencia` exige motivo, grava na versão e abre "Corrigir a prestação: <motivo>" para a advogada.
14. **Ida ao banco** (`GET` e `POST /api/casos/:id/banco`, Atendimento): data (calendário), hora e agência ou local obrigatórios; quem acompanha, opcional (ver a decisão 19). Remarcar cancela o agendamento anterior e cria outro. Depois de gravar, a tela mostra a mensagem montada pelo modelo "Confirmação da ida ao banco" (tipo `mensagem`, ativo); a pessoa revisa, envia pelo celular e clica "Enviei pelo WhatsApp", que grava `mensagem` (canal, texto, quem aprovou, quem enviou, quando) e `prestacao_contas.cliente_avisado_em`. Sem o OK da advogada, o servidor recusa o envio (G8). Sem modelo ativo, a tela diz "modelo não cadastrado" e não registra.
15. **Valores só para quem pode** (CA2): `GET /api/casos/:id/banco` não devolve valor nenhum; as telas do Financeiro e da advogada usam `prestacao.ver`.
16. **Migração 0008**: `exigencia.pede`, `exigencia.dias_inss`; `exigencia_item.situacao`, `exigencia_item.motivo`; `prestacao_contas.versao` (único por caso), `percentual_honorarios`, `forma_pagamento`, `prazo_pagamento`, `carta_documento_id`, `divergencia`; `contrato.percentual_honorarios`; `agendamento.acompanhante`. O Mateus roda `db:migrar` no Supabase depois do merge.

### Ajustes da homologação local (Mateus, 05/10)

17. **Resposta no portal é do Jurídico**: a Documentação cobra, junta a prova de cada item e clica "Entregar ao Jurídico" (`POST /api/casos/:id/exigencia/entrega`, só com prova em todos os itens, G21), que conclui o card e a espera `D2.E3` e abre "Responder exigência no portal do INSS" para a advogada (passo `D2.05r`, proposto). A advogada registra a data e o comprovante na tela da exigência (`POST /api/casos/:id/exigencia/resposta` passa a exigir `exigencia_inss.tratar`). Matriz sem mudança.
18. **Forma de pagamento**: opcional e numa lista fechada (`FORMAS_DE_PAGAMENTO`: Pix, transferência bancária, boleto, dinheiro), para o painel não juntar grafias diferentes. A lista é provisória: confirmar com o Lucas.
19. **Quem acompanha**: opcional; quando há, é um usuário do portal (`agendamento.acompanhante_id`). O modelo da mensagem usa `{acompanhamento}`, que só vira frase quando alguém do escritório vai junto. A migração 0008 foi gerada de novo (ainda não tinha saído da máquina).

### Contratos (`packages/contratos`)

`ExigenciaDoCaso`, `DecidirExigencia`, `RegistrarCobranca`, `CumprirItem`, `ResponderExigencia`, `DecidirVencida`, `PrestacaoDoCaso`, `SalvarPrestacao`, `ReceberPrestacao`, `IdaAoBancoDoCaso`, `AgendarIdaAoBanco` e `RegistrarEnvio`.

### Campos de formulário

| Campo | Como |
|---|---|
| Datas (prazo de entrega, resposta, dilação, ida ao banco, prazo de pagamento) | calendário do navegador, com `isoParaData` e `hojeIso` de `@ggv/campos` |
| Dias do INSS | `normalizarInteiro` e `validarInteiro` |
| Valor recebido | `normalizarDecimal`, `validarDecimal` e `formatarDecimal` |
| Percentual de honorários | `normalizarDecimal` e `validarDecimal` (0 a 100) |
| Hora | `<input type="time">` (sem função em `campos`; o servidor confere `hh:mm`) |

### Telas

Tratar exigência (`/casos/:id/exigencia`, advogada; a Sênior vê as ações do vencido), Cumprir exigência (`/casos/:id/exigencia/documentos`, Documentação: itens com status, cobranças e "Anexar e responder" travado até todos os itens terem prova), Prestar contas (`/casos/:id/prestacao`), Receber a prestação (`/casos/:id/prestacao/recebimento`, Financeiro, com o agendamento) e Agendar ida ao banco (`/casos/:id/banco`, Atendimento, sem valores).

### Dados de exemplo

Configuração `cobranca.limite` = 3 e `cobranca.intervalo_dias` = 2; modelo "Confirmação da ida ao banco"; contrato com 30% para os casos de exemplo; um caso com exigência registrada esperando a advogada (Ulisses) e um deferido com "Prestar contas" e a carta (Vera).

### Risks / Trade-offs

- A tabela `feriado` começa vazia: o prazo só pula fim de semana até alguém cadastrar os feriados (GGVP-34 e Lucas). A tela avisa "feriados não cadastrados" enquanto ela estiver vazia.
- O alerta da Sênior é calculado ao abrir a fila; se ninguém abrir, ninguém vê. Agendador (pg-boss) fica para quando houver notificação.
- Arredondar os honorários para baixo é escolha do revisor (a favor do cliente); o Lucas valida em homologação.
- Exigência que não é documento nem perícia (esclarecimento, ida à agência) segue sem caminho próprio: pergunta aberta ao Lucas desde 01/10; até lá, a advogada usa "Documentos" com o item descrito.
