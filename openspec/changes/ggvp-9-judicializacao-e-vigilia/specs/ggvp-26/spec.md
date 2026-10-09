# Spec Delta · ggvp-26

## Purpose

Receber e casar a publicação pelo número CNJ: as publicações chegam das fontes (AASP e DJEN, as reais desde o grupo 4, de 07/10; a fonte de exemplo fica para a máquina do dev e os testes) já ligadas ao processo, sem repetidas; as sem CNJ, ou com CNJ que não existe no sistema, vão para a fila de revisão da Sênior (resposta do revisor de 06/10).

## ADDED Requirements

### Requirement: CA1 · Publicação com CNJ conhecido é ligada ao processo
Uma publicação com número CNJ de um processo existente SHALL ser ligada a esse processo ao chegar.

#### Scenario: CA1 · CNJ existente
- **Dado** uma publicação com número CNJ de processo existente
- **Quando** chega
- **Então** é ligada ao processo

### Requirement: CA2 · Repetida é descartada com registro
Uma publicação repetida MUST ser descartada, e o descarte SHALL ficar registrado.

#### Scenario: CA2 · Publicação repetida
- **Dado** uma publicação repetida
- **Quando** chega
- **Então** é descartada e o descarte fica registrado

### Requirement: CA3 · Sem CNJ vai para a fila de revisão
Uma publicação sem número CNJ SHALL ir para a fila de revisão, tratada pela Sênior.

#### Scenario: CA3 · Publicação sem CNJ
- **Dado** uma publicação sem número CNJ
- **Quando** chega
- **Então** vai para a fila de revisão do Jurídico

### Requirement: CA4 · Mesma data, processo e teor é repetida, de qualquer fonte
Duas publicações com a mesma data, o mesmo processo e o mesmo teor MUST ser tratadas como repetidas, mesmo vindas de fontes diferentes.

#### Scenario: CA4 · AASP e DJEN
- **Dado** duas publicações com a mesma data, o mesmo processo e o mesmo teor
- **Quando** a segunda chega
- **Então** é tratada como repetida, mesmo que venham de fontes diferentes

### Requirement: CA5 · CNJ que não existe no sistema vai para a fila
Uma publicação com número CNJ que não existe no sistema SHALL ir para a fila de revisão.

#### Scenario: CA5 · CNJ desconhecido
- **Dado** uma publicação com número CNJ que não existe no sistema
- **Quando** chega
- **Então** também vai para a fila de revisão

### Requirement: CA6 · Consulta dos descartes
A consulta dos descartes SHALL mostrar o que foi descartado e por quê.

#### Scenario: CA6 · Consultar descartes
- **Dado** uma publicação descartada
- **Quando** consulto os descartes
- **Então** vejo o que foi descartado e por quê

### Requirement: CA7 · Item da fila com data, fonte, texto e o aviso
Cada item da fila de revisão SHALL mostrar data, fonte, texto, partes citadas e a indicação "número CNJ não informado na publicação" (ou "número CNJ não encontrado no sistema").

#### Scenario: CA7 · Abrir a fila
- **Dado** a fila de revisão
- **Quando** abro
- **Então** cada item mostra data, fonte, texto, partes citadas e a indicação do número CNJ

### Requirement: CA8 · Vincular com CNJ obrigatório ou registrar que não é do escritório
Decidir um item da fila MUST exigir o número CNJ de um processo existente para vincular, ou SHALL registrar que a publicação não é do escritório.

#### Scenario: CA8 · Decidir o item
- **Dado** um item da fila
- **Quando** decido
- **Então** vinculo a um processo existente, com o número CNJ obrigatório, ou registro que não é do escritório

### Requirement: CA9 · Vinculada segue como qualquer outra
O item vinculado SHALL seguir para leitura, classificação e encaminhamento como qualquer publicação (GGVP-34, GGVP-37), com o prazo contado a partir da data da publicação.

#### Scenario: CA9 · Confirmar o vínculo
- **Dado** um item vinculado
- **Quando** confirmo
- **Então** a publicação é classificada e encaminhada como qualquer outra, e o prazo é contado a partir da data da publicação

### Requirement: CA10 · Idade de cada item na fila
A fila SHALL mostrar a idade de cada item e alertar o item que passou de um dia sem tratamento.

#### Scenario: CA10 · Fim do dia
- **Dado** a fila
- **Quando** há item sem tratamento no fim do dia
- **Então** a fila mostra a idade de cada item e alerta

### Requirement: CA11 · Decisão da fila registrada
Toda decisão na fila SHALL registrar quem decidiu, quando e o processo vinculado.

#### Scenario: CA11 · Registrar a decisão
- **Dado** qualquer decisão na fila
- **Quando** registro
- **Então** ficam quem decidiu, quando e o processo vinculado

### Requirement: CA12 · Item da fila com o prazo que corre
O item da fila SHALL mostrar o prazo que pode estar correndo, contado pelo lado seguro a partir da publicação com o prazo mínimo de 5 dias úteis (GGVP-34), e o item com esse prazo a 2 dias úteis ou menos SHALL subir ao topo da fila da Sênior. Sem IA, o tipo de ato provável não é mostrado.

#### Scenario: CA12 · Item entra na fila
- **Dado** um item na fila de revisão
- **Quando** entra
- **Então** já mostra o prazo que está correndo, contado pelo lado seguro; item com prazo perto sobe para a Sênior

### Requirement: CA13 · Publicação inventada nunca entra em produção
Em produção (a imagem com `NODE_ENV=production` e sem `AMBIENTE=homologacao`), a vigília MUST NOT rodar a fonte de exemplo, mesmo que ela esteja em `FONTES_PUBLICACAO`; sem `FONTES_PUBLICACAO`, nenhuma fonte SHALL rodar. A AASP e o DJEN só ligam pelas variáveis do ambiente. A homologação (`AMBIENTE=homologacao`) segue com a fonte de exemplo, porque o roteiro do teste de 09/10 usa essas publicações (Otávio Lima); a máquina do dev e os testes também (orquestrador, 09/10).

#### Scenario: CA13 · Produção sem configuração
- **Dado** o servidor com `NODE_ENV=production`, sem `AMBIENTE` e sem `FONTES_PUBLICACAO`
- **Quando** a vigília monta as fontes
- **Então** nenhuma fonte roda e nenhuma publicação inventada entra

#### Scenario: CA13 · Exemplo pedido em produção
- **Dado** o servidor com `NODE_ENV=production` e `FONTES_PUBLICACAO=exemplo,djen`
- **Quando** a vigília monta as fontes
- **Então** só o DJEN entra; a fonte de exemplo fica de fora

#### Scenario: CA13 · Homologação
- **Dado** o servidor com `NODE_ENV=production`, `AMBIENTE=homologacao` e sem `FONTES_PUBLICACAO`
- **Quando** a vigília monta as fontes
- **Então** roda a fonte de exemplo, para o roteiro do teste

#### Scenario: CA13 · Máquina do dev
- **Dado** a API sem `AMBIENTE`, fora de produção e sem `FONTES_PUBLICACAO`
- **Quando** a vigília monta as fontes
- **Então** roda a fonte de exemplo, como antes
