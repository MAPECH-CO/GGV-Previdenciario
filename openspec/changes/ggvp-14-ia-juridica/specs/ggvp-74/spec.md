# Spec Delta · ggvp-74

## Purpose

A parte de IA que a GGVP-74 deixou para este épico: junto com a sugestão do tipo de ato, a IA resume a publicação em linguagem simples, para a advogada ler mais rápido. O texto inteiro continua na tela.

## ADDED Requirements

### Requirement: IA · Resumo da publicação
A sugestão da IA SHALL trazer um resumo curto da publicação, marcado como sugestão, sem substituir o texto original, que continua visível.

#### Scenario: IA · Ler com o resumo
- **Dado** uma publicação casada
- **Quando** a advogada pede a sugestão da IA
- **Então** vê o resumo ao lado do texto original, marcado como sugestão
