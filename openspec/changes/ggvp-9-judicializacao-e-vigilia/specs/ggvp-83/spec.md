# Spec Delta · ggvp-83

## Purpose

Laços dos setores na exigência do juiz: cada setor (Atendimento, Jurídico, Documentação) cumpre a sua tarefa, registra as tentativas com limite (G15) e sobe a prova no card (G21); passou do limite, ou o setor sabe que não vai conseguir, a tarefa sobe para a Sênior e continua com o setor. Respostas do revisor de 06/10: o Jurídico entra entre os setores; os limites vêm da configuração do escritório.

## ADDED Requirements

### Requirement: CA1 · Só sai do laço cumprindo
O setor SHALL dar OK no card só cumprindo o item.

#### Scenario: CA1 · Cumprir
- **Dado** uma tarefa do setor
- **Quando** cumpro
- **Então** dou OK no card; só saio do laço cumprindo

### Requirement: CA2 · O resultado da perícia volta ao card
Com a perícia pedida pelo juiz, o resultado SHALL voltar ao card quando a perícia termina.

#### Scenario: CA2 · Perícia termina
- **Dado** perícia pedida pelo juiz
- **Quando** a perícia termina
- **Então** o resultado volta ao card

### Requirement: CA3 · Quem falta aparece no caso
O caso SHALL mostrar quais setores ainda não subiram o card.

#### Scenario: CA3 · Setor pendente
- **Dado** um setor que não subiu o card
- **Quando** abro o caso
- **Então** vejo quem falta

### Requirement: CA4 · A tarefa mostra pedido, quem pediu, prazos e tentativas
A tarefa do laço SHALL mostrar o pedido, quem pediu, o prazo interno, o prazo processual e as tentativas.

#### Scenario: CA4 · Abrir a tarefa
- **Dado** a tarefa do laço
- **Quando** abro
- **Então** vejo o pedido, quem pediu, o prazo interno, o prazo processual e as tentativas

### Requirement: CA5 · Tentativa registrada conta no limite
Cada tentativa sem sucesso SHALL registrar data, canal e resultado, e a tela SHALL mostrar "Tentativa n de limite" (G15; limite da configuração).

#### Scenario: CA5 · Ainda não
- **Dado** uma tentativa sem sucesso
- **Quando** registro "Ainda não, registrar tentativa"
- **Então** ficam data, canal e resultado, e a tela mostra a tentativa e o limite

### Requirement: CA6 · Concluir o item exige o documento
"Consegui, subir no card" (na tela, "Enviar documento e concluir", ajuste do Mateus de 06/10) MUST exigir o documento anexado, que SHALL virar a prova do item (G21); o setor aparece como concluído.

#### Scenario: CA6 · Consegui
- **Dado** "Consegui, subir no card"
- **Quando** registro
- **Então** a evidência é obrigatória e vira a prova do item; o setor aparece como concluído

### Requirement: CA7 · Esperando o cliente, com prazo e lembrete
Enquanto espera o cliente, a tarefa SHALL seguir com prazo e próximo lembrete (espera D3a.E2, código proposto), e o laço SHALL retomar quando o cliente responde.

#### Scenario: CA7 · Esperando o cliente
- **Dado** a tarefa esperando o cliente
- **Quando** o cliente responde ou entrega
- **Então** o laço retoma; enquanto espera, a tarefa tem prazo e lembrete

### Requirement: CA8 · No limite, sobe para a Sênior e continua com o setor
Atingido o limite, a última tentativa sem sucesso SHALL subir a tarefa para a Sênior, e a tarefa MUST continuar com o setor (a decisão da Sênior é da GGVP-94).

#### Scenario: CA8 · Limite atingido
- **Dado** o limite atingido no laço do setor
- **Quando** a última tentativa falha
- **Então** a tarefa sobe para a Sênior e continua com o setor

### Requirement: CA9 · Perícia pedida pelo juiz é do Jurídico administrativo
A perícia pedida pelo juiz SHALL abrir a tarefa de perícia para o Jurídico administrativo; o limite de remarcações e a subida para a advogada ficam no épico Perícia.

#### Scenario: CA9 · Perícia no laço
- **Dado** perícia pedida pelo juiz
- **Quando** está na perícia
- **Então** o sistema abre a tarefa, e o Jurídico administrativo cuida

### Requirement: CA10 · Status de cada setor para a advogada e a Sênior
A advogada e a Sênior SHALL ver o status de cada setor acionado (aberto ou concluído).

#### Scenario: CA10 · Setores acionados
- **Dado** os setores acionados
- **Quando** a advogada ou a Sênior abrem o caso
- **Então** veem o status de cada setor

### Requirement: CA11 · Concluída, os lembretes acabam
A tarefa concluída MUST NOT ter lembrete pendente.

#### Scenario: CA11 · Card subido
- **Dado** o card subido
- **Quando** a tarefa é concluída
- **Então** os lembretes dela são cancelados

### Requirement: CA12 · Título "Cumprir exigência do juiz"
A tarefa do laço na Central do setor SHALL ter o nome do cliente e "Cumprir exigência do juiz".

#### Scenario: CA12 · Na Central do setor
- **Dado** a tarefa do laço na Central do setor
- **Quando** aparece
- **Então** o título é o nome do cliente + "Cumprir exigência do juiz"

### Requirement: CA13 · Prazo interno com o processual ao lado
O cartão na Central do setor SHALL mostrar o prazo interno, e o prazo do processo SHALL aparecer ao lado.

#### Scenario: CA13 · Cartão
- **Dado** a tarefa do laço na Central do setor
- **Quando** aparece
- **Então** o cartão mostra o prazo interno, e o prazo do processo aparece ao lado

### Requirement: CA14 · Sobe antes do limite com o motivo
O setor que sabe que não vai conseguir SHALL poder subir para a Sênior antes do limite, com o motivo obrigatório.

#### Scenario: CA14 · Não vai conseguir
- **Dado** que o setor sabe que não vai conseguir
- **Quando** registra o motivo
- **Então** pode subir para a Sênior antes do limite de tentativas
