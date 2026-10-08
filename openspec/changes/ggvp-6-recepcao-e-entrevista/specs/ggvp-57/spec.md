# Spec Delta · ggvp-57 · Calcular tempo e pontos sobre o CNIS

## Purpose

O advogado do setor de atendimento registra o cálculo de tempo e pontos feito sobre o CNIS, nos benefícios que exigem cálculo, para decidir se o cliente já pode se aposentar. Tela do Figma: step_D1.13 `14:159`. Passo D1.13 do Miro. Portão G19.

## ADDED Requirements

### Requirement: CA1 · Obrigatório antes do fechamento
Com um benefício da lista "com cálculo", o passo "Calcular tempo e pontos" SHALL aparecer como obrigatório antes do fechamento.

#### Scenario: CA1 · Benefício com cálculo
- **Dado** um benefício da lista "com cálculo"
- **Quando** abro o caso
- **Então** o passo aparece como obrigatório antes do fechamento

### Requirement: CA2 · Ainda não pode se aposentar
Com "ainda não pode se aposentar", o caso SHALL seguir para "Registrar o motivo" com a data prevista (GGVP-60).

#### Scenario: CA2 · Ainda não
- **Dado** o cálculo feito
- **Quando** marco "ainda não pode se aposentar"
- **Então** o caso segue para "Registrar o motivo" com a data prevista

### Requirement: CA3 · Sem cálculo, sem passo
Com um benefício sem cálculo, o passo MUST NOT aparecer.

#### Scenario: CA3 · Benefício sem cálculo
- **Dado** um benefício sem cálculo
- **Quando** abro o caso
- **Então** o passo não aparece

### Requirement: CA4 · O CNIS do caso
O passo SHALL usar o CNIS anexado ao caso e mostrar a data de extração e de onde ele veio.

#### Scenario: CA4 · Abrir o passo
- **Dado** o cálculo
- **Quando** abro o passo
- **Então** ele usa o CNIS do caso e mostra a data de extração e a origem

### Requirement: CA5 · O registro e as travas
Concluído o cálculo, SHALL ficar registrados o tempo, os pontos, a regra aplicada e quem conferiu; "Concluir" MUST habilitar só com "Já pode se aposentar?" respondida e "Conferi o cálculo com o CNIS" marcada.

#### Scenario: CA5 · Concluir
- **Dado** o cálculo feito
- **Quando** concluo
- **Então** ficam o tempo, os pontos, a regra e quem conferiu

### Requirement: CA6 · Refazer guarda o anterior
Um cálculo refeito SHALL manter a versão anterior no histórico.

#### Scenario: CA6 · Refazer
- **Dado** um cálculo refeito
- **Quando** salvo
- **Então** a versão anterior fica no histórico

### Requirement: CA7 · Nenhum número da IA
Os números do cálculo MUST NOT vir de modelo de IA (G19): são os que o advogado calculou e registrou.

#### Scenario: CA7 · Os números na tela
- **Dado** o resultado do cálculo
- **Quando** os números aparecem na tela
- **Então** nenhum vem de IA
