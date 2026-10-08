# Spec Delta · ggvp-58

## Purpose

Laços dos setores até subir o card: o Atendimento e a Documentação cumprem o que a Sênior despachou, registram as tentativas com limite (G15) e sobem a prova no card; passou do limite, ou o setor sabe que não vai conseguir, a tarefa sobe para a Sênior e continua com o setor. Antes da ação não há prazo processual. Respostas do revisor de 06/10: os limites vêm da configuração do escritório; a perícia é do Jurídico administrativo, e as remarcações, do épico Perícia.

## ADDED Requirements

### Requirement: CA1 · O Atendimento registra a informação e dá OK
A tarefa do Atendimento SHALL subir com a informação conseguida com o cliente, registrada no card.

#### Scenario: CA1 · Informação do cliente
- **Dado** uma tarefa do Atendimento
- **Quando** consigo a informação com o cliente
- **Então** registro no card e dou OK

### Requirement: CA2 · A Documentação anexa o documento e dá OK
A tarefa da Documentação SHALL subir com o documento anexado no card.

#### Scenario: CA2 · Documento conseguido
- **Dado** uma tarefa da Documentação
- **Quando** consigo o documento
- **Então** anexo no card e dou OK

### Requirement: CA3 · O caso mostra quem falta
Com vários setores acionados, enquanto um não subiu o card ou a perícia não voltou do DP, o caso MUST continuar aberto, mostrando quem falta.

#### Scenario: CA3 · Setor pendente
- **Dado** vários setores acionados
- **Quando** um não subiu o card ou a perícia não voltou do DP
- **Então** o caso continua aberto mostrando quem falta

### Requirement: CA4 · No limite, sobe para a Sênior
Atingido o limite, a última tentativa sem sucesso SHALL subir a tarefa para a Sênior (a decisão dela é da GGVP-94).

#### Scenario: CA4 · Limite atingido
- **Dado** o limite atingido
- **Quando** a última tentativa falha
- **Então** a tarefa sobe para a Sênior (GGVP-94)

### Requirement: CA5 · O que foi pedido, por quem, o prazo e as tentativas
A tarefa do laço SHALL mostrar o que foi pedido, quem pediu, o prazo de entrega só quando quem pediu definiu um, e o histórico de tentativas; o prazo processual MUST NOT aparecer, porque antes da ação ele não existe.

#### Scenario: CA5 · Abrir a tarefa do laço
- **Dado** a tarefa do laço
- **Quando** abro
- **Então** vejo o que foi pedido, quem pediu, o prazo de entrega (só quando quem pediu definiu um) e o histórico de tentativas; o prazo processual não aparece

### Requirement: CA6 · Tentativa com data, canal e resultado
"Ainda não, registrar tentativa" SHALL gravar data, canal e resultado, e a tela SHALL mostrar "Tentativa n de <limite>", com o limite da configuração do escritório (parâmetro, Q1; G15).

#### Scenario: CA6 · Registrar tentativa
- **Dado** uma tentativa sem sucesso
- **Quando** registro "Ainda não, registrar tentativa"
- **Então** ficam data, canal e resultado, e a tela mostra "Tentativa n de <limite>" (G15)

### Requirement: CA7 · Subir no card exige a evidência
"Consegui, subir no card" MUST exigir a evidência (informação registrada ou documento anexado), e o setor SHALL aparecer como concluído na espera dos setores acionados.

#### Scenario: CA7 · Subir no card
- **Dado** "Consegui, subir no card"
- **Quando** registro
- **Então** a evidência (informação registrada ou documento anexado) é obrigatória e o setor aparece como concluído na espera dos setores acionados

### Requirement: CA8 · A espera do cliente
Enquanto espera o cliente, a espera SHALL ser uma tarefa com prazo e lembrete (espera D3.E1, proposta); quando o cliente responde ou entrega, o laço retoma.

#### Scenario: CA8 · Esperando o cliente
- **Dado** a tarefa esperando o cliente
- **Quando** o cliente responde ou entrega
- **Então** o laço retoma; enquanto espera, a espera é uma tarefa com prazo e lembrete

### Requirement: CA9 · Com a Sênior, a tarefa continua com o setor
Subida para a Sênior, a tarefa MUST continuar com o setor até a decisão; a decisão da Sênior e a volta ao setor do laço são da GGVP-94.

#### Scenario: CA9 · Tarefa com a Sênior
- **Dado** o limite atingido
- **Quando** a tarefa sobe para a Sênior
- **Então** ela continua com o setor até a decisão da Sênior (GGVP-94)

### Requirement: CA10 · A perícia é do Jurídico administrativo
A perícia despachada SHALL ficar com o Jurídico administrativo, na tarefa de marcar; o limite de remarcações e a subida para a advogada responsável são do épico Perícia (resposta do revisor de 06/10).

#### Scenario: CA10 · Perícia no DP
- **Dado** a perícia despachada
- **Quando** está no DP
- **Então** quem cuida é o Jurídico administrativo

### Requirement: CA11 · Status de cada setor
A advogada e a Sênior SHALL ver o status de cada setor acionado (aberto ou concluído).

#### Scenario: CA11 · Status dos setores
- **Dado** os setores acionados
- **Quando** a advogada ou a Sênior abrem o caso
- **Então** veem o status de cada setor (aberto ou concluído)

### Requirement: CA12 · Card subido cancela os lembretes
Concluída a tarefa, os lembretes dela MUST ser cancelados.

#### Scenario: CA12 · Card subido
- **Dado** o card subido
- **Quando** a tarefa é concluída
- **Então** os lembretes dela são cancelados

### Requirement: CA13 · Título "Cumprir pendência"
A tarefa SHALL aparecer na Central com o nome do cliente e "Cumprir pendência".

#### Scenario: CA13 · Na Central
- **Dado** a tarefa do laço
- **Quando** aparece na Central
- **Então** o título é o nome do cliente + "Cumprir pendência"
