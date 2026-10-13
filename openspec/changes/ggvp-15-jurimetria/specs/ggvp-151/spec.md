# Spec Delta · ggvp-151

## Purpose

A chance de êxito nos outros pontos de decisão (continua a GGVP-131, depois da GGVP-150): na entrevista, ao definir o
benefício; na recomendação da perícia; e na tela da petição, sempre fora do texto que vai ao juiz. O número é o mesmo da
conferência (código com teste, G19), com os casos, a data da base e a cor (G22). Veem a advogada, a Sênior e o Sócio
(`chance.ver`).

**Travado (CA3):** a chance do "Vale recorrer?" mede outra coisa (o recurso ser provido) e o acervo ainda não guarda o
resultado dos recursos. A pergunta está no cartão para o Lucas (09/10). Até a resposta, a rota do recurso segue com
`chance: null`.

## ADDED Requirements

### Requirement: CA1 · Na entrevista, ao definir o benefício
Na definição do benefício, a tela SHALL mostrar a chance do servidor para o benefício escolhido, com a cor, os casos
parecidos e o que falta saber. Ainda não há caso nessa hora, então a conta é pelo benefício (`GET /api/chance?beneficio=`),
e o perito, o juízo e o parecer médico aparecem no que falta saber.

#### Scenario: CA1 · Definir o benefício
- **Dado** a entrevista
- **Quando** a advogada define o benefício
- **Então** vê a chance do servidor, com a cor, os casos parecidos e o que falta saber

### Requirement: CA2 · Na recomendação da perícia
Ao abrir a recomendação da IA antes de marcar a perícia, a tela SHALL mostrar a chance do caso, com os casos e a data da
base.

#### Scenario: CA2 · Abrir a recomendação
- **Dado** a recomendação da IA antes de marcar a perícia
- **Quando** abre
- **Então** mostra a chance do caso, com os casos e a data da base

### Requirement: CA3 · No "Vale recorrer?"
A tarefa "Vale recorrer?" SHALL trazer a chance do servidor no lugar de `null`, depois da resposta do Lucas sobre de onde
ela vem.

#### Scenario: CA3 · Abrir a tarefa
- **Dado** a tarefa "Vale recorrer?"
- **Quando** abre
- **Então** a chance vem do servidor no lugar de `null`

### Requirement: CA4 · Na petição, só na tela
A tela da petição SHALL mostrar a chance do caso à advogada, separada da minuta; nenhum número da chance MUST entrar no
texto que vai ao juiz.

#### Scenario: CA4 · Abrir a petição
- **Dado** a petição
- **Quando** a advogada abre
- **Então** vê a chance só na tela; nenhum número entra no texto que vai ao juiz

### Requirement: CA5 · O Atendimento não vê
O Atendimento MUST NOT ver a chance em nenhum desses pontos, nem pela tela nem pela API.

#### Scenario: CA5 · Atendimento
- **Dado** o Atendimento
- **Quando** abre qualquer um desses pontos
- **Então** não vê a chance
