# Spec Delta · ggvp-20 · Parecer de suficiência da documentação médica

## Purpose

A advogada responsável recebe da IA uma matriz que cruza cada item obrigatório do roteiro do benefício (GGVP-93) com os documentos médicos do cliente, dizendo se está presente, ausente ou contraditório, com o trecho de onde tirou, para saber antes do INSS ou do juiz se a prova médica sustenta o pedido. A IA sugere; a advogada confere item a item e registra (G17). Contradição bloqueia (G18). O pedido de complemento não sugere diagnóstico, CID, grau nem conclusão (G20). Dado de saúde: o parecer completo só para o Jurídico; Atendimento e Documentação veem o resultado, os documentos e o que falta pedir. Passo D1.21M do Miro (subfluxo do laudo novo, que cobre todo documento médico que entra, resposta do Lucas de 01/10). Figma: step_D1.21M `14:195`, Laudo novo · resumo e comparação da IA `2087:2`, Overlay · Parecer médico `1654:2`, Central · Advogada `59:449`. Respostas do Lucas de 01/10: o laudo novo diz o que cobre a mais e o que ainda falta; a conferência mostra os itens cumpridos; a contradição já pede os complementares. Q15 fechada na GGVP-33: o roteiro vale igual nas duas vias. Contrato na `design.md`, seção GGVP-20.

## ADDED Requirements

### Requirement: CA1 · A matriz item a item, com o documento, a página e o trecho
Para um caso de benefício da matriz com documentos médicos classificados, a análise SHALL mostrar cada item obrigatório com o status presente, ausente ou contraditório e, quando presente, o documento, a página e o trecho.

#### Scenario: CA1 · A análise roda
- **Dado** um caso de benefício da matriz de `docs/requisitos/roteiro-laudos.md` com documentos médicos classificados
- **Quando** a análise roda
- **Então** vejo cada item obrigatório com o status presente, ausente ou contraditório e, quando presente, o documento, a página e o trecho

### Requirement: CA2 · Contradição deixa o parecer "Contraditório" e o caso não avança (G18)
Com um item contraditório, o parecer SHALL ficar "Contraditório", e o caso MUST NOT avançar.

#### Scenario: CA2 · Item contraditório
- **Dado** um item contraditório (por exemplo, "incapacidade total" num pedido de Aposentadoria PCD)
- **Quando** a análise termina
- **Então** o parecer fica "Contraditório" e o caso não avança (G18)

### Requirement: CA3 · A advogada confirma ou corrige item a item; a IA nunca aprova
O parecer SHALL passar a "Suficiente" ou "Insuficiente" só com a conferência item a item da advogada, com o nome dela e a data. A sugestão da IA, sozinha, MUST NOT aprovar.

#### Scenario: CA3 · Registrar o parecer
- **Dado** o parecer
- **Quando** eu confirmo ou corrijo item a item
- **Então** o parecer passa a "Suficiente" ou "Insuficiente" com o meu nome e a data; a IA sozinha nunca aprova

### Requirement: CA4 · Documento novo refaz a análise e mostra o que mudou
Classificado um documento novo depois do parecer, a análise SHALL rodar de novo e mostrar o que mudou.

#### Scenario: CA4 · Documento depois do parecer
- **Dado** um documento novo que chega depois do parecer
- **Quando** é classificado
- **Então** a análise roda de novo e mostra o que mudou

### Requirement: CA5 · "Insuficiente" abre a pendência de complemento
Confirmado o "Insuficiente", SHALL nascer a pendência para pedir o complemento (GGVP-29).

#### Scenario: CA5 · Confirmar Insuficiente
- **Dado** "Insuficiente"
- **Quando** confirmo
- **Então** nasce a pendência para pedir o complemento (GGVP-29)

### Requirement: CA6 · Laudo novo: resumo, comparação e "Laudo novo" até a conferência
Para o laudo novo que o Atendimento sobe no card, a advogada SHALL ver o resumo e a comparação da IA, confirmar o laudo e manter ou refazer o parecer. Até a conferência dela, a ficha do cliente e o processo SHALL mostrar "Laudo novo".

#### Scenario: CA6 · Laudo novo
- **Dado** um laudo novo que o Atendimento sobe no card do cliente (`D1.02`)
- **Quando** a IA lê, compara com o que já está no processo e resume (`D1.21M`)
- **Então** eu vejo o resumo e a comparação, confirmo o laudo e mantenho ou refaço o parecer; até a minha conferência, a ficha do cliente e o processo mostram "Laudo novo"

### Requirement: CA7 · A IA só compara o que está nos documentos
O resumo e a comparação MUST conter só o que está nos documentos, sem sugerir CID, grau nem conclusão; o parecer só muda com a confirmação da advogada.

#### Scenario: CA7 · Resumo e comparação
- **Dado** o resumo e a comparação do laudo novo
- **Quando** a IA os monta
- **Então** ela só compara o que está nos documentos e não sugere CID, grau nem conclusão; o parecer só muda com a minha confirmação

### Requirement: CA8 · "Insuficiente" exige o que o documento deve abordar (G20)
Marcado "Insuficiente — pedir complemento", o portal MUST exigir o campo "o que o documento deve abordar", sem diagnóstico, CID, grau nem conclusão (G20), e "Registrar parecer" SHALL habilitar só com a decisão e esse campo preenchidos.

#### Scenario: CA8 · Registrar o Insuficiente
- **Dado** que marco "Insuficiente — pedir complemento"
- **Quando** vou registrar o parecer
- **Então** o portal exige o campo "o que o documento deve abordar", sem diagnóstico, CID, grau nem conclusão (G20), e "Registrar parecer" só habilita com a decisão e esse campo preenchidos
