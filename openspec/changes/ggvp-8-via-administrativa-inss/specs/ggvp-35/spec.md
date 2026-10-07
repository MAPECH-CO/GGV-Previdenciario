# Spec Delta · ggvp-35

## Purpose

Vigiar o Meu INSS todo dia: a vigília é manual (o INSS não tem API, Q6); o Jurídico tem na fila a tarefa de trazer a resposta do INSS e registra a decisão ou a exigência, que abre o passo seguinte.

## ADDED Requirements

### Requirement: CA1 · A junção abre "Trazer a resposta do INSS"
Com a junção "protocolo feito e perícia resolvida (ou sem perícia)" completa, a tarefa "Trazer a resposta do INSS" SHALL entrar na fila do Jurídico e ficar lá até alguém registrar a decisão ou a exigência.

#### Scenario: CA1 · Junção fecha
- **Dado** a junção completa
- **Quando** ela fecha
- **Então** a tarefa "Trazer a resposta do INSS" entra na fila do Jurídico e fica lá até alguém registrar a decisão ou a exigência

### Requirement: CA2 · Sem resposta, nada a registrar
Sem resposta do INSS, a tarefa SHALL continuar na fila sem exigir registro.

#### Scenario: CA2 · INSS ainda não respondeu
- **Dado** que o INSS ainda não respondeu
- **Quando** confiro o Meu INSS
- **Então** não preciso registrar nada e a tarefa continua na fila

### Requirement: CA3 · Registrar "Decisão" ou "Exigência" com o texto
O registro SHALL pedir a escolha entre "Decisão" e "Exigência" e o texto da comunicação do INSS.

#### Scenario: CA3 · Registrar a resposta
- **Dado** a resposta do INSS no Meu INSS
- **Quando** registro na tarefa
- **Então** escolho "Decisão" ou "Exigência" e colo o texto da comunicação

### Requirement: CA4 · Alarme de falha (removido)
O portal MUST NOT disparar alarme automático de falha da vigília: ela é manual (Q6; critério removido do cartão em 01/10/2026).

#### Scenario: CA4 · Removido
- **Dado** a vigília manual
- **Quando** o dia passa
- **Então** não há alarme automático

### Requirement: CA5 · Decisão com a comunicação anexada; deferido ou indeferido
Registrar a decisão MUST exigir a comunicação do INSS anexada e "Deferido" ou "Indeferido": deferido abre a prestação de contas (GGVP-44); indeferido abre a Justiça com a carta anexada (GGVP-48). Deferido diferente do pedido (outro benefício ou outra data de início) SHALL virar tarefa para a advogada analisar antes da prestação (resposta do revisor de 05/10).

#### Scenario: CA5 · Decisão encontrada
- **Dado** uma decisão encontrada
- **Quando** registro
- **Então** anexo a comunicação e informo "Deferido" ou "Indeferido", e o passo seguinte abre

### Requirement: CA6 · Exigência com texto e data obrigatórios
Registrar a exigência MUST exigir o texto e a data, e SHALL abrir o tratamento da exigência; o prazo é calculado pelo código da GGVP-34, pelo lado seguro (G12), e fica "a calcular" enquanto esse código não existir.

#### Scenario: CA6 · Exigência encontrada
- **Dado** uma exigência encontrada
- **Quando** registro
- **Então** o texto e a data são obrigatórios e abrem o tratamento da exigência

### Requirement: CA7 · O caso mostra o que espera e desde quando
O caso SHALL mostrar que espera o INSS decidir, ou analisar a resposta a uma exigência, e desde quando.

#### Scenario: CA7 · Caso em vigília
- **Dado** um caso em vigília
- **Quando** abro o caso
- **Então** vejo o que ele espera do INSS e desde quando

### Requirement: CA8 · Exigência em andamento continua vigiada
Com uma exigência em andamento, o caso SHALL continuar sendo vigiado e aceitar novos registros.

#### Scenario: CA8 · Vigília durante a exigência
- **Dado** uma exigência em andamento
- **Quando** a vigília do dia roda
- **Então** o caso continua sendo vigiado e novas novidades são registradas normalmente

### Requirement: CA9 · Alerta de dia sem registro (removido)
O portal MUST NOT disparar alerta automático por dia sem registro: a vigília é manual (Q6; critério removido do cartão em 01/10/2026).

#### Scenario: CA9 · Removido
- **Dado** um caso em vigília
- **Quando** passa um dia sem registro
- **Então** não há alerta automático

### Requirement: CA10 · Quem registrou e quando
Todo registro da vigília SHALL ficar no histórico com quem registrou e quando.

#### Scenario: CA10 · Registro salvo
- **Dado** qualquer registro da vigília
- **Quando** é salvo
- **Então** o histórico guarda quem registrou e quando
