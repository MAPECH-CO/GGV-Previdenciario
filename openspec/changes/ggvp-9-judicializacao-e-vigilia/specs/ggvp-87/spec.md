# Spec Delta · ggvp-87

## Purpose

Manifestar e protocolar: com todos os itens provados (G21), a advogada anexa a versão da manifestação, aprova (G6) e registra o protocolo com data e comprovante; o processo volta para a vigília. Respostas do revisor de 06/10: vencido com item sem prova, sobe para a Sênior com "pedir dilação ou registrar a perda"; sem IA até o épico IA jurídica, a advogada redige fora do portal.

## ADDED Requirements

### Requirement: CA1 · Com todos os setores com OK, "Manifestar" ativa
Com todos os itens com prova, "Manifestar" SHALL ficar ativo e a tarefa "Manifestar no processo" SHALL nascer para a advogada; a minuta da IA fica para o épico IA.

#### Scenario: CA1 · Todos com OK
- **Dado** todos os setores com OK
- **Quando** abro o caso
- **Então** o botão "Manifestar" fica ativo

### Requirement: CA2 · Protocolada, volta para a vigília
A manifestação protocolada SHALL devolver o processo para a vigília, e a próxima publicação recomeça o ciclo.

#### Scenario: CA2 · Registrar o protocolo
- **Dado** a manifestação protocolada
- **Quando** registro
- **Então** o processo volta para a vigília

### Requirement: CA3 · Data e comprovante obrigatórios; só com a versão aprovada e nenhum setor pendente
Protocolar MUST exigir a data do protocolo e o comprovante anexado, e MUST habilitar só com "Aprovei a versão da manifestação (G6)" e nenhum setor pendente.

#### Scenario: CA3 · Protocolar
- **Dado** a manifestação
- **Quando** protocolo
- **Então** a data e o comprovante são obrigatórios, e só habilita com a versão aprovada e nenhum setor pendente

### Requirement: CA4 · Item sem prova perto do vencimento escala
Um item sem prova perto do vencimento do prazo processual SHALL escalar para a Sênior (G21): alerta a 5 dias úteis, topo a 2; vencido, "pedir dilação ou registrar a perda" (resposta do revisor de 06/10).

#### Scenario: CA4 · Perto do vencimento
- **Dado** um item sem prova perto do vencimento
- **Quando** o dia vira
- **Então** a tarefa escala para a Sênior

### Requirement: CA5 · Bloqueado mostra quem falta e o prazo
Com setor sem card ou perícia sem retorno, "Manifestar" MUST ficar bloqueado e SHALL mostrar quem falta e o prazo.

#### Scenario: CA5 · Setor pendente
- **Dado** um setor sem card ou a perícia sem retorno
- **Quando** abro o caso
- **Então** "Manifestar" fica bloqueado e mostra quem falta e o prazo

### Requirement: CA6 · A versão pode ser anexada a qualquer momento
A advogada SHALL poder anexar uma versão da manifestação enquanto a exigência está em cumprimento; o bloqueio vale só para o protocolo.

#### Scenario: CA6 · Rascunho antes
- **Dado** a exigência ainda em cumprimento
- **Quando** anexo uma versão
- **Então** ela fica como rascunho; o bloqueio vale só para o protocolo

### Requirement: CA7 · Tipos de peça e fontes ficam para o épico IA
A tela SHALL mostrar a versão anexada; os tipos de peça sugeridos, o contexto e as fontes da IA ficam para o épico IA.

#### Scenario: CA7 · Abrir a versão
- **Dado** a versão da manifestação
- **Quando** abro
- **Então** vejo a versão anexada, com número, autora e data

### Requirement: CA8 · Pedido pelo chat fica para o épico IA
O pedido da manifestação pelo chat fica para o épico IA; a aprovação do conteúdo MUST continuar com a advogada e SHALL registrar quem aprovou e qual versão (G6).

#### Scenario: CA8 · Aprovação
- **Dado** a versão anexada
- **Quando** aprovo
- **Então** fica registrado quem aprovou e qual versão

### Requirement: CA9 · Só a versão aprovada é protocolada
Uma versão nova depois da aprovação MUST exigir nova aprovação, e o protocolo MUST usar só a versão aprovada; a tentativa com versão não aprovada SHALL ser recusada e registrada.

#### Scenario: CA9 · Troca da versão
- **Dado** alguém que troca a versão aprovada antes do protocolo
- **Quando** tenta protocolar
- **Então** o sistema bloqueia e registra; só a versão aprovada é protocolada

### Requirement: CA10 · A manifestação entra na linha do processo
A manifestação protocolada SHALL entrar no histórico do processo com autora, data e versão.

#### Scenario: CA10 · Linha do processo
- **Dado** a manifestação protocolada
- **Quando** registro
- **Então** ela entra na linha do processo com autora, data e versão

### Requirement: CA11 · Título "Manifestar no processo"
A tarefa SHALL ter o nome do cliente e "Manifestar no processo".

#### Scenario: CA11 · Na Central
- **Dado** a tarefa
- **Quando** aparece na Central
- **Então** o título é o nome do cliente + "Manifestar no processo"

### Requirement: CA12 · Dilação com o OK da Sênior, sem o bloqueio do G21
Com itens sem prova perto do vencimento e a autorização da Sênior, a advogada SHALL poder protocolar o pedido de dilação de prazo, com os itens pendentes e o motivo; o G21 MUST NOT bloquear essa peça.

#### Scenario: CA12 · Pedido de dilação
- **Dado** itens sem prova perto do vencimento
- **Quando** a Sênior autoriza
- **Então** a advogada pode protocolar o pedido de dilação, que lista os itens pendentes e o motivo

### Requirement: CA13 · Sistema do tribunal fora do ar no último dia
Registrada a indisponibilidade do sistema do tribunal no último dia, com a prova e a data da volta, o prazo SHALL passar para o primeiro dia útil depois da volta (Lei 11.419, art. 10, §2º), contado em código.

#### Scenario: CA13 · Tribunal fora do ar
- **Dado** o sistema do tribunal fora do ar no último dia do prazo
- **Quando** registro a tentativa com a prova da indisponibilidade
- **Então** o prazo passa para o primeiro dia útil depois da volta do sistema
