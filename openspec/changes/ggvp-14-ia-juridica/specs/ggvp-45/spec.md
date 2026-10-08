# Spec Delta · ggvp-45

## Purpose

Buscar no acervo antes de escrever (Mateus, 07/10, item 1 da análise do BPMN com as histórias). Toda geração da IA que escreve peça ou análise consulta antes o que a casa já viveu e mostra o que usou; sem nada parecido, avisa "sem referência na casa". Primeiro recorte: a busca é por texto no próprio PostgreSQL (português), sobre o que pessoas já aprovaram ou registraram em outros casos: petições aprovadas, decisões de mérito publicadas, motivos de indeferimento do banco de motivos e modelos de petição ativos, com o mesmo benefício quando o caso tem. Entra agora na minuta da petição (com "Usar precedentes do acervo" marcado) e na análise do indeferimento; benefício, perícia, manifestação e estudo de caso chamam a mesma busca quando ganharem IA. Fora: o card de confirmação do chat (CA3, junto com o chat que executa ações) e a busca por sentido (embeddings), que entra se a busca por texto não bastar.

## ADDED Requirements

### Requirement: CA1 · A geração mostra as fontes do acervo que usou
A IA SHALL receber os trechos do acervo mais parecidos com o caso (até 3) e a sugestão SHALL devolver cada um como fonte do tipo `acervo`, mostrada na tela que pediu a geração. O próprio caso MUST NOT entrar como referência dele mesmo.

#### Scenario: CA1 · Minuta com precedentes
- **Dado** outro caso do mesmo benefício com petição aprovada parecida com o motivo do indeferimento
- **Quando** a advogada pede a minuta com "Usar precedentes do acervo" marcado
- **Então** a IA recebe o trecho e a minuta mostra a fonte do acervo

### Requirement: CA2 · Sem nada parecido, "sem referência na casa"
Sem trecho parecido, a tela SHALL avisar "Sem referência na casa" e a geração segue só com o caso.

#### Scenario: CA2 · Acervo sem nada parecido
- **Dado** nenhum texto de outro caso parecido com o pedido
- **Quando** a IA gera
- **Então** a tela avisa "Sem referência na casa"

### Requirement: CA4 · Cada fonte leva o caso de origem
Cada trecho do acervo SHALL levar a referência do caso de origem (`caso:<id>`), ou do modelo (`modelo:<id>`) quando vem de um modelo da casa, e dizer de onde saiu (petição aprovada, decisão de mérito, motivo de indeferimento, modelo).

#### Scenario: CA4 · Referência
- **Dado** um trecho de petição aprovada de outro caso
- **Quando** aparece como fonte
- **Então** traz "caso:<id do caso de origem>" e "Petição aprovada"

### Requirement: CA5 · Número do acervo não vira argumento (G22 de 07/10)
Os trechos do acervo vão à IA só como texto; a instrução da minuta MUST NOT deixar porcentagem nem número de jurimetria entrar na peça. O G22 de 07/10 trocou "amostra insuficiente" por "toda porcentagem com o número de casos e a data da base"; o número fica fora da peça.

#### Scenario: CA5 · Minuta sem número
- **Dado** a minuta com precedentes
- **Quando** a IA escreve
- **Então** a instrução proíbe porcentagem e número de jurimetria na peça

### Requirement: CA6 · Sem dado pessoal de outro cliente
Antes de ir à IA e à tela, o trecho SHALL ter CPF, CEP, telefone, e-mail, endereço e o nome do cliente de origem trocados por marcadores ("[CPF]", "[cliente]" e afins).

#### Scenario: CA6 · Trecho com CPF e nome
- **Dado** uma petição aprovada de outro cliente com o nome e o CPF dele
- **Quando** o trecho é recuperado
- **Então** aparece com "[cliente]" e "[CPF]" no lugar
