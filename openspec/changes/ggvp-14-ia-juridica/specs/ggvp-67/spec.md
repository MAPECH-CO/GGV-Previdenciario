# Spec Delta · ggvp-67

## Purpose

A parte de IA da GGVP-67 (Mateus, 07/10, item 3 da análise do BPMN com as histórias): na conferência, "Não está boa" pede outra versão à IA com o que mudar. A IA reescreve a última versão aplicando só o pedido; o texto cai na caixa da nova versão para a advogada revisar, e só o "Salvar nova versão" grava a versão seguinte, numerada, com as anteriores guardadas e a marca "versão da IA". A aprovação continua da advogada (G6), e a versão nova volta para a conferência, também depois de aprovada (CA7).

## ADDED Requirements

### Requirement: CA1, CA5 · "Não está boa": a IA faz outra versão com o que mudar
`POST /api/casos/:id/peticao/versoes/sugestao` SHALL exigir "O que mudar" e devolver, como sugestão, a última versão reescrita pela IA com só o que foi pedido. A rota MUST NOT gravar versão; só quem aprova a petição pode pedir, e não depois do protocolo.

#### Scenario: CA1 · Pedir outra versão à IA
- **Dado** a versão 1 em conferência
- **Quando** a advogada escreve "incluir o pedido de tutela" e pede outra versão à IA
- **Então** a IA recebe a versão 1 e o pedido, e a caixa da nova versão vem preenchida, sem versão gravada

#### Scenario: CA5 · "O que mudar" vazio
- **Dado** a conferência
- **Quando** a advogada pede outra versão à IA sem escrever o que mudar
- **Então** a tela e o servidor recusam com "Escreva o que mudar"

### Requirement: CA1, CA10 · A versão da IA sai numerada e marcada, as anteriores ficam
Salvar a nova versão com a chamada da IA SHALL gravar a versão seguinte com "<nome> · versão da IA" em quem gerou e o pedido em "o que mudou"; as anteriores ficam guardadas e a nova vai para a conferência.

#### Scenario: CA1 · Salvar a versão da IA
- **Dado** a sugestão da IA na caixa
- **Quando** a advogada revisa e salva
- **Então** nasce a versão 2, "Gabi · versão da IA", e a versão 1 continua guardada
