# Spec Delta · ggvp-63

## Purpose

Pedir a petição: com todos os setores fechados, a advogada pede a petição inicial, com as instruções, as opções e os documentos citados, e a versão 1 vai para a conferência (GGVP-67). Respostas do revisor de 06/10: sem IA até o épico IA jurídica, a advogada escreve ou cola o texto da versão 1 no portal; a jurimetria e a amostra mínima ficam para o épico Jurimetria; a identificação do juízo e o parecer médico no pedido ficam para a v2, como o cartão marca; qualquer advogada da fila pede.

## ADDED Requirements

### Requirement: CA1 · "Pedir a petição" ativa com todos os cards fechados
"Pedir a petição" SHALL ficar ativo só com todos os setores com o card fechado; antes disso, MUST ficar bloqueado e dizer quem falta.

#### Scenario: CA1 · Abrir o caso
- **Dado** todos os setores com card fechado
- **Quando** abro o caso
- **Então** o botão "Pedir a petição" fica ativo; antes disso fica bloqueado e diz quem falta

### Requirement: CA2 · A versão cita o que usou
A versão 1 SHALL ficar ligada aos documentos do caso que a advogada marcou como citados. A minuta escrita pela IA, citando os casos do acervo, entra com o épico IA jurídica.

#### Scenario: CA2 · Escrever a versão 1
- **Dado** o pedido
- **Quando** a versão 1 é escrita
- **Então** ela fica com os documentos do caso que a advogada marcou; a minuta da IA, com o acervo, entra com o épico IA

### Requirement: CA3 · Ver a versão e pedir outra
A advogada SHALL ver a versão; a versão seguinte vem de "Editar eu mesma" (GGVP-67 CA10), e o pedido de outra versão à IA, com um comentário, entra com o épico IA jurídica.

#### Scenario: CA3 · Abrir a minuta
- **Dado** a minuta
- **Quando** abro
- **Então** vejo a versão e posso fazer outra; o pedido à IA entra com o épico IA

### Requirement: CA4 · [v2] Parecer médico e jurimetria na petição
[v2] A petição SHALL usar o parecer médico confirmado (GGVP-20) e a jurimetria do JEF ou da subseção do endereço do cliente (a do juízo, quando conhecido, GGVP-64) quando a v2 entrar; não faz parte desta entrega.

#### Scenario: CA4 · Pedido com parecer e jurimetria
- **Dado** o pedido da petição
- **Quando** a IA escreve
- **Então** usa o parecer médico confirmado e, quando houver amostra, a jurimetria do JEF ou da subseção do endereço do cliente (a do juízo, se conhecido)

### Requirement: CA5 · [v2] Bloqueio pelo parecer médico (G17)
[v2] O pedido da petição MUST respeitar o G17. Nesta entrega, pelo caminho: todo caso que chega à Justiça passou pela conferência da Sênior antes do INSS, que já exige o parecer "Suficiente" ou a dispensa (GGVP-23); o bloqueio no próprio botão é da v2.

#### Scenario: CA5 · Caso sem parecer suficiente
- **Dado** um caso da matriz de `docs/requisitos/roteiro-laudos.md` sem parecer "Suficiente" nem dispensa
- **Quando** tento pedir a petição
- **Então** o botão fica bloqueado (G17)

### Requirement: CA6 · Ajustar as provas antes de gerar
O pedido SHALL mostrar as provas a anexar (os documentos do caso, para marcar como citados, e o nome do que falta) para ajustar antes de gerar. A tese e os pedidos sugeridos entram com o épico IA jurídica, e a linha "Acervo (jurimetria)", com o épico Jurimetria.

#### Scenario: CA6 · Abrir o pedido
- **Dado** o pedido da petição
- **Quando** abro
- **Então** vejo as provas a anexar e ajusto antes de gerar; a tese, os pedidos sugeridos e a jurimetria entram com os épicos deles

### Requirement: CA7 · Jurimetria dentro do pedido
A jurimetria do juízo SHALL ficar dentro do pedido e na página do processo, sem tela própria, com os números calculados em código, quando o épico Jurimetria entrar; não faz parte desta entrega.

#### Scenario: CA7 · Jurimetria do juízo
- **Dado** a jurimetria do juízo
- **Quando** ela aparece
- **Então** fica dentro do pedido e na página do processo; os números vêm de código e a IA só explica e cita as fontes

### Requirement: CA8 · Amostra insuficiente (G22)
Com a amostra abaixo do mínimo, o pedido SHALL mostrar "amostra insuficiente", sem porcentagem, e MUST NOT ficar bloqueado por isso (G22); entra com o épico Jurimetria.

#### Scenario: CA8 · Amostra pequena
- **Dado** a jurimetria com amostra abaixo do mínimo
- **Quando** peço a petição
- **Então** aparece "amostra insuficiente", sem porcentagem; o pedido não fica bloqueado por isso

### Requirement: CA9 · Instruções e opções registradas; o indeferimento sempre entra
Confirmado o pedido, MUST ficar registradas as instruções e as opções escolhidas (pedir tutela de urgência, usar precedentes do acervo, anexar os documentos citados). Sem IA, a advogada escreve ou cola o texto da versão 1. O indeferimento do INSS (Tema 350) SHALL entrar sempre, sem opção, e a trava do protocolo confere (G7, GGVP-71).

#### Scenario: CA9 · Confirmar o pedido
- **Dado** o pedido
- **Quando** confirmo
- **Então** ficam registradas as minhas instruções e as opções escolhidas, e a versão 1 é a que escrevi; o indeferimento do INSS sempre entra

### Requirement: CA10 · A versão vai para a conferência
A versão pronta SHALL ir para a conferência (GGVP-67), e nenhuma versão MUST ser protocolada sem conferência.

#### Scenario: CA10 · Versão pronta
- **Dado** a versão gerada
- **Quando** fica pronta
- **Então** vai para a conferência (GGVP-67); nenhuma versão é protocolada sem conferência

### Requirement: CA11 · Pedido pelo chat
O pedido da peça pelo chat SHALL mostrar o card de confirmação com as fontes e só gerar depois da confirmação, quando o épico IA jurídica entrar; não faz parte desta entrega.

#### Scenario: CA11 · Chat da advogada
- **Dado** que peço a peça pelo chat
- **Quando** o chat entende o pedido
- **Então** mostra o card de confirmação com as fontes e só gera depois que eu confirmo

### Requirement: CA12 · Chat fora do perfil
O chat SHALL recusar o pedido de petição do Atendimento, por estar fora do perfil, e oferecer criar a tarefa para a advogada, quando o épico IA jurídica entrar; não faz parte desta entrega.

#### Scenario: CA12 · Chat do Atendimento
- **Dado** alguém do Atendimento que pede uma petição pelo chat
- **Quando** envia
- **Então** o chat recusa, porque o pedido está fora do perfil, e oferece criar a tarefa para a advogada
