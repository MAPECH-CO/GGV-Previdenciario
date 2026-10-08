# Spec Delta · ggvp-101 · Cobrar os documentos pendentes

## Purpose

Conferido o checklist e a documentação incompleta, o Atendimento recebe a tarefa de cobrar o cliente, com lembretes, para o caso não parar. A Documentação recebe o que o cliente manda. São 2 tentativas, com 3 dias entre elas. Depois da segunda, a advogada sênior decide, com justificativa, e a decisão volta para o Atendimento (G15). O prazo do juiz ou do INSS manda: as tentativas se ajustam e a tarefa vira urgência. Telas do Figma: step_D1.23 · Cobrar documento `2106:3` e step_D1.23 · Cobrança estourou o limite: decidir `1818:440`, com step_D1.21 `1818:2` e a Central `11:2`. Passo D1.23 do Miro. O Chatwoot é simulado. A régua geral de laço e escalonamento é da GGVP-94. O chat "documentos que faltam" (`2107:215`) é do chat da Central (GGVP-82) e fica fora daqui.

Contrato: tipos em `apps/web/src/regras/cobranca.ts` (`TentativaDeCobranca`, `PrazoExterno`, `DecisaoDaSenior`) e `apps/web/src/dados/cobranca.ts` (`Cobranca`, `SituacaoDaCobranca`). Endpoints de quando ligar no servidor:

| Endpoint | Função de exemplo |
|---|---|
| `GET /api/processos/:id/cobranca` | `obterCobranca` |
| `POST /api/processos/:id/cobranca/tentativas` | `registrarTentativa` |
| `POST /api/processos/:id/cobranca/adiamento` | `adiarCobranca` |
| `POST /api/processos/:id/cobranca/decisao` | `decidirCobranca` |

## ADDED Requirements

### Requirement: CA1 · Checklist incompleto abre a cobrança
Conferido o checklist com a documentação incompleta, com ou sem boas-vindas (que só vão ao cliente novo), o Atendimento SHALL receber a tarefa "Cobrar documento" com a lista do que falta.

#### Scenario: CA1 · Conferência incompleta
- **Dado** documentos pendentes
- **Quando** o checklist é conferido e a documentação não está completa
- **Então** o Atendimento recebe a tarefa de cobrança com a lista

### Requirement: CA2 · O que o cliente manda volta ao checklist
O documento que o cliente manda SHALL seguir para o card (digital) ou para o scanner (papel) e passar pela leitura (GGVP-81). O checklist é conferido de novo. Na tela da cobrança, "Anexar o documento recebido" abre a janela "Conferir e enviar" da GGVP-17.

#### Scenario: CA2 · O cliente mandou
- **Dado** que o cliente mandou
- **Quando** a Documentação recebe
- **Então** o documento segue para scanner ou card conforme papel ou digital, e o checklist é conferido de novo

### Requirement: CA3 · Duas tentativas, três dias, e a sênior
A cobrança SHALL ter limite de 2 tentativas, com 3 dias entre elas. Falhou a última, a tarefa MUST subir para a advogada sênior (GGVP-94). Os números são regra em código com teste.

#### Scenario: CA3 · Segunda tentativa sem resposta
- **Dado** o limite de cobranças atingido
- **Quando** a última tentativa falha
- **Então** a tarefa sobe para a sênior

### Requirement: CA4 · A tarefa mostra o que falta e o próximo lembrete
Ao abrir a tarefa, o Atendimento SHALL ver os documentos pendentes que vieram do checklist e a data do próximo lembrete.

#### Scenario: CA4 · Abrir a cobrança
- **Dado** a tarefa de cobrança aberta
- **Quando** o Atendimento a abre
- **Então** vê os documentos pendentes que vieram do checklist e a data do próximo lembrete

### Requirement: CA5 · O lembrete chega na Central
Passado o intervalo sem o documento, a pessoa responsável SHALL receber o lembrete na sua Central: a tarefa vence e fica urgente.

#### Scenario: CA5 · Três dias sem o documento
- **Dado** o intervalo de lembrete definido
- **Quando** ele passa sem o documento
- **Então** a pessoa responsável recebe o lembrete na sua Central

### Requirement: CA6 · Cada tentativa com data, canal e resultado
Cada tentativa registrada SHALL guardar a data, o canal e o resultado, e o número da tentativa SHALL aparecer na tarefa.

#### Scenario: CA6 · Registrar uma ligação
- **Dado** uma tentativa de cobrança
- **Quando** o Atendimento registra
- **Então** ficam a data, o canal e o resultado, e o número da tentativa aparece na tarefa

### Requirement: CA7 · A sênior recebe a decisão com o histórico
Atingido o limite, a sênior SHALL receber a tarefa "Decidir cobrança" com o histórico das tentativas. A cobrança MUST continuar visível para o Atendimento.

#### Scenario: CA7 · Subiu para a sênior
- **Dado** o limite atingido
- **Quando** a tarefa sobe
- **Então** a sênior recebe a tarefa de decisão com o histórico das tentativas, e a cobrança continua visível para o Atendimento

### Requirement: CA8 · Decisão com justificativa volta ao Atendimento
A decisão da sênior MUST ter justificativa, e o servidor recusa sem ela. A decisão SHALL voltar para o Atendimento. As opções seguem o Figma: nova tentativa com prazo, pedir visita ao escritório ou suspender o caso.

#### Scenario: CA8 · Decidir
- **Dado** a tarefa de decisão da sênior
- **Quando** ela decide
- **Então** a justificativa é obrigatória e a decisão volta para o Atendimento

### Requirement: CA9 · Chegou o pendente, a pendência fecha sozinha
Arquivado o documento pendente, a pendência correspondente SHALL fechar sozinha, o checklist é atualizado e os lembretes daquela pendência são cancelados. Sem nada faltando, a cobrança fecha.

#### Scenario: CA9 · Documento recebido
- **Dado** um documento pendente recebido pela Documentação
- **Quando** ele entra no card
- **Então** a pendência correspondente fecha sozinha, o checklist é atualizado e os lembretes seguintes daquela pendência são cancelados

### Requirement: CA10 · (proposta) Adiar pede a nova data
"Adiar" MUST pedir a nova data, depois de hoje e sem passar do prazo externo, e o contador de tentativas MUST NOT voltar a zero.

#### Scenario: CA10 · Adiar
- **Dado** uma cobrança adiada
- **Quando** o Atendimento escolhe "Adiar"
- **Então** precisa informar a nova data, e o contador de tentativas não volta a zero

### Requirement: CA11 · "Enviar cobrança" abre o Chatwoot com a mensagem pronta
"Enviar cobrança" SHALL abrir a conversa do cliente no Chatwoot com a mensagem pronta: o que falta e até quando. A pessoa confere e envia, e o envio conta como tentativa.

#### Scenario: CA11 · Enviar cobrança
- **Dado** "Enviar cobrança"
- **Quando** clico
- **Então** o Chatwoot abre a conversa do cliente com a mensagem pronta da cobrança, para a pessoa conferir e enviar

### Requirement: CA12 · O prazo externo manda
Com prazo do juiz ou do INSS no caso, a próxima tentativa SHALL caber antes do prazo (no máximo no dia anterior) e a tarefa SHALL ficar urgente. Sem prazo externo, vale o calendário normal.

#### Scenario: CA12 · Prazo do juiz em dois dias
- **Dado** um prazo do juiz ou do INSS no caso
- **Quando** a cobrança está aberta
- **Então** as tentativas se ajustam para caber nele e a tarefa vira urgência
