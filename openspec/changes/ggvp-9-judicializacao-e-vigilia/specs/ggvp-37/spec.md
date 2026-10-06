# Spec Delta · ggvp-37

## Purpose

Encaminhar pelo tipo de ato: exigência vai para a análise da advogada (D3a), decisão de mérito vai para "Confirmar desfecho" (D3b) com o prazo do recurso, e só andamento fica registrado, sem tarefa.

## ADDED Requirements

### Requirement: CA1 · Exigência entra no D3a
Uma publicação classificada como "Intimação ou exigência" SHALL entrar no D3a.

#### Scenario: CA1 · Exigência
- **Dado** "Intimação ou exigência"
- **Quando** classificada
- **Então** entra em D3a

### Requirement: CA2 · Mérito entra no D3b
Uma publicação classificada como "Decisão de mérito" SHALL entrar no D3b.

#### Scenario: CA2 · Mérito
- **Dado** "Decisão de mérito"
- **Quando** classificada
- **Então** entra em D3b

### Requirement: CA3 · Só andamento fica registrado
Uma publicação classificada como "Só andamento" SHALL ficar registrada e MUST NOT criar tarefa.

#### Scenario: CA3 · Andamento
- **Dado** "Só andamento"
- **Quando** classificada
- **Então** fica registrada sem criar tarefa

### Requirement: CA4 · "Analisar exigência do juiz" com o prazo
A exigência encaminhada SHALL abrir para a advogada a tarefa "Analisar exigência do juiz", com o prazo contado (GGVP-34).

#### Scenario: CA4 · Encaminhar exigência
- **Dado** "Intimação ou exigência"
- **Quando** encaminhada
- **Então** nasce para a advogada a tarefa "Analisar exigência do juiz", com o prazo contado

### Requirement: CA5 · "Confirmar desfecho" com o prazo do recurso
A decisão de mérito encaminhada SHALL abrir para a advogada a tarefa "Confirmar desfecho", com o prazo do recurso já contado; nada avança no D3b sem essa confirmação (GGVP-90).

#### Scenario: CA5 · Encaminhar mérito
- **Dado** "Decisão de mérito"
- **Quando** encaminhada
- **Então** nasce para a advogada a tarefa "Confirmar desfecho", com o prazo do recurso já contado

### Requirement: CA6 · Nada vira só andamento sem pessoa
Nenhuma publicação MUST ficar só registrada sem a leitura de uma pessoa; sem IA, toda publicação casada passa pela leitura antes.

#### Scenario: CA6 · Revisão por pessoa
- **Dado** uma publicação com prazo detectado ou de leitura duvidosa
- **Quando** seria marcada como "só andamento"
- **Então** vai para revisão de pessoa antes de ficar só registrada

### Requirement: CA7 · Reclassificar refaz o encaminhamento
Reclassificar SHALL refazer o encaminhamento (cancelando a tarefa aberta pelo encaminhamento anterior, se ainda aberta) e SHALL registrar a reclassificação.

#### Scenario: CA7 · Reclassificação
- **Dado** uma reclassificação feita pela advogada
- **Quando** confirmo
- **Então** o encaminhamento é refeito e a reclassificação fica registrada
