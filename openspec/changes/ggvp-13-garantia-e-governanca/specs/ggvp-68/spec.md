# Spec Delta · ggvp-68

## Purpose

Lista de exigências com prazo, responsável e prova (G5, G21), no juízo (D3a) e no INSS (D2.05). A maior parte já vale pelas histórias do passo: a advogada quebra a exigência em itens com prazo, setor e prova (GGVP-79, GGVP-35), sem prova não se manifesta nem responde (GGVP-87, GGVP-39, GGVP-109), e a 5 e a 2 dias úteis a Sênior recebe o alerta (GGVP-39 CA14). Esta história fecha o que falta: o alerta também ao líder do administrativo (resposta do Lucas, 02/10), o status de cada setor com a data do acionamento e a última tentativa, e o item ligado à peça que o cumpriu. A proposta de itens e a minuta pela IA (CA1, CA13) entram com o épico IA jurídica.

## ADDED Requirements

### Requirement: CA1 · A advogada quebra a exigência em itens (G5)
A advogada SHALL confirmar um item por exigência, com o trecho da decisão (G5). A proposta dos itens pela IA entra com o épico IA jurídica; até lá, a advogada escreve os itens.

#### Scenario: CA1 · Decisão com várias exigências
- **Dado** uma decisão com várias exigências (por exemplo, emendar a inicial, juntar documento, comprovar residência, indicar assistente)
- **Quando** a IA lê
- **Então** propõe um item por exigência, com o trecho da decisão, e a advogada confirma, junta ou separa itens (G5)

### Requirement: CA2 · Item com prazo, setor e prova
Cada item confirmado SHALL ter o prazo contado pelo lado seguro (GGVP-34), o setor responsável e a prova do cumprimento (documento anexado ou texto).

#### Scenario: CA2 · Salvar o item
- **Dado** cada item confirmado
- **Quando** salvo
- **Então** ele tem prazo contado pelo lado seguro (GGVP-34), setor responsável e o campo "prova do cumprimento" (documento anexado ou texto)

### Requirement: CA3 · Sem prova, bloqueia e lista (G21)
Com item sem prova, protocolar a manifestação ou responder a exigência no portal do INSS MUST ser bloqueado, com a lista dos pendentes (G21).

#### Scenario: CA3 · Protocolar com item sem prova
- **Dado** um item sem prova
- **Quando** alguém tenta protocolar a manifestação (D3a.04) ou responder a exigência no portal do INSS (D2.05)
- **Então** o portal bloqueia e lista os itens pendentes (G21)

### Requirement: CA4 · Alerta a 5 e a 2 dias úteis, à Sênior e ao líder
A 5 dias úteis do fim do prazo sem conclusão, a Sênior e o líder do administrativo ("Atendimento · líder") SHALL receber o alerta na Central; a 2 dias úteis ou menos, o caso SHALL ir para o topo da fila deles, em cor de ação (resposta do Lucas, 02/10: os dois são avisados, para a estratégia de emergência).

#### Scenario: CA4 · Perto do prazo
- **Dado** um item a 5 dias úteis do fim do prazo sem conclusão
- **Quando** o dia vira
- **Então** a sênior recebe o alerta; a 2 dias úteis, o caso fica no topo da fila dela em cor de ação

### Requirement: CA5 · O item fica ligado à peça
Protocolada a manifestação, cada item cumprido SHALL mostrar a peça que o cumpriu: a manifestação, com a versão e a data do protocolo.

#### Scenario: CA5 · Manifestação protocolada
- **Dado** a manifestação protocolada
- **Quando** registro
- **Então** cada item fica ligado à peça que o cumpriu

### Requirement: CA6 · Exigência do INSS que pede documentos
Definido o que a exigência do INSS pede, SHALL nascer a tarefa "documentos" da Documentação, que cobra o cliente, anexa e responde no portal; a decisão fica no Jurídico.

#### Scenario: CA6 · Documentos
- **Dado** uma exigência do INSS que pede documentos
- **Quando** a advogada define o que ela pede (`D2.05`)
- **Então** nasce a tarefa "documentos" para a Documentação, que cobra o cliente e, com os documentos, anexa e responde no portal do INSS; a decisão sobre o que fazer fica no Jurídico

