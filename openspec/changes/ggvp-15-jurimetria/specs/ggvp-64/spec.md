# Spec Delta · ggvp-64

## Purpose

Juízo identificado: a advogada vê a jurimetria do juízo do processo, com a procedência por benefício, o tempo até a sentença e os entendimentos recorrentes, calculada em código a partir do acervo. A IA usa essa jurimetria nas fontes da petição e da recomendação de recurso, sem pôr número no texto que vai ao juiz.
- **Parte 1 (08/10):**
  - o juízo pelo número do processo (tribunal e unidade de origem);
  - os números do juízo no servidor;
  - a jurimetria nas fontes da minuta da petição.
- **Parte 2:**
  - o nome da vara e do juiz;
  - os entendimentos recorrentes;
  - a sobreposição da página do caso lendo do servidor;
  - a recomendação de recurso (GGVP-100).

Quem vê: o Jurídico. Os números nunca vão ao cliente nem ao Atendimento (G22).

## ADDED Requirements

### Requirement: CA1 · O juízo do processo identificado, com a jurimetria a um clique
O sistema SHALL identificar o juízo do processo distribuído. A página do processo SHALL mostrar a vara e o juiz, e o nome do juízo SHALL abrir a sobreposição de jurimetria.
- **Parte 1:** o juízo MUST ser identificado pelo número do processo (tribunal e unidade de origem), a mesma regra do painel da Gestão.
- **Parte 2:** o nome da vara e do juiz, e a sobreposição lendo do servidor.

#### Scenario: CA1 · Processo distribuído
- **Dado** o processo distribuído
- **Quando** a publicação chega
- **Então** o card mostra vara e juiz e o nome do juízo abre a sobreposição de jurimetria na página do processo

### Requirement: CA2 · Procedência, tempo médio e entendimentos do juízo
A jurimetria do juízo SHALL mostrar a procedência por benefício, o tempo médio até a sentença e os entendimentos recorrentes, com os processos de exemplo.
- A procedência MUST contar só desfecho conferido: procedentes (total ou parcial) sobre os decididos no mérito (procedentes e improcedentes).
- O tempo até a sentença MUST contar em meses, do protocolo da inicial à data da decisão, só com os processos que têm as duas datas. Os outros ficam fora da conta.
- **Parte 2:** os entendimentos recorrentes.

#### Scenario: CA2 · Sobreposição do juízo
- **Dado** a sobreposição do juízo
- **Quando** abro
- **Então** vejo procedência por benefício, tempo médio e os entendimentos recorrentes com os processos de exemplo

### Requirement: CA3 · A IA mostra nas fontes o que usou da jurimetria do juízo
Quando a IA gerar a minuta da petição ou a recomendação de recurso, a advogada SHALL ver nas fontes o que foi usado da jurimetria do juízo.
- **Parte 1:** a minuta da petição.
- **Parte 2:** a recomendação de recurso (D3b.04), com a GGVP-100.

#### Scenario: CA3 · Fontes da minuta e da recomendação
- **Dado** o pedido da petição (GGVP-63) ou a decisão de recorrer (GGVP-100)
- **Quando** a IA gera a minuta ou a recomendação
- **Então** mostra à advogada, nas fontes, o que usou da jurimetria do juízo (CA6)

### Requirement: CA4 · Toda porcentagem com o número de processos e a data da base
Toda porcentagem do juízo MUST aparecer com o número de processos ao lado e a data da base, como "58% em 12 processos · base de 08/10". Não há amostra mínima (G22, regra de 07/10).

#### Scenario: CA4 · Poucos processos
- **Dado** um juízo com poucos processos na base
- **Quando** abro
- **Então** vejo cada porcentagem com o número de processos ao lado e a data da base; não há amostra mínima (G22)

### Requirement: CA5 · Números de código; a IA só resume
Os números do juízo MUST vir de código, a partir do acervo, com a data da base. A IA SHALL só resumir o que as decisões dizem, e toda porcentagem vem com o número de processos ao lado.

#### Scenario: CA5 · Números do juízo
- **Dado** os números do juízo
- **Quando** aparecem
- **Então** vêm de código a partir do acervo, com a data da base; a IA só resume o que as decisões dizem, e toda porcentagem vem com o número de processos ao lado (G22)

### Requirement: CA6 · O número do juízo fica fora do texto que vai ao juiz
Quando a IA escrever a petição, a taxa de procedência e o tempo médio do juízo MUST NOT entrar no texto que vai ao juiz: a peça usa as decisões do juízo. Na recomendação de recurso, que é só para a advogada, o indicador SHALL entrar com o número de processos ao lado.
- **Parte 1:** o modelo não recebe os números do juízo; eles vão só às fontes da advogada.
- **Parte 2:** as decisões e os entendimentos na peça, e o indicador na recomendação de recurso.

#### Scenario: CA6 · Petição e recomendação de recurso
- **Dado** um indicador do juízo (taxa de procedência ou tempo médio)
- **Quando** a IA escreve a petição
- **Então** o número não entra no texto que vai ao juiz: a peça usa as decisões do juízo, com os entendimentos recorrentes e o número dos processos de exemplo; na recomendação de recurso (D3b.04), que é só para a advogada, o indicador entra com o número de processos ao lado (G22)
