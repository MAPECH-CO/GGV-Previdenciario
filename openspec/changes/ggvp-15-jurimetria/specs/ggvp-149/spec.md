# Spec Delta · ggvp-149

## Purpose

Gestão completa (continua a GGVP-75, nasceu da conferência da jurimetria de 09/10): a Gestão passa a mostrar o tempo
médio até a sentença, os motivos de indeferimento e de derrota mais comuns e o tempo médio até o dinheiro, e a líder de
setor vê os tempos e as taxas sem nenhum valor em dinheiro. O recorte por vara (CA1) espera a vara gravada no caso e no
acervo, que chega com os pedidos #27 (GGVP-64, parte 2) e #18 (GGVP-41), ainda abertos (Mateus, 09/10: fazer primeiro o
que não depende deles).

Quem vê: a Gestão (Sócio, Sênior, líder do Atendimento e Financeiro); os valores em dinheiro só o Sócio e o Financeiro.

## ADDED Requirements

### Requirement: CA1 · Recorte por vara
O painel SHALL ter o recorte "Vara", com deferimento e procedência por vara, cada taxa com o número de casos e a data da
base; caso sem vara MUST ficar fora do recorte. Depende da vara gravada no caso (#27) e no acervo (#18).

#### Scenario: CA1 · Escolher o recorte por vara
- **Dado** casos com a vara registrada
- **Quando** escolho o recorte "Vara"
- **Então** vejo deferimento e procedência por vara, cada taxa com o número de casos e a data da base; caso sem vara fica fora do recorte

### Requirement: CA2 · Tempo médio até a sentença
O painel SHALL mostrar o indicador "Tempo até a sentença": a média, em dias, do primeiro protocolo da petição inicial até
o encerramento do caso com decisão de mérito no período, com o número de casos, no geral e em cada grupo do recorte. Caso
sem o protocolo da inicial MUST ficar fora da conta (dado incerto, GGVP-75 CA7).

#### Scenario: CA2 · Abrir a Gestão
- **Dado** casos com a sentença
- **Quando** abro a Gestão
- **Então** vejo o tempo médio até a sentença (do protocolo da inicial à decisão de mérito), com o número de casos, no geral e por recorte

### Requirement: CA3 · Motivos de indeferimento e de derrota mais comuns
O painel SHALL mostrar, no período, os motivos de indeferimento mais comuns (o motivo que consta no sistema do INSS, na
última decisão do caso) e os de derrota (a causa registrada no caso improcedente ou extinto sem mérito), do mais comum
para o menos, até 10 de cada, cada um com o número de casos. O texto livre que a equipe escreve sobre o motivo MUST NOT
entrar, porque pode trazer dado do cliente. Sem motivo registrado, o caso entra como "sem motivo registrado" (ou "sem
causa registrada").

#### Scenario: CA3 · Abrir a Gestão
- **Dado** indeferimentos e derrotas registrados
- **Quando** abro a Gestão
- **Então** vejo os motivos de indeferimento e de derrota mais comuns, cada um com o número de casos, sem dado de cliente

### Requirement: CA4 · Tempo médio até o dinheiro
O indicador "Tempo até o dinheiro" SHALL ser a média, em dias, da abertura do caso à confirmação do recebimento no
período, com o número de casos. Por ser tempo, e não valor, ele fica entre os indicadores, no geral e por recorte, e não
nos totais em dinheiro.

#### Scenario: CA4 · Recebimentos confirmados
- **Dado** recebimentos confirmados
- **Quando** abro a Gestão
- **Então** o tempo até o dinheiro é a média em dias, com o número de casos

### Requirement: CA5 · A líder de setor sem valores
A líder de setor SHALL ver os tempos e as taxas do painel, e o servidor MUST NOT mandar a ela nenhum valor em dinheiro.

#### Scenario: CA5 · A líder abre a Gestão
- **Dado** a líder de setor
- **Quando** abre a Gestão
- **Então** vê os tempos e as taxas, mas nenhum valor em dinheiro
