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

### Telas

A Central do Atendimento (tela do GGVP-120, do Pedro) passa a mostrar no topo as tarefas que o servidor tem para o perfil, acima das de exemplo, para o ajuste pedido pela Sênior aparecer (CA3; decisão do Mateus em 05/10, avisada ao Pedro no PR). Conferência (`/casos/:id/conferencia`, só leitura para quem não é Sênior), Vigília (`/casos/:id/vigilia`: o que o caso espera e desde quando, e o registro da resposta) e o botão "Encerrar sem judicializar" para a Sênior no caso indeferido.

### Risks / Trade-offs

- O prazo da exigência fica "a calcular" até a GGVP-34 (calendário dos tribunais com o Lucas). A tarefa nasce sem prazo; risco de passar despercebida, mitigado por aparecer no topo da fila da advogada.
- Sem `kit_documento` cadastrado, o G1 não barra nada; o aviso na tela deixa isso visível até a GGVP-65 cadastrar os kits.
