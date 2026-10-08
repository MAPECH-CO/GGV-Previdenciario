# Spec Delta · ggvp-28 · Segunda ficha para auxílio acidentário

## Purpose

Se o caso pode ser auxílio acidentário, a advogada decide na análise da ficha e o cliente preenche a ficha específica (FICHA DE ATENDIMENTO AUXILIO ACIDENTE), para a entrevista já ter os dados do acidente. Telas do Figma: step_D1.07 `14:36` e Segunda ficha: auxílio acidentário `1815:422`. Passo D1.07 do Miro.

## ADDED Requirements

### Requirement: CA1 · "Pode ser acidentário" abre a pendência da segunda ficha
Com "pode ser acidentário" marcado, o Atendimento SHALL receber a pendência de passar a segunda ficha ao cliente: hoje em papel; no tablet, a mesma ficha em versão digital.

#### Scenario: CA1 · Marcar "Sim"
- **Dado** a ficha analisada
- **Quando** marco "pode ser acidentário"
- **Então** o Atendimento recebe "Preencher segunda ficha"

### Requirement: CA2 · As duas fichas juntas
Com a segunda ficha preenchida, o caso SHALL mostrar as duas fichas juntas.

#### Scenario: CA2 · Abrir o caso
- **Dado** a segunda ficha preenchida
- **Quando** abro o caso
- **Então** as duas fichas aparecem juntas

### Requirement: CA3 · A entrevista espera a segunda ficha
Com "pode ser acidentário" marcado e a segunda ficha ainda não preenchida, a entrevista MUST NOT ser liberada.

#### Scenario: CA3 · Segunda ficha pendente
- **Dado** "pode ser acidentário" marcado
- **Quando** a segunda ficha ainda não foi preenchida
- **Então** "Iniciar entrevista" não libera e diz o motivo

### Requirement: CA4 · A decisão no histórico
A resposta "Sim" ou "Não" a "Pode ser auxílio acidentário?" SHALL ficar no histórico do caso, com a autora e o horário.

#### Scenario: CA4 · Confirmar a decisão
- **Dado** a decisão
- **Quando** a advogada confirma "Sim" ou "Não"
- **Então** a resposta, a autora e o horário ficam no histórico

### Requirement: CA5 · As 6 seções do modelo
A segunda ficha SHALL ter as 6 seções do modelo do escritório: (1) atendimento e dados pessoais; (2) dados profissionais; (3) benefício/INSS; (4) acidente; (5) dados médicos; (6) histórico do caso contado pelo cliente.

#### Scenario: CA5 · Preencher
- **Dado** a segunda ficha
- **Quando** é preenchida
- **Então** tem as 6 seções, com os campos do cartão

### Requirement: CA6 · Ficha em papel lida pela IA
A segunda ficha em papel passada no scanner SHALL ter a imagem guardada na pasta do cliente, e a IA MUST preencher os campos para o Atendimento conferir e salvar.

#### Scenario: CA6 · Digitalizar
- **Dado** a segunda ficha em papel
- **Quando** passa no scanner
- **Então** a imagem vai para a pasta e os campos lidos chegam para conferir

### Requirement: CA7 · A senha do Meu INSS vai ao cofre
A senha do Meu INSS da seção 3 SHALL ir para o cofre e MUST NOT ir para um campo de texto (G9).

#### Scenario: CA7 · Senha na seção 3
- **Dado** a senha do Meu INSS
- **Quando** a ficha é salva ou lida
- **Então** a senha vai para o cofre

### Requirement: CA8 · Dados médicos só para o Jurídico
Os dados médicos da seção 5 SHALL aparecer só para o Jurídico; o Atendimento MUST ver só que a ficha foi preenchida.

#### Scenario: CA8 · Atendimento abre a ficha
- **Dado** os dados médicos da seção 5
- **Quando** o Atendimento abre a ficha
- **Então** vê só que a ficha foi preenchida
