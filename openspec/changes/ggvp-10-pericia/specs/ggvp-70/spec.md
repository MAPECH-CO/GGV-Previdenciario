# Spec Delta · ggvp-70 · Conferir o resultado e decidir o próximo passo

## Purpose

A advogada responsável confere o resultado no GERID ou no processo e decide: favorável sobe no card e volta para quem pediu; desfavorável, pede nova perícia ou devolve. Respostas do Lucas de 02/10: no desfavorável, a IA contextualiza por que foi desfavorável e indica se vale pedir nova perícia, sempre salvo no histórico, mas quem decide é a advogada; os quesitos e a impugnação seguem como opções; as conferências da tela seguem como estão. Passos DP.08 e DP.10 do Miro. Figma: step_DP.08 `14:556`, Resultado da perícia `1579:431` e `1579:117`, chats "perícias da semana" `2107:667` e "como o perito avalia" `2186:2`, Jurimetria do perito `2184:2`. Contrato na `design.md`, seção GGVP-70.

## ADDED Requirements

### Requirement: CA1 · O resultado no GERID ou no processo vira a tarefa da advogada
Com a perícia feita, a advogada SHALL receber a tarefa "<nome> · Conferir resultado da perícia", que fica urgente quando o resultado aparece no GERID ou no processo (espera `DP.E4`).

#### Scenario: CA1 · Resultado disponível
- **Dado** a perícia feita
- **Quando** o resultado aparece no GERID ou no processo
- **Então** recebo a tarefa **nome do cliente** · Conferir resultado da perícia

### Requirement: CA2 · Favorável sobe no card e volta à origem
Registrado "favorável", o resultado SHALL subir no card e o caso SHALL voltar ao diagrama de origem.

#### Scenario: CA2 · Favorável
- **Dado** "favorável"
- **Quando** registro
- **Então** o resultado sobe no card e o caso volta ao diagrama de origem

### Requirement: CA3 · Desfavorável e vale nova perícia: o Jurídico administrativo marca de novo
Registrado "desfavorável" com "vale pedir nova perícia", o Jurídico administrativo SHALL receber a tarefa de marcar de novo.

#### Scenario: CA3 · Nova perícia
- **Dado** "desfavorável" e "vale pedir nova perícia"
- **Quando** registro
- **Então** o Jurídico administrativo recebe a tarefa de marcar de novo

### Requirement: CA4 · Desfavorável e não vale: volta à origem marcado como desfavorável
Registrado "desfavorável" com "não vale", o caso SHALL voltar ao diagrama de origem marcado como desfavorável.

#### Scenario: CA4 · Devolver
- **Dado** "desfavorável" e "não vale"
- **Quando** registro
- **Então** o caso volta ao diagrama de origem marcado como desfavorável

### Requirement: CA5 · O laudo anexado e as conferências antes de registrar
Ao registrar, o laudo ou o registro do GERID SHALL ser anexado e o resultado informado; "Registrar resultado" SHALL só habilitar com as decisões respondidas e a conferência "Li o laudo na íntegra" marcada (com as demais conferências da tela).

#### Scenario: CA5 · Registrar o resultado
- **Dado** a perícia feita
- **Quando** registro o resultado
- **Então** anexo o laudo ou o registro do GERID e informo favorável ou desfavorável; "Registrar resultado" só habilita com as decisões respondidas e a conferência "Li o laudo na íntegra" marcada

### Requirement: CA6 · No D2, o resultado volta e o D2 segue
Pedida no D2, o resultado SHALL voltar ao card e o D2 SHALL seguir: completa a junção antes da vigília ou, se veio de uma exigência, volta à vigília (D2.04).

#### Scenario: CA6 · Perícia do D2
- **Dado** a perícia pedida no D2
- **Quando** registro o resultado, favorável ou desfavorável
- **Então** ele volta ao card e o D2 segue

### Requirement: CA7 · O laudo segue para o perfil do perito
Registrado o resultado com laudo, o laudo SHALL seguir para a atualização do perfil do perito (DP.09, GGVP-73); na médica também (Lucas, 02/10, GGVP-73).

#### Scenario: CA7 · Laudo registrado
- **Dado** o resultado de uma avaliação social com laudo
- **Quando** registro
- **Então** o laudo segue para a atualização do perfil do perito (DP.09, GGVP-73)

### Requirement: CA8 · A jurimetria do perito dentro da tarefa (G22)
Com o perito identificado, a tarefa SHALL mostrar a jurimetria calculada pelo sistema, com o número de laudos e a data da base, sem amostra mínima (G22).

#### Scenario: CA8 · Perito identificado
- **Dado** o perito identificado
- **Quando** confiro o resultado
- **Então** vejo, dentro da tarefa, a jurimetria do perito com o número de laudos e a data da base; toda amostra conta

### Requirement: CA9 · As perícias da semana abrem a página do processo
Perguntado ao chat pelas perícias da semana, cada item SHALL abrir a página do processo do cliente com a perícia em destaque, e não a Agenda.

#### Scenario: CA9 · Perícias da semana
- **Dado** as perícias da semana
- **Quando** pergunto ao chat
- **Então** cada item abre a página do processo do cliente com a perícia em destaque

### Requirement: Resposta do PO · No desfavorável, a IA indica e a advogada decide
No desfavorável, a IA SHALL dizer por que foi desfavorável e se vale pedir nova perícia, e essa indicação SHALL ficar no histórico; a decisão MUST ser da advogada.

#### Scenario: Resposta do PO · A indicação da IA
- **Dado** um laudo desfavorável
- **Quando** a advogada confere
- **Então** vê a indicação da IA, que fica no histórico, e decide ela mesma
