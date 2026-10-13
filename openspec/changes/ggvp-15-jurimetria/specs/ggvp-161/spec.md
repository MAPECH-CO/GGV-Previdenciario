# Spec Delta · ggvp-161

## Purpose

"Vale recorrer?" com a chance do recurso e a avaliação da IA (continua a GGVP-151; decisão do Mateus em 13/10, o Lucas
confirma na review). A chance do recurso vem dos casos parecidos que tiveram recurso julgado, por código (G19, G22). A IA
traz pronta a avaliação do caso, bom ou ruim para recorrer e por quê: ela consulta o acervo e usa o conhecimento dela,
marcado como tal, e não dá porcentagem. Quem decide é a Sênior; a advogada responsável e o Sócio leem (`recurso.ver`).

Para haver chance, o acervo passa a guardar o resultado do recurso, conferido pela Sênior (migração nova).

## ADDED Requirements

### Requirement: CA1 · O acervo guarda o resultado do recurso
Ao conferir o desfecho de um processo do acervo, a Sênior SHALL poder informar o resultado do recurso: provido, provido em
parte ou não provido; sem recurso julgado, fica vazio. O acervo SHALL guardar o resultado conferido, e o histórico, o de
antes e o de depois.

#### Scenario: CA1 · Recurso julgado
- **Dado** um recurso julgado num caso do acervo
- **Quando** a decisão é conferida por pessoa
- **Então** o acervo guarda o resultado do recurso (provido, provido em parte ou não provido)

### Requirement: CA2 · A chance do recurso por código
A tarefa "Vale recorrer?" SHALL mostrar a chance do recurso: os casos do acervo com desfecho conferido, do mesmo benefício
e com o resultado do recurso guardado; favoráveis (provido e provido em parte) sobre o total, com o número de casos e a
data da base (G22, sem amostra mínima). Sem nenhum caso, "sem dados ainda".

#### Scenario: CA2 · Abrir a tarefa
- **Dado** a tarefa "Vale recorrer?"
- **Quando** abre
- **Então** mostra a chance do recurso calculada por código pelos casos parecidos (mesmo benefício) que tiveram recurso julgado, com o número de casos e a data da base; sem nenhum, "sem dados ainda"

### Requirement: CA3 · A avaliação da IA, pronta e sem porcentagem
A tarefa SHALL trazer a avaliação da IA, preparada em segundo plano (sugestão pronta): bom ou ruim para recorrer e por quê,
com as fontes do acervo usadas, e o que vem do conhecimento da IA marcado como tal. O texto da IA MUST NOT trazer
porcentagem: a resposta com porcentagem é recusada e a tela mostra o motivo.

#### Scenario: CA3 · A avaliação chega pronta
- **Dado** a tarefa
- **Quando** abre
- **Então** a IA já traz a avaliação do caso (bom ou ruim para recorrer e por quê), com as fontes do acervo que usou e o que vem do conhecimento dela marcado como tal; sem porcentagem no texto da IA

### Requirement: CA4 · O histórico da decisão
Ao decidir, o histórico SHALL guardar a chance mostrada (porcentagem, casos, data da base e os casos usados), a chamada da
avaliação da IA e a decisão.

#### Scenario: CA4 · A Sênior decide
- **Dado** a avaliação e a chance
- **Quando** a Sênior decide
- **Então** o histórico guarda a chance, os casos usados, a avaliação da IA e a decisão

### Requirement: CA5 · O Atendimento não vê
O Atendimento MUST NOT abrir a tarefa nem receber a chance ou a avaliação (`recurso.ver`: advogada, Sênior e Sócio).

#### Scenario: CA5 · Atendimento
- **Dado** o Atendimento
- **Quando** abre a tarefa
- **Então** não vê a chance nem a avaliação
