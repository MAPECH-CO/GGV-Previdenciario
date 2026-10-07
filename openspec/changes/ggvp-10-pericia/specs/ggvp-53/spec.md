# Spec Delta · ggvp-53 · Marcar a perícia com o cliente

## Purpose

O Jurídico administrativo marca a perícia no portal do INSS (senha no cofre, G9), tentando de novo se não der, e sobe o comprovante em PDF no card do cliente; o sistema lê data, hora, local e tipo (o perito não vem no PDF), põe a perícia na agenda e na ficha e agenda o lembrete da véspera. Respostas do Lucas de 02/10: tentativa diária; na perícia judicial, a data do juízo é lida e posta na agenda sozinha; o canal ao cliente é o Chatwoot, revisado pelo Jurídico. Passos DP.02 e DP.04 do Miro. Figma: step_DP.02 `10:374`, chat "subir comprovante do INSS" `2085:2`, Evento da agenda das perícias `2164:513`. Contrato na `design.md`, seção GGVP-53.

## ADDED Requirements

### Requirement: CA1 · A tentativa sem sucesso fica registrada e a tarefa continua
Quando não consigo marcar, a tentativa SHALL ser registrada com a data e o que aconteceu (obrigatórios), e a tarefa SHALL continuar com o Jurídico administrativo; a próxima tentativa é no dia seguinte (1 dia, Lucas 02/10).

#### Scenario: CA1 · Não consegui marcar
- **Dado** a tarefa de perícia
- **Quando** não consigo marcar
- **Então** registro a tentativa e a tarefa continua comigo; a tentativa sem sucesso pede a data e o que aconteceu (obrigatório)

### Requirement: CA2 · O comprovante é lido e a perícia entra na agenda e na ficha
Subido o comprovante do INSS (PDF), o sistema SHALL ler data, hora, local e tipo (o perito não vem no PDF), colocar a perícia na agenda e na ficha e agendar o lembrete da véspera para o cliente.

#### Scenario: CA2 · Subir o comprovante
- **Dado** a perícia marcada
- **Quando** subo o comprovante do INSS (PDF) no card do cliente
- **Então** o sistema lê data, hora, local e tipo da perícia (o perito não vem no PDF), coloca a perícia na agenda e na ficha e agenda o lembrete da véspera para o cliente

### Requirement: CA3 · Confiro antes de registrar; a IA não escolhe o perito
O que foi lido SHALL ser conferido antes de registrar; "Registrar a perícia" SHALL habilitar só com as decisões respondidas e o comprovante anexado; a IA MUST NOT escolher nem sugerir o perito.

#### Scenario: CA3 · Conferir a leitura
- **Dado** o comprovante lido
- **Quando** o sistema mostra data, hora, local e tipo
- **Então** eu confiro antes de registrar; "Registrar a perícia" só habilita com as decisões respondidas e o comprovante anexado, e a IA não escolhe nem sugere o perito

### Requirement: CA4 · "A perícia pede documento novo?" é obrigatória
Ao registrar, a pergunta "A perícia pede documento novo?" SHALL ser respondida: "Sim" atribui a tarefa à Documentação (DP.03, GGVP-56); "Não" segue sem ela.

#### Scenario: CA4 · Registrar a perícia
- **Dado** a perícia marcada
- **Quando** registro
- **Então** respondo "A perícia pede documento novo?" (obrigatório): "Sim" atribui a tarefa à Documentação (DP.03, GGVP-56); "Não" segue sem ela

### Requirement: CA5 · Pelo chat, nada acontece antes de confirmar
Subido o comprovante pelo chat, a IA SHALL ler o PDF, identificar o cliente e mostrar um card de confirmação (subir o PDF na pasta do cliente, agendar a perícia, dar baixa no DP.02); nada SHALL ser feito antes de a pessoa conferir e confirmar.

#### Scenario: CA5 · Comprovante pelo chat
- **Dado** que subo o comprovante pelo chat
- **Quando** a IA lê o PDF e identifica o cliente
- **Então** mostra um card de confirmação (subir o PDF na pasta do cliente, agendar a perícia, dar baixa no DP.02) e nada é feito antes de eu conferir e confirmar

### Requirement: CA6 · Sem comprovante ainda, a tarefa espera com prazo e lembrete
Marcada no portal sem o comprovante emitido (espera `DP.E1`), a tarefa SHALL ficar esperando, com prazo e lembrete diários, e SHALL retomar quando o comprovante sobe.

#### Scenario: CA6 · O INSS ainda não emitiu o comprovante
- **Dado** a perícia marcada no portal
- **Quando** o INSS ainda não emitiu o comprovante (espera externa `DP.E1`)
- **Então** a tarefa fica esperando, com prazo e lembrete, e retoma quando o comprovante sobe

### Requirement: CA7 · Na véspera, o cliente recebe o lembrete
Na véspera, o cliente SHALL receber data, hora, local e o que levar, pelo Chatwoot, com a mensagem revisada pelo Jurídico (Lucas 02/10, Q5).

#### Scenario: CA7 · Chegou a véspera
- **Dado** o lembrete agendado
- **Quando** chega a véspera
- **Então** o cliente recebe data, hora, local e o que levar, pelo canal definido (Q5: Chatwoot, revisado pelo Jurídico)

### Requirement: CA8 · A troca de data reprograma o lembrete e fica no histórico
Lido o novo comprovante de uma perícia remarcada ou com a data alterada, o lembrete SHALL ser reprogramado e a troca SHALL ficar registrada no histórico.

#### Scenario: CA8 · Data alterada
- **Dado** a perícia remarcada ou com a data alterada
- **Quando** o novo comprovante é lido
- **Então** o lembrete é reprogramado e a troca fica registrada no histórico

### Requirement: CA9 · Passou do limite de remarcações, sobe para a advogada responsável
Passado o limite de remarcações (parâmetro: 2), a tarefa SHALL subir para a advogada responsável, e MUST NOT subir para a sênior (G15).

#### Scenario: CA9 · Limite passado
- **Dado** uma remarcação (o cliente faltou, GGVP-66)
- **Quando** o limite de remarcações é passado
- **Então** a tarefa sobe para a advogada responsável, e não para a sênior (G15)
