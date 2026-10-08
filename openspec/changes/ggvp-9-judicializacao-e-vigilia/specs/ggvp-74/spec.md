# Spec Delta · ggvp-74

## Purpose

Vigiar o processo e ler a publicação: as publicações do processo chegam sozinhas, casadas pelo CNJ; a advogada lê, classifica e o sistema encaminha. Sem IA (épico GGVP-14), não há resumo nem tarefas sugeridas, e toda publicação casada passa pela leitura dela antes de ficar só registrada (GGVP-37 CA6).

## ADDED Requirements

### Requirement: CA1 · Andamento fica no processo, fora da fila
Uma publicação lida como "só andamento" SHALL ficar registrada no processo e MUST sair da fila da advogada. Sem IA, ela entra na fila uma vez, para a leitura.

#### Scenario: CA1 · Mero andamento
- **Dado** uma publicação de mero andamento
- **Quando** chega e é lida
- **Então** fica registrada no processo e não continua na minha fila

### Requirement: CA2 · Exigência ou despacho na fila
Uma exigência ou despacho SHALL entrar na fila da advogada; o resumo e as tarefas sugeridas pela IA ficam para o épico IA.

#### Scenario: CA2 · Exigência chega
- **Dado** uma exigência ou despacho
- **Quando** chega
- **Então** entra na minha fila

### Requirement: CA3 · Mérito abre "Confirmar desfecho"
Uma decisão de mérito SHALL abrir a tarefa "Confirmar desfecho" com o prazo do recurso contado, e o caso só vai para o D3b depois da confirmação.

#### Scenario: CA3 · Decisão de mérito
- **Dado** uma decisão de mérito
- **Quando** chega e é classificada
- **Então** nasce a tarefa "Confirmar desfecho" com o prazo do recurso contado

### Requirement: CA4 · Confirmar ou reclassificar antes de agir
A leitura SHALL pedir "A classificação está certa?" ou a reclassificação; o caminho seguinte só habilita com a resposta, e o prazo mostrado é contado pelo lado seguro (G12).

#### Scenario: CA4 · Abrir a publicação
- **Dado** a publicação para ler
- **Quando** abro
- **Então** confirmo a classificação ou reclassifico; o caminho seguinte só habilita com a resposta, e o prazo foi contado pelo lado seguro

### Requirement: CA5 · Histórico do processo com classificação e prazo
O histórico do processo SHALL mostrar cada publicação lida, com a classificação e o prazo.

#### Scenario: CA5 · Histórico
- **Dado** qualquer publicação lida
- **Quando** abro o histórico do processo
- **Então** ela aparece com a classificação e o prazo

### Requirement: CA6 · Título "Ler publicação"
A tarefa na fila SHALL ter o nome do cliente e "Ler publicação".

#### Scenario: CA6 · Título
- **Dado** a publicação na minha fila
- **Quando** aparece
- **Então** o título é o nome do cliente + "Ler publicação"

### Requirement: CA7 · Lista do que ficou como "só andamento"
O processo SHALL listar as publicações classificadas como "só andamento", com a reclassificação disponível.

#### Scenario: CA7 · Revisar andamentos
- **Dado** as publicações lidas como "só andamento"
- **Quando** abro o processo
- **Então** vejo a lista delas e posso reclassificar
