# Spec Delta · ggvp-108

## Purpose

Identificadores validados para cliente e caso (CPF, NB ou protocolo do INSS e número CNJ), para casar publicações,
evitar cadastro duplicado e mostrar o caso pelo número certo em cada fase. Os números do caso ficam em
`identificador_caso`, só os dígitos, um número em um caso só, com a data em que entrou. A validação é a da biblioteca
`campos`, na tela e de novo no servidor.

## ADDED Requirements

### Requirement: CA1 · CPF validado e cadastro sem repetição
O CPF SHALL passar só com o dígito verificador certo (`validarCpf`). Um CPF já cadastrado MUST NOT criar outra
pessoa: o portal abre o cadastro que existe (GGVP-16 CA6). O telefone, ou o nome, igual ao de outra ficha SHALL gerar
só um aviso, com a ficha parecida, e o portal deixa seguir com "É outra pessoa", porque a família divide o mesmo
celular (GGVP-16 CA9). O cartão pedia "nunca cria um segundo" também para o telefone. A decisão do Mateus em 08/10:
o telefone não é chave, porque muitas famílias têm um celular só, e o cliente com telefone repetido pode ser criado.

#### Scenario: CA1 · CPF inválido ou repetido
- **Dado** um CPF digitado
- **Quando** os dígitos verificadores não conferem
- **Então** o CPF é recusado; **dado** um CPF ou telefone já cadastrado, **quando** alguém tenta cadastrar de novo, **então** o portal abre o cadastro existente e nunca cria um segundo

### Requirement: CA2 · Número CNJ com dígito conferido no protocolo
O registro do protocolo judicial SHALL recusar o número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO) com dígito verificador
inválido (`validarCnj`, contrato `ProtocolarPeticao`).

#### Scenario: CA2 · CNJ inválido
- **Dado** o registro do protocolo judicial
- **Quando** o número CNJ tem dígito verificador inválido
- **Então** o número é recusado

### Requirement: CA3 · O caso aparece pelo número da fase
O histórico do caso SHALL dizer o número do caso pela fase: na judicial, o número CNJ; nas outras, o NB, ou, sem ele, o
protocolo do INSS. Sem o número da fase, vale o último que o caso tiver. Cada número que o caso ganha SHALL entrar na
linha do histórico, com a data em que entrou.

#### Scenario: CA3 · Mudar de fase
- **Dado** um caso
- **Quando** muda de fase
- **Então** aparece pelo NB ou protocolo na fase administrativa e pelo número CNJ na judicial, com os dois no histórico

### Requirement: CA4 · Publicação casada pelo número CNJ
A publicação que chega SHALL ser casada pelo número CNJ só com os dígitos. A repetida é descartada. Sem número CNJ,
ou com número que não está em caso nenhum, ela vai para a fila de revisão (GGVP-26).

#### Scenario: CA4 · Casar a publicação
- **Dado** uma publicação que chega
- **Quando** o sistema a casa
- **Então** usa o número CNJ normalizado (sem pontuação); publicação repetida é descartada, e sem número CNJ ela vai para a fila de revisão

### Requirement: CA5 · Cada caso com os seus números
Cada caso SHALL ter os seus números. Um número MUST NOT ir para dois casos (`identificador_unico`). Um caso pode ter
o NB e, depois, o número CNJ, e os dois ficam.

#### Scenario: CA5 · Cliente com mais de um caso
- **Dado** um cliente
- **Quando** tem mais de um caso
- **Então** cada caso tem os seus números, e um caso pode ter NB e, depois, número CNJ

### Requirement: CA6 · Dados fictícios conferem
Todo CPF e todo número CNJ dos dados de exemplo das telas e do servidor SHALL passar nas mesmas validações. Um teste
confere os arquivos, para que número com dígito errado não volte.

#### Scenario: CA6 · Conferir os dados fictícios
- **Dado** os dados fictícios das telas
- **Quando** passam por estas validações
- **Então** todos conferem
