# Spec Delta · ggvp-73 · Atualizar o perfil do perito

## Purpose

Com o laudo da perícia, a IA atualiza o perfil do perito no acervo, para a próxima orientação daquele perito ser melhor. Respostas do Lucas de 02/10: entra na análise de LGPD, com liberdade interna (são dados do próprio escritório); o laudo da perícia médica também atualiza o perfil. Os números são código; a IA só grava e resume. Passo DP.09 do Miro (sem tela própria). Figma: Jurimetria do perito `2184:2` e `2184:53`, Resultado da perícia `1579:431`. A carga inicial do acervo fica fora (serviço de implantação). Contrato na `design.md`, seção GGVP-73.

## ADDED Requirements

### Requirement: CA1 · A IA atualiza o perfil e a mudança fica no histórico
Conferido o resultado com o laudo, a IA SHALL atualizar o perfil do perito e a mudança SHALL ficar no histórico.

#### Scenario: CA1 · Conferir o resultado
- **Dado** o laudo da avaliação social
- **Quando** confiro o resultado
- **Então** a IA atualiza o perfil do perito e a mudança fica no histórico

### Requirement: CA2 · O que o perito observou, perguntou e pediu, com a referência do caso
Registrado o resultado com laudo, a IA SHALL extrair o que o perito observou, perguntou e pediu e gravar no perfil, com a referência do caso.

#### Scenario: CA2 · Registrar com laudo
- **Dado** o resultado com laudo anexado
- **Quando** é registrado
- **Então** a IA extrai o que o perito observou, perguntou e pediu e grava no perfil do perito, com a referência do caso

### Requirement: CA3 · Um registro por laudo, sem sobrescrever
O perfil SHALL guardar o histórico por laudo, sem sobrescrever, e mostrar de quantos laudos é formado.

#### Scenario: CA3 · Laudo novo
- **Dado** o perfil do perito
- **Quando** recebe um laudo novo
- **Então** guarda o histórico por laudo, sem sobrescrever, e mostra de quantos laudos é formado

### Requirement: CA4 · Sem dado pessoal do cliente
O perfil MUST NOT guardar dado pessoal do cliente.

#### Scenario: CA4 · Gravar o perfil
- **Dado** o perfil do perito
- **Quando** é gravado
- **Então** não guarda dado pessoal do cliente

### Requirement: CA5 · O mesmo laudo não se duplica
Processado de novo o mesmo laudo, a informação MUST NOT se duplicar.

#### Scenario: CA5 · De novo
- **Dado** o mesmo laudo processado de novo
- **Quando** a IA roda outra vez
- **Então** a informação não se duplica

### Requirement: CA6 · Perito não reconhecido: um clique, e fora das contas até a resposta
Com um laudo cujo perito o sistema não reconhece, nada SHALL travar: a página SHALL perguntar em um clique a qual perito ligar o laudo, e o dado incerto SHALL ficar fora das contas até a resposta.

#### Scenario: CA6 · Perito desconhecido
- **Dado** um laudo cujo perito o sistema não reconhece
- **Quando** a IA vai gravar
- **Então** nada trava: surge uma pergunta de um clique para ligar o laudo ao perito certo, e o dado incerto fica fora das contas até a resposta

### Requirement: CA7 · Os números vêm de código; a IA só grava e resume
Mostrada a jurimetria, a contagem de laudos e as taxas SHALL vir de código, e a IA só grava e resume o conteúdo.

#### Scenario: CA7 · Jurimetria
- **Dado** o perfil atualizado
- **Quando** a jurimetria do perito é mostrada
- **Então** a contagem de laudos e as taxas vêm de código, e a IA só grava e resume o conteúdo dos laudos
