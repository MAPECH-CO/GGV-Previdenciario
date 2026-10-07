# Design · GGVP-11 Desfecho e financeiro

## GGVP-98 · Financeiro recebe e cliente é avisado

### Context

A GGVP-44 já tem a prestação da advogada (G8), o recebimento do Financeiro com divergência, a ida ao banco com o aviso pelo modelo e a remarcação. Nela, quem agendava era o Atendimento, e a tarefa dele nascia junto com a do Financeiro, no OK da advogada. O Lucas mudou em 06/10: quem avisa e marca é o Financeiro, depois de receber; o Atendimento leva o cliente ao banco e vê isso no calendário dele.

### Decisions

1. **Um caminho para o INSS e para a Justiça** (Mateus, 07/10): as rotas `/api/casos/:id/prestacao/recebimento` e `/api/casos/:id/banco` servem os dois. `banco.agendar` passa a ser do Financeiro; a matriz sobe para a versão 11.
2. **A tarefa do aviso nasce do recebimento** (CA4): o OK da advogada abre só "Receber a prestação de contas"; "Receber e lançar" abre "Avisar resultado e agendar a ida ao banco" para o Financeiro.
3. **"Valores conferem com o comprovante"** (CA3): `ReceberPrestacao` com `recebido` exige `valoresConferem: true`; o servidor confere de novo.
4. **Quem acompanha é obrigatório e do Atendimento** (CA6, Lucas Q24): `acompanhanteId` obrigatório; o servidor recusa quem não tem o perfil Atendimento. Agendar abre para essa pessoa a tarefa "Levar ao banco", com a data como prazo e o nome dela como responsável; remarcar atualiza a tarefa (CA7). É dali que a Agenda lê.
5. **Recusa registrada** (CA8): quem deu o OK e tenta receber leva 409 e o evento `portao_bloqueado` com o portão G8 e o motivo, que aparece em "Tentativas bloqueadas".
6. **Aviso grava no acervo** (CA2): o envio do aviso grava o caso em `processo_acervo` (uma vez por caso, `fonte: portal`, desfecho do caso) e registra a baixa no histórico. O desfecho fica sem conferência (`desfecho_conferido_por` nulo): a conferência que põe o caso nas contas da jurimetria é da GGVP-41 (G22).
7. **Confirmar recebimento** (CA9): `POST /api/casos/:id/banco/confirmacao`, do Financeiro, depois do aviso: a ida ao banco fica "realizado", "Levar ao banco" conclui e o caso vai para a fase "encerrado".
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
