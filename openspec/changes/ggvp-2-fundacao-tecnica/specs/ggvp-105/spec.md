# Spec Delta · ggvp-105

## Purpose

Motor de fluxo: cada caso é uma instância dos diagramas D1 a D3b, com a perícia (DP) como subprocesso chamado, as
junções paralelas e inclusivas, os laços com limite e as esperas por quem está fora do escritório. Assim as telas
mostram o estado real do caso e o servidor recusa ação fora de ordem. O motor é o próprio servidor: cada rota confere o
passo antes de agir, e o estado do caso fica no banco, consultável por uma rota só.

## ADDED Requirements

### Requirement: CA1 · O servidor recusa o passo fora de ordem
O servidor SHALL recusar concluir um passo cujo pré-requisito não foi cumprido, com a mensagem do que falta, qualquer
que seja a tela ou o pedido (por exemplo: registrar a resposta do INSS sem a vigília aberta, pedir a petição antes do
despacho, protocolar no INSS sem o OK da Sênior).

#### Scenario: CA1 · Passo sem o pré-requisito
- **Dado** um passo cujo pré-requisito não foi cumprido
- **Quando** alguém tenta concluí-lo
- **Então** o servidor recusa; a validação não depende da tela

### Requirement: CA2 · Junções esperam todos os ramos ativados
Numa junção paralela (no D2, protocolo e perícia; no deferido, o recebimento do Financeiro e a ida ao banco, que só
começam depois da prestação de contas) ou inclusiva (no D3, setores e perícia; no D3a, responsáveis e perícia), o caso
SHALL avançar só quando todos os ramos ativados terminam. O estado de cada ramo SHALL poder ser consultado no estado
do fluxo do caso: cada passo com o diagrama, a situação e a junção a que pertence.

#### Scenario: CA2 · Um ramo termina
- **Dado** uma junção paralela ou inclusiva
- **Quando** um ramo termina
- **Então** o caso só avança quando todos os ramos ativados terminam, e o estado de cada ramo pode ser consultado

### Requirement: CA3 · A perícia é um subprocesso chamado
Um pedido de perícia vindo do D2, do D3 ou do D3a SHALL abrir sozinho a tarefa de perícia (DP.01) com a origem. Cada
perícia guarda o passo que a chamou, e o resultado volta para esse passo: cada chamador lê só as perícias que ele
chamou, então o mesmo caso pode chamar o DP várias vezes. Registrar o resultado da perícia no servidor fica com as
telas da Perícia (GGVP-10), que ainda gravam no navegador.

#### Scenario: CA3 · Pedido de perícia
- **Dado** um pedido de perícia vindo do D2, do D3 ou do D3a
- **Quando** é registrado
- **Então** o sistema abre sozinho a tarefa de perícia (`DP.01`) com a origem, e no fim o DP devolve o resultado ao diagrama que pediu; o mesmo caso pode chamar o DP várias vezes, e cada chamada volta ao chamador certo

### Requirement: CA4 · Documentos antes da perícia na exigência
Na exigência do INSS que pede perícia e documentos, o servidor SHALL abrir primeiro a tarefa da Documentação e só
chamar a perícia quando os documentos chegam.

#### Scenario: CA4 · Exigência com perícia e documentos
- **Dado** uma exigência do INSS que pede perícia e documentos
- **Quando** a advogada a classifica
- **Então** o motor abre primeiro a tarefa da Documentação e só chama o DP quando os documentos chegam

### Requirement: CA5 · Laudo novo sem mudar a fase
O laudo médico novo SHALL esperar a conferência do Jurídico em qualquer fase, sem mudar a fase do caso; enquanto
espera, a conferência da Sênior acusa o laudo novo (G17). Abrir o subfluxo D1.02 → D1.21M a partir do laudo que chega
fica com a rota que recebe o laudo (telas do chat e da Documentação), que ainda não está no servidor.

#### Scenario: CA5 · Laudo novo chega
- **Dado** um laudo novo
- **Quando** chega em qualquer fase
- **Então** o motor abre o subfluxo do laudo novo (`D1.02` → `D1.21M`) sem mudar a fase do caso; no fim, o caso segue na fase em que está

