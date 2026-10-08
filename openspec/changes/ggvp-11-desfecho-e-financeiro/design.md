# Design · GGVP-11 Desfecho e financeiro

## GGVP-98 · Financeiro recebe e cliente é avisado

### Context

A GGVP-44 já tem a prestação da advogada (G8), o recebimento do Financeiro com divergência, a ida ao banco com o aviso pelo modelo e a remarcação. Nela, quem agendava era o Atendimento, e a tarefa dele nascia junto com a do Financeiro, no OK da advogada. O Lucas mudou em 06/10: quem avisa e marca é o Financeiro, depois de receber; o Atendimento leva o cliente ao banco e vê isso no calendário dele.

### Decisions

1. **Um caminho para o INSS e para a Justiça** (Mateus, 07/10): as rotas `/api/casos/:id/prestacao/recebimento` e `/api/casos/:id/banco` servem os dois. `banco.agendar` passa a ser do Financeiro, e a matriz sobe uma versão. Era a 11; na revisão de 08/10 passou a 13, porque o #23 (Jurimetria) usa a 11 e a 12 e entra antes.
2. **A tarefa do aviso nasce do recebimento** (CA4): o OK da advogada abre só "Receber a prestação de contas"; "Receber e lançar" abre "Avisar resultado e agendar a ida ao banco" para o Financeiro.
3. **"Valores conferem com o comprovante"** (CA3): `ReceberPrestacao` com `recebido` exige `valoresConferem: true`; o servidor confere de novo.
4. **Quem acompanha é obrigatório e do Atendimento** (CA6, Lucas Q24): `acompanhanteId` obrigatório; o servidor recusa quem não tem o perfil Atendimento. Agendar abre para essa pessoa a tarefa "Levar ao banco", com a data como prazo e o nome dela como responsável; remarcar atualiza a tarefa (CA7). É dali que a Agenda lê.
5. **Recusa registrada** (CA8): quem deu o OK e tenta receber leva 409 e o evento `portao_bloqueado` com o portão G8 e o motivo, que aparece em "Tentativas bloqueadas".
6. **Aviso grava no acervo** (CA2): o envio do aviso grava o caso em `processo_acervo` (uma vez por caso, `fonte: portal`, desfecho do caso) e registra a baixa no histórico. O desfecho fica sem conferência (`desfecho_conferido_por` nulo): a conferência que põe o caso nas contas da jurimetria é da GGVP-41 (CA5). Caso sem desfecho e sem deferimento registrado não entra como processo bom: o aviso é recusado (409) até o resultado ser registrado (revisão de 08/10).
7. **Confirmar recebimento** (CA9): `POST /api/casos/:id/banco/confirmacao`, do Financeiro, depois do aviso: a ida ao banco fica "realizado", "Levar ao banco" conclui e o caso vai para a fase "encerrado". O caso encerrado não reabre: agendar a ida ao banco e avisar o cliente devolvem 409, e nenhuma tarefa nasce (revisão de 08/10).
8. **Canal**: o Chatwoot é a plataforma; o canal que vai na mensagem continua o do cliente (WhatsApp, telefone, e-mail, SMS). Sem migração.

### Contratos (`packages/contratos/src/prestacao.ts`)

- `ReceberPrestacao`: `{ resultado: 'recebido', valoresConferem: true }` ou `{ resultado: 'divergencia', motivo }`.
- `AgendarIdaAoBanco`: `acompanhanteId` obrigatório.
- `IdaAoBancoDoCaso`: `equipe` só com o Atendimento; `podeConfirmar` e `encerrado`.

### Campos

| Campo | Regra |
|---|---|
| Data da ida ao banco | `normalizarData`, `validarData`, `dataParaIso` (`DataObrigatoria`) |
| Hora | hh:mm (o contrato já confere; `validarHora` ainda falta na `campos`) |
| Agência ou local | texto obrigatório |
| Quem acompanha | lista do Atendimento, obrigatória |
| Valores conferem com o comprovante | caixa obrigatória para "Receber e lançar" |
| Motivo da divergência | texto obrigatório |

## GGVP-22 · Explicar o resultado ao cliente

### Decisions

1. **Sem IA até 09/10:** o Jurídico (advogada ou Sênior) escreve e aprova o resumo; a tela mostra quem aprovou e quando (Lucas, 06/10). Quando a IA voltar, ela só sugere o texto, guardado em `decisao.sugestao_ia`.
2. **O resumo é decisão de pessoa:** `decisao` com `tipo: resumo_cliente`, o texto em `justificativa` e quem fala em `resultado`. Sem tabela nova.
3. **Quem fala** (CA5): "Eu ligo" deixa "Explicar resultado" com a advogada (responsável ela mesma); no padrão, vai ao Atendimento. Só quem ficou com a explicação registra o contato: a advogada que a pegou ou o Atendimento (o líder também). Outro perfil com `resultado.explicar` recebe 403 (revisão de 08/10).
4. **Cada contato** (CA4) é uma linha de `atendimento` (canal, início, quem, o que foi explicado; sem contato fica com o resumo vazio).
   - A tela lista só os contatos desta explicação: cada registro grava no histórico o atendimento e a tarefa, e a lista sai dali. Outro atendimento do caso não entra (revisão de 08/10).
   - ponytail: o vínculo vive no histórico; uma coluna `tarefa_id` em `atendimento` entra na próxima migração do épico.
5. **Fecha** (CA2): "Expliquei ao cliente" conclui a tarefa e põe o caso na fase "encerrado"; a tela mostra "Perdemos: estudo registrado".
6. **Entrada:** `abrirExplicacaoDoResultado(casoId)` abre "Aprovar o resumo para o cliente" para a advogada. Quem chama: o estudo de caso (GGVP-19), que já chama no PR da IA (#26), e o "Não recorrer" (GGVP-100), no próximo PR do épico. A semente traz o Paulo Mendes (exemplo).
7. **Permissões** (matriz versão 12, que passou a 14 na revisão de 08/10 por causa do #23): `resultado.aprovar_resumo` para advogada e Sênior; `resultado.explicar` para Atendimento, líder e advogada. A tela abre com `caso.ver`; o Financeiro não abre.

### Campos

| Campo | Regra |
|---|---|
| O que dizer ao cliente | texto, de 20 a 2000 letras |
| Quem fala com o cliente | escolha obrigatória: Atendimento ou advogada |
| Canal | lista fechada (telefone, WhatsApp, presencial, vídeo) |
| O que foi explicado | texto obrigatório em "Expliquei ao cliente" |
