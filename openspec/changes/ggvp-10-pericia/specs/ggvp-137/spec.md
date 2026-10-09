# Spec Delta · ggvp-137 · Ligar no servidor as telas da Perícia

## Purpose

As telas da Perícia nasceram sobre o servidor de exemplo, que grava no navegador. Esta história leva a perícia para o banco do portal, pela API, com o perfil da sessão, para o caso andar entre as pessoas. As regras são as mesmas das telas (`apps/web/src/regras/periciaNoCaso.ts`), importadas pelo servidor sem cópia. Parte 1: o servidor (contrato, banco, rotas, portões e testes da API). Parte 2: as telas no modo misto, depois do pedido #29.

## ADDED Requirements

### Requirement: CA1 · O que a tela salva vai para o banco pela API
Cada ação das telas da Perícia (iniciar, marcar, reunir, orientar, preparar, comparecimento e remarcação, resultado e perfil do perito) SHALL ter uma rota em `apps/api/src/rotas/pericia.ts` que grava na tabela `pericia`.

#### Scenario: CA1 · Marcar a perícia
- **Dado** a perícia liberada para marcar
- **Quando** o Jurídico administrativo registra a marcação com o comprovante do INSS (PDF)
- **Então** a perícia ganha data e local na tabela `pericia`, o comprovante vai para a pasta do caso e a resposta é a perícia na tela

### Requirement: CA2 · Os contratos em Zod
O que cada tela manda SHALL estar em `packages/contratos/src/pericia.ts`, conferido pelo servidor.

#### Scenario: CA2 · Corpo fora da forma
- **Dado** um pedido com o corpo fora do contrato
- **Quando** chega à rota
- **Então** o servidor responde 400 sem gravar

### Requirement: CA3 · O perfil da sessão
Toda rota SHALL usar `exigir` com o perfil da sessão (matriz v13), nunca `?perfil=`.

#### Scenario: CA3 · Perfil que não pode
- **Dado** a pessoa do Atendimento, da Documentação ou a Sênior
- **Quando** tenta uma ação do Jurídico administrativo ou da advogada
- **Então** recebe 403 e a tentativa fica no histórico

### Requirement: CA4 · Os portões no servidor
O servidor SHALL recusar o pedido ao médico e a orientação ao cliente que o G20 (e o G11) barram, com o portão registrado, e SHALL mostrar só para o Jurídico o conteúdo médico: a leitura do laudo e os laudos do acervo no perfil do perito, com o assunto deles (os números por assunto); quem do Jurídico recebe a leitura pela perícia do resultado SHALL ficar registrado em `acesso_dado_sensivel`. Os números do perito (G22), o status, o resultado, as datas, as etapas e o que a equipe escreveu, todo mundo do caso vê (saúde simples, Pedro, 08/10).

#### Scenario: CA4 · Pedido ao médico com CID
- **Dado** o pedido ao médico com CID ou conclusão
- **Quando** a Documentação envia
- **Então** o servidor recusa com 400 e registra o portão G20

#### Scenario: CA4 · A leitura do laudo é do Jurídico
- **Dado** o resultado registrado com o laudo
- **Quando** a Documentação ou o Atendimento abre a perícia
- **Então** vê o resultado, o laudo na pasta (o PDF só o Jurídico abre), o histórico e o que a equipe escreveu, sem a leitura do laudo nem os laudos do perfil do perito e o assunto deles

#### Scenario: CA4 · A leitura do Jurídico fica registrada
- **Dado** o resultado registrado com a leitura do laudo
- **Quando** a advogada abre a perícia do resultado
- **Então** recebe a leitura e o acesso fica em `acesso_dado_sensivel` (quem, quando, caso); a Documentação abre a mesma tela sem registro

### Requirement: CA5 · As pontas com o que já está no servidor
A perícia SHALL ser a linha da tabela `pericia` aberta pela decisão do D2.03 (GGVP-31), pela exigência, pelo despacho ou pelo juiz; o resultado SHALL fechar a perícia na junção do D2 e na exigência; o histórico SHALL ser o da GGVP-99.

#### Scenario: CA5 · A perícia nasce do INSS
- **Dado** a advogada decide a perícia médica no D2.03
- **Quando** o Jurídico administrativo abre a perícia do processo
- **Então** vê a mesma perícia, esperando o INSS liberar o agendamento, e a tarefa entra na Central depois da liberação

#### Scenario: CA5 · O resultado fecha a junção
- **Dado** a perícia com o cliente presente
- **Quando** a advogada registra o resultado
- **Então** a coluna `resultado` da perícia é gravada, a junção do D2 vê a perícia resolvida e o laudo entra no perfil do perito, sem o nome do cliente

### Requirement: CA6 · IA e Chatwoot continuam simulados
A leitura do comprovante e do laudo SHALL seguir simulada; o Chatwoot também.

#### Scenario: CA6 · Ler o comprovante
- **Dado** o comprovante do INSS
- **Quando** o servidor lê
- **Então** devolve data, hora, local e tipo da leitura simulada, sem o perito
