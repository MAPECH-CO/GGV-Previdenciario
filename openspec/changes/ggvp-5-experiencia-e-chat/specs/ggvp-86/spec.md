# Spec Delta · ggvp-86 · Navegar pelo caso numa linha só

## Purpose

A pessoa do Jurídico ou do Atendimento vê o caso como uma linha do tempo das etapas (entrevista, INSS, Justiça, vigília, desfecho), com o passo atual destacado, para entender em segundos onde o caso está e o que está travando. Transversal, D1 a D3b. Figma: Advogada · Processo do cliente (completo) `72:2`, tema escuro `72:287`, fonte grande `72:572`, variantes `1578:2`, `1579:117`, `1581:2`, `1581:418`, `1582:2`, `1582:421`, `2179:2`, `2179:333`, `2179:664`; Histórico `59:11`; ficha `73:2` e `73:199`; jurimetria `2184:2` a `2184:183`. Contrato na `design.md`, seção GGVP-86.

## ADDED Requirements

### Requirement: CA1 · As etapas em sequência
A página do processo SHALL mostrar as etapas D1, D2, D3, D3a e D3b em sequência, com a atual destacada e as que não se aplicam apagadas.

#### Scenario: CA1 · Abrir o caso
- **Dado** um caso em qualquer etapa
- **Quando** abro o caso
- **Então** vejo as etapas D1, D2, D3, D3a e D3b em sequência, com a atual destacada e as que não se aplicam apagadas

### Requirement: CA2 · "Em perícia" ligado à etapa que pediu
Com perícia em andamento, o caso SHALL mostrar o bloco "Em perícia" ligado à etapa que pediu, como no BPMN.

#### Scenario: CA2 · Caso com perícia
- **Dado** um caso com perícia em andamento
- **Quando** abro o caso
- **Então** vejo o bloco "Em perícia" ligado à etapa que pediu

### Requirement: CA3 · Setores que ainda não subiram o card
Parado esperando setores, o caso SHALL mostrar quais setores ainda não subiram o card.

#### Scenario: CA3 · Caso esperando setores
- **Dado** um caso parado esperando setores
- **Quando** abro o caso
- **Então** vejo quais setores ainda não subiram o card

### Requirement: CA4 · O passo concluído
Clicar num passo concluído SHALL mostrar quem fez, quando e os documentos daquele passo.

#### Scenario: CA4 · Clicar no passo
- **Dado** um passo concluído
- **Quando** clico nele
- **Então** vejo quem fez, quando e os documentos daquele passo

### Requirement: CA5 · Laudo novo no processo e na ficha
Com laudo novo não conferido, o cabeçalho do processo e a ficha do cliente SHALL mostrar "Laudo novo" com a data, e o aviso SHALL levar à análise do laudo.

#### Scenario: CA5 · Laudo novo
- **Dado** um laudo novo ainda não conferido
- **Quando** abro o caso
- **Então** o cabeçalho do processo e a ficha mostram "Laudo novo" com a data, e o aviso leva à análise do laudo

### Requirement: CA6 · Jurimetria numa sobreposição
Clicar no nome do perito ou do juízo SHALL abrir a jurimetria dele numa sobreposição, sem sair do caso, com os números do sistema e o número de casos ao lado, sem amostra mínima.

#### Scenario: CA6 · Clicar no perito ou no juízo
- **Dado** um caso com perito ou juízo identificado
- **Quando** clico no nome
- **Então** a jurimetria abre numa sobreposição, sem sair do caso

### Requirement: CA7 · Perito não reconhecido
Com um perito que o sistema não reconhece, o caso SHALL mostrar uma pergunta de um clique para identificá-lo, e nada SHALL travar.

#### Scenario: CA7 · Perito desconhecido
- **Dado** um perito que o sistema não reconhece
- **Quando** abro o caso
- **Então** aparece uma pergunta de um clique para identificá-lo, e nada trava

### Requirement: CA8 · Esperando alguém de fora
Esperando cliente, INSS, perito ou Justiça, o caso SHALL mostrar quem, desde quando e o prazo ou o lembrete.

#### Scenario: CA8 · Espera de fora
- **Dado** um caso esperando alguém de fora do escritório
- **Quando** abro o caso
- **Então** vejo quem estamos esperando, desde quando e o prazo ou o lembrete

### Requirement: CA9 · Tarefas por setor
O caso SHALL mostrar as tarefas em andamento por setor, inclusive as paralelas, e as perícias abertas, cada uma com responsável e prazo.

#### Scenario: CA9 · Trabalho em vários setores
- **Dado** um caso com trabalho em vários setores
- **Quando** abro o caso
- **Então** vejo as tarefas por setor, inclusive as paralelas, e as perícias abertas, com responsável e prazo

### Requirement: CA10 · Linha do processo
Cada evento da linha SHALL trazer data, quem fez (pessoa, sistema ou IA), a descrição e o passo do BPMN, em ordem cronológica.

#### Scenario: CA10 · Abrir a linha
- **Dado** a linha do processo
- **Quando** abro
- **Então** cada evento traz data, quem fez, a descrição e o passo, em ordem

### Requirement: CA11 · Origem e data do documento
Um documento aberto a partir do caso SHALL mostrar a origem e a data.

#### Scenario: CA11 · Abrir o documento
- **Dado** um documento do caso
- **Quando** o abro a partir do caso
- **Então** vejo a origem e a data

### Requirement: CA12 · Só os prazos da fase
O caso SHALL mostrar só os prazos da fase: a vigília do Meu INSS na administrativa e a das publicações só com processo judicial.

#### Scenario: CA12 · Prazos da fase
- **Dado** a fase do caso
- **Quando** abro
- **Então** só aparecem os prazos daquela fase

### Requirement: CA13 · Identificação pela fase
O caso SHALL ser identificado pelo NB ou protocolo na fase administrativa e pelo número CNJ quando há processo judicial.

#### Scenario: CA13 · Identificação
- **Dado** a fase do caso
- **Quando** abro
- **Então** o caso é identificado pelo NB ou protocolo, ou pelo CNJ com processo judicial

### Requirement: Permissão · Atendimento sem petição, estratégia, valores nem laudo
O Atendimento SHALL ver o caso sem petição, estratégia, valores nem o conteúdo dos laudos; dado de saúde SHALL ser só do Jurídico; valores SHALL seguir `podeVerValor`.

#### Scenario: Permissão · Atendimento abre o caso
- **Dado** a pessoa do Atendimento
- **Quando** abre o caso
- **Então** não vê petição, estratégia, valores nem o conteúdo dos laudos
