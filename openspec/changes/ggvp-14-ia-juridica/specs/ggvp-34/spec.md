# Spec Delta · ggvp-34

## Purpose

A parte de IA que a GGVP-34 deixou para este épico: ao ler a publicação, a IA sugere o tipo de ato e os dias de prazo escritos na decisão. A pessoa confirma ou corrige; o prazo continua contado pelo código (G12, G19).

## ADDED Requirements

### Requirement: IA · A IA sugere o tipo de ato e os dias, a pessoa classifica
Ao abrir a publicação ainda sem classe, a tela SHALL mostrar, já pronto, o tipo de ato e os dias sugeridos, marcados como sugestão da IA, com o alerta quando houver. A sugestão MUST NOT classificar a publicação: só a classificação da pessoa grava a classe, conta o prazo e encaminha. A IA só lê o número de dias escrito; a data final vem do código.

#### Scenario: IA · Sugestão de exigência com 15 dias
- **Dado** uma publicação com "Intime-se para juntar o laudo em 15 dias"
- **Quando** a advogada abre a publicação
- **Então** vê "Intimação ou exigência" e 15 dias como sugestão, a publicação continua sem classe, e o formulário já vem preenchido para ela conferir e classificar

### Requirement: IA · Resposta fora do formato não vira sugestão
Se a IA responder fora do formato esperado, ou não houver chave, a tela SHALL dizer que não há sugestão, e a pessoa classifica como antes.

#### Scenario: IA · Resposta inválida
- **Dado** uma resposta da IA que não traz o tipo de ato
- **Quando** a publicação é aberta
- **Então** a tela diz que não há sugestão e o formulário segue manual
