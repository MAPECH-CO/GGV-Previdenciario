# Spec Delta · ggvp-56 · Reunir o que a perícia pede

## Purpose

Quando o Jurídico administrativo decide que a perícia pede documento novo, a Documentação recebe a lista do que levar (laudos e exames na médica; CadÚnico, grupo familiar e declarações na social), para o cliente chegar à perícia com tudo. Respostas do Lucas de 02/10: quem cobra é a Documentação; o limite é 10 dias antes da perícia, porque 3 dias antes começa a preparação do cliente; os kits são os documentos prontos por tipo, e as declarações valem para a avaliação social. Passo DP.03 do Miro. Figma: step_DP.03 `10:522`, step_DP.03b · Cobrar documento da perícia `10:239`, Central · Atendimento `11:2`. Contrato na `design.md`, seção GGVP-56.

## ADDED Requirements

### Requirement: CA1 · Perícia médica: a lista de laudos e exames
Na perícia médica, atribuída a tarefa à Documentação, ela SHALL receber a lista de laudos e exames do caso.

#### Scenario: CA1 · Perícia médica com documento novo
- **Dado** perícia médica
- **Quando** o Jurídico administrativo decide que ela pede documento novo e atribui a tarefa à Documentação
- **Então** recebo a lista de laudos e exames do caso

### Requirement: CA2 · Avaliação social: CadÚnico e grupo familiar
Na avaliação social, atribuída a tarefa à Documentação, ela SHALL receber o CadÚnico e o grupo familiar (com as declarações do kit social).

#### Scenario: CA2 · Avaliação social com documento novo
- **Dado** avaliação social
- **Quando** o Jurídico administrativo decide que ela pede documento novo e atribui a tarefa à Documentação
- **Então** recebo CadÚnico e grupo familiar

### Requirement: CA3 · "Não" não abre a tarefa da Documentação
Respondido "Não", a tarefa da Documentação MUST NOT nascer.

#### Scenario: CA3 · Não pede documento novo
- **Dado** perícia que não pede documento novo
- **Quando** o Jurídico administrativo responde "Não"
- **Então** a tarefa da Documentação não nasce

### Requirement: CA4 · O papel segue a digitalização e a leitura do D1
O documento que chega em papel SHALL seguir o mesmo fluxo de digitalização e leitura da IA do D1, e a Documentação SHALL conferir a leitura.

#### Scenario: CA4 · Documento em papel
- **Dado** documento que chega em papel
- **Quando** recebo
- **Então** ele segue o mesmo fluxo de digitalização e leitura da IA do D1, e eu confiro a leitura

### Requirement: CA5 · "Concluir" só com tudo anexado ou justificado e as conferências
"Concluir" SHALL habilitar só com todos os itens do tipo anexados, ou com o item que falta registrado com justificativa, e com as conferências marcadas.

#### Scenario: CA5 · Concluir a lista
- **Dado** a lista da perícia
- **Quando** vou concluir
- **Então** "Concluir" só habilita com todos os itens do tipo anexados, ou com o item que falta registrado com justificativa, e com as conferências marcadas

### Requirement: CA6 · Concluída, fica quem e quando, e volta ao Jurídico administrativo
Concluída a lista, SHALL ficar registrado quem concluiu e quando, e o fluxo SHALL voltar ao Jurídico administrativo (o comprovante do INSS, se ainda falta, ou a orientação ao cliente).

#### Scenario: CA6 · Lista reunida
- **Dado** a lista reunida
- **Quando** concluo
- **Então** ficam registrados quem concluiu e quando, e o fluxo volta ao Jurídico administrativo, que sobe o comprovante do INSS (DP.02)

### Requirement: CA7 · O pedido ao médico não sugere diagnóstico (G20)
O pedido ao médico SHALL listar o que o documento deve abordar, e MUST NOT sugerir diagnóstico, CID, grau, conclusão nem frase pronta (G20).

#### Scenario: CA7 · Falta um laudo
- **Dado** que falta um laudo e é preciso pedir ao médico
- **Quando** a Documentação pede
- **Então** o pedido lista o que o documento deve abordar, sem sugerir diagnóstico, CID, grau, conclusão nem frase pronta (G20)

### Requirement: Resposta do PO · A cobrança é diária, pela Documentação, até 10 dias antes
A cobrança do que falta SHALL ser da Documentação, uma vez por dia, até 10 dias antes da perícia; passado esse limite, SHALL subir para a advogada responsável (G15, por ser perícia).

#### Scenario: Resposta do PO · Falta documento perto da perícia
- **Dado** um item da perícia faltando
- **Quando** chega o 10º dia antes da perícia sem ele
- **Então** a cobrança sobe para a advogada responsável
