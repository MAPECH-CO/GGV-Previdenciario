# Spec Delta · ggvp-156

## Purpose

Quem vê a jurimetria (decisão do Mateus em 13/10; o Lucas confirma na review): o Jurídico, isto é, a advogada, a Sênior e o
Jurídico administrativo, que montam o caso e preparam a perícia, e o Sócio, que lê tudo (decisão de 09/10). O
Atendimento, a líder do Atendimento, a Documentação e o Financeiro não veem. Os números nunca vão ao cliente nem ao texto
da peça.

A régua de "quem é do Jurídico" é a mesma que a tela já usa para a jurimetria do caso (`estudo.ver`) e a que a perícia usa
para o conteúdo médico (`dado_saude.ver_detalhe`): as duas são o Jurídico e o Sócio. A chance de êxito (`chance.ver`) passa
a ter o mesmo público. Matriz versão 30.

## ADDED Requirements

### Requirement: CA1 · O Jurídico administrativo vê a chance
A ação `chance.ver` SHALL incluir o Jurídico administrativo, ao lado da advogada, da Sênior e do Sócio.

#### Scenario: CA1 · Jurídico administrativo
- **Dado** o Jurídico administrativo
- **Quando** abre a conferência, a perícia ou a petição de um caso
- **Então** vê a chance de êxito, como a advogada e a Sênior

### Requirement: CA2 · Fora do Jurídico, a perícia sem os números do perito
Para quem não é do Jurídico nem o Sócio, o servidor MUST NOT mandar, na perícia, os números do perito (a jurimetria geral,
por assunto e por benefício) nem os laudos do perfil. O perito, o resultado, as datas e as etapas continuam de todos
(saúde simples de 08/10).

#### Scenario: CA2 · Documentação ou Atendimento
- **Dado** a Documentação ou o Atendimento
- **Quando** abrem a perícia
- **Então** veem o perito e o resultado, mas o servidor não manda o número geral dele nem os laudos

### Requirement: CA3 · Gestão sem os recortes da jurimetria fora do Jurídico
Os recortes por perito, juízo, vara e tese da Gestão SHALL sair só para o Jurídico e o Sócio. Para os outros perfis que
abrem a Gestão (a líder do Atendimento e o Financeiro), a tela MUST NOT oferecer esses recortes e o servidor SHALL recusar
o pedido (403). A operação do escritório, os tempos e o recorte por benefício continuam. O recorte por advogada (a taxa de
êxito de cada advogada) é só dos sócios (Mateus, 13/10, na revisão do #75; requisito P5.13 da change ggvp-158-fechamento).

#### Scenario: CA3 · A líder do Atendimento na Gestão
- **Dado** a líder do Atendimento
- **Quando** abre a Gestão
- **Então** não recebe os recortes por perito, juízo, vara e tese; a operação do escritório e os tempos continuam

### Requirement: CA4 · A API segue a mesma régua
Pela API, a jurimetria (chance, juízo, números do perito e recortes da Gestão) SHALL sair só para o Jurídico e o Sócio. A
matriz de permissões sobe para a versão 30, com a impressão digital nova no teste.

#### Scenario: CA4 · Pedido pela API
- **Dado** cada perfil
- **Quando** pede a jurimetria pela API
- **Então** só o Jurídico e o Sócio recebem; a matriz de permissões sobe de versão, com o teste