### Requirement: CA6 · Limite e intervalo dos laços vêm da configuração
O limite de tentativas e o intervalo dos laços de cobrança, contato e remarcação SHALL vir da configuração do
escritório: parâmetro (Q1), padrão de 2 tentativas com 3 dias entre elas. Passou do limite, a tarefa vai para a Sênior
(G15).

#### Scenario: CA6 · Contar as tentativas
- **Dado** um laço de cobrança, contato ou remarcação
- **Quando** conta as tentativas
- **Então** o limite e o intervalo são parâmetros da configuração do escritório, não constantes no código; o padrão é 2 tentativas com 3 dias entre elas, e depois a tarefa vai para a Sênior

### Requirement: CA7 · Espera por quem está fora
O passo numa raia externa SHALL deixar o caso "aguardando <quem está fora>", e o estado do fluxo do caso SHALL mostrar
a espera e por quem. Quando o evento chega, o fluxo retoma no passo do escritório da tabela das esperas (proposta dos
devs, sem resposta no refinamento de 07/10).

#### Scenario: CA7 · O fluxo chega na raia externa
- **Dado** um passo numa raia externa (cliente, INSS, perito ou Justiça)
- **Quando** o fluxo chega nele
- **Então** o caso fica no estado "aguardando <quem está fora>", com prazo e lembrete; quando o evento chega, o fluxo retoma no passo do escritório indicado na tabela das esperas

### Requirement: CA8 · Espera vencida conta tentativa e escala
Uma vez por dia, a tarefa de laço com o prazo vencido SHALL contar uma tentativa ("prazo vencido sem resposta") e
ganhar o prazo seguinte pelo intervalo da configuração. Chegando ao limite de tentativas, ela MUST subir para a Sênior
(G15) uma vez só. Na perícia, ela sobe para a advogada responsável.

#### Scenario: CA8 · O dia vira com a espera vencida
- **Dado** uma espera externa que passou do prazo
- **Quando** o dia vira
- **Então** vale o laço do passo que pediu: lembrete, tentativa contada e, no limite, escalonamento pelo G15

### Requirement: CA9 · O caso muda de diagrama só pelas saídas desenhadas
O caso SHALL mudar de diagrama só pelas saídas que o servidor faz: do D2 para o D3 no indeferido; do D3 para o D3a com
a publicação do processo protocolado; a chamada e a volta da perícia. A volta do D2 ao D1 na reprovação da Sênior fica
como decisão registrada no caso, e o mérito e o recurso (D3a e D3b) ficam nas tarefas e decisões do desfecho.

#### Scenario: CA9 · Retorno entre diagramas
- **Dado** os retornos entre diagramas (D2 → D1 quando a Sênior reprova; D3a → D3b no mérito; D3b → D3a no recurso; D3a em ciclo até o mérito)
- **Quando** acontecem
- **Então** o caso muda de diagrama só pelas saídas desenhadas

### Requirement: CA10 · Toda transição fica no histórico
Todo passo que abre, entra em espera, conclui ou é cancelado SHALL gerar um evento de auditoria, com o diagrama, o
passo e quem concluiu (ou "Sistema"). O banco grava, então nenhuma rota esquece. O histórico do caso mostra cada um.

#### Scenario: CA10 · Uma transição acontece
- **Dado** cada transição
- **Quando** acontece
- **Então** gera um evento de auditoria (GGVP-99)

### Requirement: CA11 · Evento repetido não duplica
O evento que chega de fora repetido (a mesma publicação de outra fonte, o mesmo protocolo) MUST NOT duplicar a
transição: a publicação repetida é descartada com registro, e o número já registrado não entra de novo.

#### Scenario: CA11 · Evento repetido
- **Dado** um evento repetido (por exemplo, webhook reenviado ou publicação repetida)
- **Quando** chega
- **Então** não duplica a transição

### Requirement: CA12 · A tarefa vai para a Central do perfil dono
Toda tarefa de pessoa que o servidor cria SHALL ter o perfil dono da raia e SHALL aparecer na Central desse perfil.

#### Scenario: CA12 · O motor cria uma tarefa
- **Dado** uma tarefa de pessoa
- **Quando** o motor a cria
- **Então** ela aparece na Central do perfil dono da raia (GGVP-78)