### Requirement: CA7 · Perícia e documentos: primeiro os documentos
Com perícia e documentos, a Documentação SHALL cobrar primeiro, e a perícia SHALL ser marcada pelo Jurídico administrativo quando os documentos chegarem.

#### Scenario: CA7 · Perícia e documentos
- **Dado** uma exigência do INSS que pede perícia e documentos
- **Quando** a advogada define o que ela pede
- **Então** primeiro a Documentação cobra o cliente e, quando os documentos chegam, o Jurídico administrativo marca a perícia (DP)

### Requirement: CA8 · Resposta registrada e volta à vigília
Concluída a resposta à exigência do INSS, a Documentação SHALL registrar a data da resposta e o comprovante, e o caso SHALL voltar à vigília do Meu INSS.

#### Scenario: CA8 · Responder no portal
- **Dado** a resposta à exigência do INSS
- **Quando** a Documentação conclui
- **Então** registra a data da resposta no portal e anexa o comprovante, e o caso volta para a vigília do Meu INSS

### Requirement: CA9 · Só ciência
A publicação que só pede ciência SHALL ser registrada como ciência e o processo SHALL voltar à vigília, sem itens.

#### Scenario: CA9 · Ciência
- **Dado** uma publicação do juízo que só pede ciência
- **Quando** a advogada analisa (`D3a.02`)
- **Então** registra a ciência e o processo volta à vigília, sem criar itens

### Requirement: CA10 · Prazo interno dentro do processual
Definido o responsável, o item SHALL ter a descrição do que cumprir e um prazo interno que MUST NOT passar do prazo processual.

#### Scenario: CA10 · Definir o responsável
- **Dado** cada item confirmado
- **Quando** defino o responsável
- **Então** descrevo o que cumprir e um prazo interno que não passa do prazo processual (proposta)

### Requirement: CA11 · Perícia do juízo
O item do juízo que pede perícia SHALL abrir a tarefa de perícia com a origem no D3a.

#### Scenario: CA11 · Item de perícia
- **Dado** um item do juízo que pede perícia
- **Quando** confirmo
- **Então** a tarefa de perícia nasce no DP com a origem D3a

### Requirement: CA12 · Perícia sem retorno bloqueia o protocolo
Com perícia pedida na exigência sem retorno, o protocolo da manifestação MUST ser bloqueado, mostrando o que falta e o prazo.

#### Scenario: CA12 · Protocolar com perícia pendente
- **Dado** uma perícia pedida na exigência que ainda não voltou do DP
- **Quando** alguém tenta protocolar a manifestação
- **Então** o portal bloqueia e mostra o que falta e o prazo

### Requirement: CA13 · Minuta com item sem prova
O bloqueio do CA3 MUST valer só para o protocolo: com itens ainda sem prova, a advogada SHALL poder anexar e aprovar a versão que escreveu. A minuta pela IA entra com o épico IA jurídica.

#### Scenario: CA13 · Pedir a minuta
- **Dado** itens ainda sem prova
- **Quando** a advogada pede a minuta à IA
- **Então** o rascunho é gerado; o bloqueio do CA3 vale só para o protocolo

### Requirement: CA14 · Status de cada setor acionado
Abrindo o caso, cada setor acionado SHALL mostrar o status (aberto ou cumprido), o responsável, a data do acionamento e a última tentativa.

#### Scenario: CA14 · Abrir o caso
- **Dado** os itens de uma exigência
- **Quando** abro o caso
- **Então** vejo, para cada setor acionado, o status (aberto ou cumprido), o responsável, a data do acionamento e a última tentativa

### Requirement: CA15 · O alerta leva ao item
O alerta de vencimento SHALL levar direto à exigência, onde está o item pendente com o histórico de tentativas.

#### Scenario: CA15 · Abrir o alerta
- **Dado** o alerta de vencimento do CA4
- **Quando** a sênior ou a advogada o abre
- **Então** vai direto ao item pendente e ao histórico de tentativas
