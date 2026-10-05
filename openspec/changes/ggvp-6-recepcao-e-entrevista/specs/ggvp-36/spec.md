# Spec Delta · ggvp-36 · Renovar a senha do gov.br antes da entrevista

## Purpose

O Atendimento recebe uma tarefa para renovar a senha do gov.br com o cliente antes da entrevista, para não perder a entrevista por falta de acesso. Tela do Figma: step_D1.08 `10:89`, com a Central do Atendimento `11:2`. Passo D1.08 do Miro.

## ADDED Requirements

### Requirement: CA1 · Ficha sem senha vira tarefa do Atendimento
Com a ficha sem senha analisada pelo Jurídico, o Atendimento SHALL receber a tarefa "Renovar senha do gov.br".

#### Scenario: CA1 · Análise da ficha sem senha
- **Dado** uma ficha sem senha
- **Quando** o Jurídico analisa
- **Então** o Atendimento recebe "Renovar senha do gov.br"

### Requirement: CA2 · Renovou: a senha vai ao cofre
Com a renovação feita, a senha SHALL ir para o cofre e a entrevista segue.

#### Scenario: CA2 · Deu certo
- **Dado** que a renovação deu certo
- **Quando** marco a tarefa
- **Então** a senha vai para o cofre e a entrevista segue

### Requirement: CA3 · Não conseguiu: o aviso ao cliente
Com "não conseguiu", o cliente SHALL receber o aviso de que precisa buscar a senha, se preciso no INSS, e a entrevista MUST seguir mesmo assim.

#### Scenario: CA3 · Não deu
- **Dado** que não deu
- **Quando** marco "não conseguiu"
- **Então** fica o aviso ao cliente e a entrevista segue

### Requirement: CA4 · O prazo é o horário da entrevista
A tarefa de renovar SHALL ter o prazo no horário da entrevista.

#### Scenario: CA4 · Abrir a tarefa
- **Dado** a tarefa de renovar criada
- **Quando** o Atendimento a abre
- **Então** o prazo é o horário da entrevista

### Requirement: CA5 · Senha só no componente do cofre
A senha SHALL ser digitada direto no componente do cofre, mascarada, sem ditar nem anotar, e a tela MUST mostrar só "senha no cofre · atualizada em dd/mm por <usuário>" (G9).

#### Scenario: CA5 · Guardar a senha
- **Dado** a renovação feita
- **Quando** o Atendimento guarda
- **Então** a tela mostra só "senha no cofre · atualizada em dd/mm por <usuário>"

### Requirement: CA6 · Motivo obrigatório e aviso registrado
Com "não conseguiu", o motivo SHALL ser obrigatório, o aviso dado ao cliente MUST ficar registrado e a entrevista não fica bloqueada.

#### Scenario: CA6 · Registrar "não conseguiu"
- **Dado** "não conseguiu"
- **Quando** o Atendimento registra
- **Então** o motivo é obrigatório e o aviso fica em "Últimos contatos"

### Requirement: CA7 · A advogada vê o resultado
O resultado da renovação SHALL aparecer para a advogada na tarefa da entrevista.

#### Scenario: CA7 · Abrir a preparação
- **Dado** o resultado da renovação
- **Quando** a advogada abre a tarefa da entrevista
- **Então** vê esse resultado

### Requirement: CA8 · Trilha do cofre sem o valor
Toda gravação ou uso do cofre SHALL registrar quem, quando e a ação, e MUST NOT registrar o valor da senha.

#### Scenario: CA8 · Gravar no cofre
- **Dado** qualquer gravação no cofre
- **Quando** acontece
- **Então** a trilha registra quem, quando e a ação, sem o valor

### Requirement: CA9 · Conferir o Meu INSS
Com a senha renovada, o Atendimento SHALL marcar "Conferi que o Meu INSS abre e que o CNIS aparece"; o portal não confere sozinho.

#### Scenario: CA9 · Guardar sem conferir
- **Dado** a senha renovada
- **Quando** o Atendimento não marcou a conferência
- **Então** "Guardar no cofre" não habilita

### Requirement: CA10 · O código chega no celular do cliente
Na renovação, a tela SHALL lembrar que o código de verificação chega no celular do próprio cliente, ou no e-mail dele.

#### Scenario: CA10 · Código de verificação
- **Dado** a renovação
- **Quando** o gov.br pede o código
- **Então** a tela lembra que ele chega no celular ou no e-mail do próprio cliente

### Requirement: CA11 · A data em que funcionou
Com a conferência marcada, o cofre SHALL registrar a data como a última vez em que a senha funcionou; a senha do gov.br não tem validade.

#### Scenario: CA11 · Guardar com a conferência
- **Dado** a conferência marcada
- **Quando** o Atendimento guarda
- **Então** o cofre registra a data como a última vez em que a senha funcionou
