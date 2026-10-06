# Spec Delta · ggvp-44

## Purpose

Benefício deferido: o deferimento abre a prestação de contas da advogada; concluída a prestação, o Financeiro recebe e o Atendimento agenda a ida ao banco com o cliente, ao mesmo tempo. Respostas do revisor de 05/10: o aviso ao cliente só sai depois do OK da advogada (Q7, G8); a prestação tem valor recebido, honorários pelo percentual do contrato e repasse ao cliente, calculados por código; o Financeiro marca "Recebido" ou "Divergência" (com motivo, volta para a advogada); a mensagem ao cliente vai pelo WhatsApp com o modelo aprovado, sempre revisada por pessoa e registrada (Q5).

## ADDED Requirements

### Requirement: CA1 · Deferido abre "Prestar contas"; o banco só depois
Registrar "Deferido" SHALL abrir a tarefa "Prestar contas" para a advogada. A tarefa "Agendar ida ao banco" do Atendimento MUST nascer só quando a prestação é concluída, junto com a do Financeiro.

#### Scenario: CA1 · Registrar o deferimento
- **Dado** "Deferido"
- **Quando** registro a decisão
- **Então** nasce a tarefa "Prestar contas" (Jurídico); a tarefa "Agendar ida ao banco" (Atendimento) só nasce quando a prestação é concluída, junto com a do Financeiro

### Requirement: CA2 · Concluir abre Financeiro e Atendimento ao mesmo tempo
Concluir a prestação SHALL abrir, na mesma operação, a tarefa do Financeiro e a do Atendimento. Os valores MUST ficar visíveis só para o Financeiro e o Jurídico; o Atendimento agenda sem ver valores.

#### Scenario: CA2 · Prestação enviada
- **Dado** a prestação de contas feita
- **Quando** envio
- **Então** o Financeiro recebe e só ele e o Jurídico veem os valores; ao mesmo tempo, o Atendimento recebe a tarefa de agendar a ida ao banco

### Requirement: CA3 · Ida ao banco agendada gera a confirmação ao cliente
Registrar a data da ida ao banco SHALL preparar a confirmação ao cliente pelo modelo aprovado; o envio MUST ser revisado por pessoa (Q5) e MUST NOT acontecer antes do OK da advogada na prestação (G8).

#### Scenario: CA3 · Data registrada
- **Dado** a ida ao banco agendada
- **Quando** o Atendimento registra a data
- **Então** o cliente recebe a confirmação

### Requirement: CA4 · A prestação já vem com a carta de concessão
A prestação de contas SHALL nascer com a carta de concessão anexada: a comunicação do deferimento registrada na vigília.

#### Scenario: CA4 · A prestação nasce
- **Dado** "Deferido"
- **Quando** a prestação de contas nasce
- **Então** já vem com a carta de concessão anexada

### Requirement: CA5 · Valores calculados por código e conferência obrigatória
Os honorários SHALL ser calculados por código pelo percentual do contrato do cliente sobre o valor recebido, e o repasse ao cliente SHALL ser o valor recebido menos os honorários, em centavos, arredondando os honorários para baixo (lado do cliente). Concluir MUST exigir "Conferi os valores com a carta de concessão" marcado.

#### Scenario: CA5 · Conferir a prestação
- **Dado** a prestação aberta
- **Quando** confiro
- **Então** os valores vêm calculados pelo sistema, por código, e só concluo depois de marcar "Conferi os valores com a carta de concessão"

### Requirement: CA6 · Alterar depois de concluída gera nova versão
Alterar a prestação concluída SHALL registrar uma nova versão, com quem fez e quando; a versão anterior MUST continuar guardada.

#### Scenario: CA6 · Alterar a prestação
- **Dado** a prestação concluída
- **Quando** alguém a altera
- **Então** fica registrada uma nova versão, com quem fez e quando

### Requirement: CA7 · Financeiro sem ação antes da conclusão
Antes da prestação concluída, a Central do Financeiro MUST NOT ter tarefa com ação para ela.

#### Scenario: CA7 · Prestação não concluída
- **Dado** a prestação ainda não concluída
- **Quando** o Financeiro abre a Central
- **Então** não há tarefa com ação para ela

### Requirement: CA8 · O Financeiro vê os valores e a versão concluída
A tarefa do Financeiro SHALL mostrar os valores (recebido, honorários, repasse), a forma e o prazo de pagamento e a versão concluída da prestação.

#### Scenario: CA8 · O Financeiro abre a tarefa
- **Dado** a prestação recebida
- **Quando** o Financeiro abre a tarefa
- **Então** vê os valores, a forma e o prazo de pagamento e a versão concluída da prestação

### Requirement: CA9 · Recebido ou Divergência
Registrar o recebimento SHALL gravar quem recebeu e quando; quem deu o OK na prestação MUST NOT registrar o recebimento. "Divergência" MUST exigir o motivo e SHALL devolver a prestação para a advogada com ele.

#### Scenario: CA9 · Registrar o recebimento
- **Dado** a prestação recebida
- **Quando** o Financeiro registra o recebimento
- **Então** ficam registrados quem recebeu e quando; divergência de valores volta para a advogada com o motivo

### Requirement: CA10 · Agendamento com data, hora, local e acompanhante
Agendar a ida ao banco MUST exigir data, hora, agência ou local e quem acompanha o cliente; o Financeiro SHALL ver o agendamento.

#### Scenario: CA10 · O Atendimento agenda
- **Dado** a tarefa de agendar a ida ao banco
- **Quando** o Atendimento agenda
- **Então** data, hora, agência ou local e quem acompanha o cliente são obrigatórios, e o Financeiro vê o agendamento

### Requirement: CA11 · Confirmação pelo modelo, registrada
A confirmação ao cliente MUST usar o modelo aprovado e SHALL ficar registrada com data, canal e texto enviado.

#### Scenario: CA11 · Confirmação enviada
- **Dado** a confirmação ao cliente
- **Quando** é enviada
- **Então** usa o modelo aprovado e fica registrada com data, canal e texto enviado

### Requirement: CA12 · Remarcar atualiza o Financeiro e gera novo convite
Remarcar a ida ao banco SHALL atualizar o que o Financeiro vê e preparar o novo convite ao cliente, revisado por pessoa.

#### Scenario: CA12 · Remarcação
- **Dado** a ida ao banco remarcada
- **Quando** o Atendimento registra a nova data
- **Então** o Financeiro é atualizado e o cliente recebe o novo convite
