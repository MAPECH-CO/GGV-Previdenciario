# Spec Delta · ggvp-22

## Purpose

A parte de IA da GGVP-22 (CA3, Lucas 06/10): a IA escreve um rascunho do resumo do resultado para o cliente, em linguagem simples e sem estratégia interna, e o Jurídico completa e aprova. O texto da IA fica guardado à parte do texto aprovado.

## ADDED Requirements

### Requirement: IA · A IA sugere o resumo, o Jurídico completa e aprova
"Sugerir o resumo com a IA" SHALL preencher a caixa do resumo com o rascunho da IA, marcado como sugestão. Só a aprovação do Jurídico grava o resumo, com o nome de quem aprovou; a decisão guarda a chamada da IA em `sugestao_ia`, separada do texto aprovado.

#### Scenario: IA · Rascunho do resumo
- **Dado** um caso perdido esperando o resumo
- **Quando** a advogada pede a sugestão da IA, acrescenta uma frase e aprova
- **Então** o resumo aprovado é o texto dela, com o nome dela, e a decisão guarda a chamada da IA à parte

### Requirement: IA · Sem estratégia interna nem diagnóstico
O rascunho MUST NOT trazer estratégia interna do escritório, e uma saída com código de doença é barrada (G20).

#### Scenario: IA · Saída com CID
- **Dado** uma resposta da IA com um código de doença
- **Quando** a sugestão é pedida
- **Então** a tela diz que não há sugestão, e o Jurídico escreve
