# Spec Delta · ggvp-54

## Purpose

A Sênior recebe o caso indeferido com o motivo e despacha: aciona os setores com o que cada um deve obter (e um prazo, se quiser), segue para pedir a petição quando nada falta, ou encerra o caso com motivo (já existe, GGVP-48). Respostas do revisor de 06/10: sem IA até o épico IA jurídica, a Sênior despacha sozinha e o G4 continua; a perícia vai para o Jurídico administrativo; a atribuição pelo líder fica fora deste épico.

## ADDED Requirements

### Requirement: CA1 · A tarefa traz o histórico do caso
A tarefa "Despachar caso" SHALL trazer o histórico do caso: o benefício, a decisão do INSS com a data, a carta, o motivo do INSS e o motivo escrito, com quem e quando. A análise e os critérios sugeridos pela IA entram com o épico IA jurídica.

#### Scenario: CA1 · Receber a tarefa
- **Dado** o motivo registrado
- **Quando** abro a tarefa
- **Então** vejo o histórico do caso e o motivo; a análise e os critérios da IA entram com o épico IA

### Requirement: CA2 · Cada setor marcado recebe a própria tarefa
Marcando o que falta (Atendimento, Documentação, perícia), cada setor SHALL receber a própria tarefa, e MUST ser possível marcar mais de um.

#### Scenario: CA2 · Marcar o que falta
- **Dado** o caso para despachar
- **Quando** marco o que falta (Atendimento, Documentação, perícia)
- **Então** cada setor recebe a própria tarefa; posso marcar mais de um

### Requirement: CA3 · "Nada falta" segue para pedir a petição
Com "nada falta", o caso SHALL ir direto para "Pedir a petição" (no Miro, a seta "Não: nada falta" liga o D3.03 ao D3.05).

#### Scenario: CA3 · Nada falta
- **Dado** "nada falta"
- **Quando** confirmo
- **Então** o caso vai direto para "Pedir a petição"

### Requirement: CA4 · O despacho vale como a Sênior decidiu (G4)
O despacho MUST valer como a Sênior decidiu; a sugestão da IA, quando existir (épico IA jurídica), SHALL ficar no histórico, separada do despacho (G4).

#### Scenario: CA4 · Despachar
- **Dado** o caso para despachar
- **Quando** despacho
- **Então** o despacho vale como decidi; a sugestão da IA, quando houver, fica no histórico (G4)

### Requirement: CA5 · A perícia abre a tarefa do Jurídico administrativo
Com "Perícia (DP)" marcada, o sistema SHALL abrir sozinho a tarefa de perícia (DP.01) do Jurídico administrativo, que marca, liga, orienta e remarca; o Atendimento MUST NOT receber tarefa de perícia.

#### Scenario: CA5 · Perícia no despacho
- **Dado** "Perícia (DP)" marcada no despacho
- **Quando** confirmo
- **Então** o sistema abre sozinho a tarefa de perícia (DP.01), com o Jurídico administrativo; o Atendimento não recebe tarefa de perícia

### Requirement: CA6 · O que obter e "Essa tarefa tem prazo?"
Para cada setor marcado, a Sênior MUST escrever o que ele deve obter e responder "Essa tarefa tem prazo?": com "Sim", a data de entrega é obrigatória; com "Não", a tarefa vai sem prazo. A tarefa do setor SHALL mostrar "Pedido", "Pedido por" e o prazo, quando houver.

#### Scenario: CA6 · Despachar aos setores
- **Dado** um ou mais setores marcados
- **Quando** despacho
- **Então** escrevo para cada setor o que ele deve obter e respondo "Essa tarefa tem prazo?"; com "Sim", defino a data de entrega; com "Não", a tarefa vai sem prazo

### Requirement: CA7 · As tarefas vão para a fila do setor
A tarefa de cada setor SHALL entrar na fila do perfil do setor, e "Pedir a petição", na fila das advogadas. A atribuição pelo líder e pela carga de cada advogada fica fora deste épico (resposta do revisor de 06/10).

#### Scenario: CA7 · Tarefa no setor
- **Dado** a tarefa de um setor criada
- **Quando** chega ao setor
- **Então** entra na fila do setor; com "nada falta", "Pedir a petição" entra na fila das advogadas

### Requirement: CA8 · Só a Sênior despacha (G4)
O despacho de quem não tem o perfil Sênior MUST ser recusado no servidor, e a recusa SHALL ficar registrada; a sugestão da IA MUST NOT virar despacho sem a ação da Sênior (G4).

#### Scenario: CA8 · Sem o perfil Sênior
- **Dado** alguém sem o perfil Sênior
- **Quando** tenta despachar
- **Então** a ação é recusada no servidor e registrada

### Requirement: CA9 · Autora, data e setores registrados
O despacho confirmado SHALL registrar a autora, a data e os setores acionados.

#### Scenario: CA9 · Confirmar o despacho
- **Dado** o despacho
- **Quando** confirmo
- **Então** ficam registrados a autora, a data e os setores acionados

### Requirement: CA10 · Título "Despachar caso"
A tarefa SHALL aparecer na Central da Sênior com o nome do cliente e "Despachar caso".

#### Scenario: CA10 · Na Central
- **Dado** o motivo registrado
- **Quando** a tarefa aparece na minha Central
- **Então** o título é o nome do cliente + "Despachar caso"
