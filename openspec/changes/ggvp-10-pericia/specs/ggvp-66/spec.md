# Spec Delta · ggvp-66 · Comparecimento e remarcação

## Purpose

O Jurídico administrativo registra se o cliente compareceu e, se não, remarca, para não prejudicar o pedido por falta sem justificativa. Remarcação tem limite (G15): passou dele, sobe para a advogada responsável, nunca para a sênior (Lucas, 29/09). Resposta do Lucas de 02/10 (Q1): intervalo de 1 dia, pela importância da demanda. O número de remarcações segue o parâmetro da GGVP-53 (2). Passo DP.07 do Miro. Figma: step_DP.07 `1818:289`, step_DP.06 `10:405`, Evento da agenda das perícias `2164:513`. Contrato na `design.md`, seção GGVP-66.

## ADDED Requirements

### Requirement: CA1 · Passado o dia, é preciso marcar compareceu ou não
Passado o dia (e a hora) da perícia, a tarefa SHALL pedir "compareceu" ou "não compareceu".

#### Scenario: CA1 · Abrir a tarefa depois da perícia
- **Dado** o dia da perícia passado
- **Quando** abro a tarefa
- **Então** preciso marcar "compareceu" ou "não compareceu"

### Requirement: CA2 · Não compareceu volta para marcar e conta no limite
"Não compareceu" SHALL devolver a tarefa para marcar de novo, contando no limite. Títulos: "<nome> · Registrar comparecimento"; "<nome> · Remarcar perícia".

#### Scenario: CA2 · Faltou
- **Dado** "não compareceu"
- **Quando** marco
- **Então** a tarefa volta para marcar de novo e a remarcação conta no limite

### Requirement: CA3 · No limite, sobe para a advogada responsável (G15)
Atingido o limite de remarcações, a tarefa SHALL subir para a advogada responsável, e MUST NOT subir para a sênior.

#### Scenario: CA3 · Limite atingido
- **Dado** o limite de remarcações atingido
- **Quando** a última falha
- **Então** a tarefa sobe para a advogada responsável (G15), e não para a sênior

### Requirement: CA4 · A justificativa, se houver
Ao registrar "compareceu" ou "não compareceu", SHALL ser possível informar a justificativa, se houver.

#### Scenario: CA4 · Registrar com justificativa
- **Dado** "compareceu" ou "não compareceu"
- **Quando** registro
- **Então** informo também a justificativa, se houver

### Requirement: CA5 · Compareceu: espera o resultado com a advogada
"Compareceu" SHALL deixar o caso esperando a perícia e o resultado (esperas `DP.E3` e `DP.E4`), e a advogada responsável SHALL ficar com o acompanhamento do resultado no GERID ou no processo (GGVP-70).

#### Scenario: CA5 · Compareceu
- **Dado** "compareceu"
- **Quando** registro
- **Então** o caso passa a esperar a perícia e o resultado, e a advogada responsável fica com o acompanhamento do resultado

### Requirement: CA6 · Dia seguinte sem registro: alerta
No dia seguinte à perícia sem registro de comparecimento, o Jurídico administrativo SHALL receber um alerta.

#### Scenario: CA6 · Sem registro
- **Dado** o dia seguinte à perícia sem registro de comparecimento
- **Quando** o sistema confere
- **Então** o Jurídico administrativo recebe um alerta

### Requirement: CA7 · Na véspera, a confirmação de presença
Na véspera, a Central SHALL ter a confirmação de presença a fazer, e o resultado (confirmado ou não) SHALL ficar registrado.

#### Scenario: CA7 · Véspera
- **Dado** a perícia marcada para o dia seguinte
- **Quando** chega a véspera
- **Então** tenho na Central a confirmação de presença a fazer, e o resultado fica registrado

### Requirement: CA8 · Presença não confirmada até o horário: alerta
Sem a presença confirmada até o horário definido (parâmetro: 16h da véspera), SHALL vir o alerta para contatar o cliente.

#### Scenario: CA8 · Horário passou
- **Dado** a presença não confirmada até o horário definido
- **Quando** o horário passa
- **Então** recebo alerta para contatar o cliente

### Requirement: CA9 · O cliente avisa antes: remarcar na hora, com motivo
Avisado antes que o cliente não poderá ir, a remarcação SHALL ser feita na hora, com o motivo, contando no limite (G15).

#### Scenario: CA9 · Aviso antes
- **Dado** que o cliente avisa antes que não poderá ir
- **Quando** falo com ele
- **Então** remarco na hora e registro o motivo, e a remarcação conta no limite (G15)
