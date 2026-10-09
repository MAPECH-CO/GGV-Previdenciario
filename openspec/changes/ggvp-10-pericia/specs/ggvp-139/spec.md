# Spec Delta · ggvp-139 · IA de verdade na Perícia: comprovante do INSS, orientação, resultado e perfil do perito

## Purpose

A IA simulada das telas da Perícia dá lugar ao motor de IA do portal (`apps/api/src/ia`): a Mistral lê o PDF e a OpenAI sugere, com a chamada registrada, as fontes e o alerta. A IA só sugere; a pessoa confere e decide. Passos DP.04 (comprovante), DP.05 (orientação), DP.08 (resultado) e DP.09 (perfil do perito). Os casos da semente seguem com a IA simulada, para os testes de tela.

## ADDED Requirements

### Requirement: CA1 · O comprovante do INSS lido pela IA
O servidor SHALL ler o PDF do comprovante (finalidade `ler_comprovante_pericia`) e devolver data, hora, local e modalidade para a pessoa conferir; o tipo SHALL vir da perícia e o perito NUNCA SHALL sair do comprovante.

#### Scenario: CA1 · Anexar o comprovante
- **Dado** a perícia para marcar
- **Quando** o Jurídico administrativo anexa o PDF
- **Então** os campos vêm preenchidos pela IA, marcados como sugestão, sem o perito, e só viram marcação quando ele registra

### Requirement: CA2 · A orientação escrita pela IA
O servidor SHALL pedir à IA (finalidade `orientacao_pericia`) a orientação a partir da que o código montou (roteiro e, na Justiça, o perfil do perito); a saída SHALL passar pela verificação G11 e G20 e pelo bloqueio de CID antes de chegar à tela.

#### Scenario: CA2 · Frase pronta ou CID
- **Dado** a IA respondeu com frase pronta ou com CID
- **Quando** a tela pede a sugestão
- **Então** a sugestão não chega, a tela mostra o motivo e fica a orientação que o código montou

### Requirement: CA3 · O laudo resumido pela IA
O servidor SHALL ler o laudo (dado de saúde, só com a autorização do escritório) e devolver o resumo, se é favorável e o que muda no caso (finalidade `resumo_laudo_pericia`); o resultado SHALL ser marcado pela advogada.

#### Scenario: CA3 · Conferir o resultado
- **Dado** o laudo anexado
- **Quando** a IA resume
- **Então** a advogada vê o resumo marcado como sugestão, com a fonte, e registra o resultado; a leitura conferida é relida no servidor pela chamada

### Requirement: CA4 · O perfil do perito sem dado do cliente
Os padrões do perito (observou, perguntou, pediu, assunto) SHALL entrar no perfil sem o nome, o CPF, o telefone nem o endereço do cliente, garantido no código; os números do perfil SHALL ser código (G19, G22).

#### Scenario: CA4 · O laudo cita o cliente
- **Dado** a IA citou o nome e o CPF do cliente nos padrões
- **Quando** o laudo entra no perfil
- **Então** o nome e o CPF viram marcadores

### Requirement: CA5 · Cada sugestão marcada e registrada
Cada sugestão SHALL chegar à tela com a marca de sugestão da IA, as fontes e o alerta, se houver; a chamada SHALL ficar em `chamada_ia`.

#### Scenario: CA5 · Instrução escondida no PDF
- **Dado** um PDF com uma ordem para a IA
- **Quando** a IA lê
- **Então** a sugestão chega com o alerta, nada muda na perícia e o alerta fica no histórico

### Requirement: CA6 · Sem IA, a tela segue manual
Com a IA desligada, sem a autorização de dado de saúde ou com a saída fora do formato, a tela SHALL mostrar o motivo e seguir manual.

#### Scenario: CA6 · Sem autorização de dado de saúde
- **Dado** o escritório sem `IA_PERMITE_DADO_DE_SAUDE=sim`
- **Quando** a advogada anexa o laudo
- **Então** o laudo não vai à IA, a chamada fica recusada e a tela mostra o motivo

### Requirement: CA7 · Testes com fetch falso
Os testes SHALL usar `fetch` falso, sem chamar serviço de verdade, e cobrir o roteiro mínimo do guia do motor.

#### Scenario: CA7 · Rodar os testes
- **Dado** a sessão sem as chaves
- **Quando** os testes rodam
- **Então** nenhum serviço de verdade é chamado
