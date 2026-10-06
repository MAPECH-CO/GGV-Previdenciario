# Spec Delta · ggvp-43 · Cadastrar o lead depois da entrevista

## Purpose

A advogada cadastra o lead a partir da ficha e da entrevista, sem digitar de novo, depois da conversa. Tela do Figma: step_D1.10 `14:89`, com Atendimento · Novo cliente `73:371` e Cliente · dados `73:199`. Passo D1.10 do Miro.

## ADDED Requirements

### Requirement: CA1 · Os dados da ficha já vêm preenchidos
Com a entrevista salva, o cadastro SHALL abrir com os dados da ficha para conferir.

#### Scenario: CA1 · Abrir o cadastro
- **Dado** a entrevista salva
- **Quando** clico em Cadastrar
- **Então** os dados da ficha já vêm preenchidos para eu conferir

### Requirement: CA2 · CPF que já existe
Um CPF de outra ficha SHALL mostrar o cadastro existente e MUST NOT criar outro.

#### Scenario: CA2 · CPF repetido
- **Dado** um CPF que já existe
- **Quando** tento cadastrar
- **Então** o portal mostra o cadastro existente e não cria outro

### Requirement: CA3 · Os campos do modelo do contrato
"Salvar cadastro" SHALL habilitar só com nome completo, CPF, estado civil, profissão, RG, endereço e telefone, e os do representante quando houver; o estado civil é uma escolha única entre Solteiro(a), Casado(a), União estável, Divorciado(a) e Viúvo(a).

#### Scenario: CA3 · Salvar sem um obrigatório
- **Dado** o cadastro aberto
- **Quando** falta um campo do modelo
- **Então** "Salvar cadastro" não habilita e a tela diz o que falta

### Requirement: CA4 · Sem os campos, sem kit
Um cadastro sem os campos obrigatórios do modelo SHALL impedir o kit do benefício (D1.15, D1.16), e a tela MUST dizer o que falta.

#### Scenario: CA4 · Gerar o kit
- **Dado** um cadastro sem os campos do modelo
- **Quando** alguém tenta gerar o kit
- **Então** o kit não é gerado e a tela diz o que falta

### Requirement: CA5 · Dígitos do CPF
O portal SHALL conferir os dígitos verificadores do CPF antes de aceitar.

#### Scenario: CA5 · CPF com dígito errado
- **Dado** um CPF digitado
- **Quando** a advogada salva
- **Então** o portal confere os dígitos verificadores antes de aceitar

### Requirement: CA6 · Representante legal
Com representante legal, o cadastro SHALL mostrar os campos do representante.

#### Scenario: CA6 · Cliente com representante
- **Dado** um cliente com representante legal
- **Quando** a advogada abre o cadastro
- **Então** aparecem os campos do representante

### Requirement: CA7 · Quem alterou, quando e o valor anterior
Toda alteração do cadastro salvo SHALL registrar quem alterou e quando, e o valor anterior MUST ficar no histórico.

#### Scenario: CA7 · Alterar um dado
- **Dado** o cadastro salvo
- **Quando** alguém altera um dado
- **Então** ficam registrados quem e quando, com o valor anterior no histórico

### Requirement: CA8 · As fontes e as divergências
Dados da ficha e da transcrição SHALL chegar preenchidos, e as divergências entre as fontes MUST aparecer destacadas.

#### Scenario: CA8 · Ficha e entrevista dizem diferente
- **Dado** dados que já existem na ficha e na transcrição
- **Quando** o cadastro abre
- **Então** eles chegam preenchidos e as divergências aparecem destacadas

### Requirement: CA9 · A mesma ficha
O cadastro SHALL completar a mesma ficha criada no primeiro contato; MUST NOT nascer uma segunda ficha.

#### Scenario: CA9 · Cadastrar o lead
- **Dado** o lead
- **Quando** a advogada cadastra
- **Então** completa a mesma ficha, que só muda de situação ao fechar

### Requirement: CA10 · Profissão, idade e CEP
A profissão SHALL ser escolhida numa lista, a idade MUST aparecer pela data de nascimento e o CEP preenche rua, bairro, cidade e UF.

#### Scenario: CA10 · Preencher
- **Dado** o cadastro aberto
- **Quando** preencho
- **Então** a profissão vem da lista, a idade aparece sozinha e o CEP preenche o endereço

### Requirement: CA11 · Duas pessoas na mesma ficha
Com duas pessoas na mesma ficha, a outra SHALL ver "fulano está editando" na hora, e salvar MUST NOT apagar o que a outra salvou.

#### Scenario: CA11 · Edição ao mesmo tempo
- **Dado** duas pessoas com a mesma ficha aberta
- **Quando** uma está editando
- **Então** a outra vê o aviso na hora, e salvar não apaga o que a outra salvou
