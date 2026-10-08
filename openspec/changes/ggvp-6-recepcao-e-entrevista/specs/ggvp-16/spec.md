# Spec Delta · ggvp-16 · Reconhecer quem chegou e para quê

## Purpose

No balcão, o Atendimento busca quem chegou, vê na hora se é cliente, lead já cadastrado ou ninguém, com etapa e agendamento do dia, e manda a pessoa para o lugar certo. Quem não está no sistema ganha a ficha com o mínimo, uma só por pessoa. Telas do Figma: step_D1.01 `10:3`, Atendimento · Novo cliente `73:371`, Cliente · dados (Atendimento) `73:199`. Passos D1.01, D1.03 e D1.04 do Miro.

## ADDED Requirements

### Requirement: CA1 · Cliente encontrado mostra caso, etapa e agendamento do dia
A busca do balcão SHALL encontrar o cliente do escritório pelo CPF ou pelo nome e MUST mostrar o caso (benefício), a etapa atual e o agendamento do dia, quando houver.

#### Scenario: CA1 · Buscar um cliente
- **Dado** um CPF ou nome de cliente do escritório
- **Quando** busco
- **Então** vejo o caso, a etapa atual e o agendamento do dia, se houver

### Requirement: CA2 · Lead encontrado mostra agendamento e ficha de atendimento
A busca SHALL encontrar o lead com contato prévio ou data marcada e MUST mostrar o agendamento e se a ficha de atendimento já foi preenchida.

#### Scenario: CA2 · Buscar um lead
- **Dado** um lead com contato prévio ou data marcada
- **Quando** busco
- **Então** vejo o agendamento e se a ficha de atendimento já foi preenchida

### Requirement: CA3 · Quem não está no sistema vira "Novo cliente" com o mínimo
Quando a busca não acha ninguém, o portal SHALL oferecer "Novo cliente". O mínimo MUST ser nome completo, idade, uma anotação breve do que a pessoa pretende e telefone com DDD; o CPF é opcional nesse momento. Da tela dá para marcar a entrevista na hora. A ficha de atendimento é preenchida pelo próprio cliente, fora desta tela.

#### Scenario: CA3 · Buscar quem não está no sistema
- **Dado** alguém que não está no sistema
- **Quando** busco
- **Então** o portal oferece "Novo cliente": o Atendimento guarda o mínimo (nome completo, idade, uma anotação breve do que a pessoa pretende e telefone com DDD) e pode marcar a entrevista na hora
- **E** o CPF é opcional nesse momento
- **E** a ficha de atendimento é preenchida pelo próprio cliente

### Requirement: CA4 · Encaminhar ao setor da etapa
Quando o cliente veio para outra etapa e o Atendimento escolhe "Encaminhar", o setor responsável SHALL receber a tarefa com a ficha e o agendamento (D1.03). Tarefa da Documentação MUST aparecer na Central do Atendimento, porque a Documentação não tem Central própria.

#### Scenario: CA4 · Encaminhar quem veio para outra etapa
- **Dado** um cliente que veio para outra etapa
- **Quando** escolho "Encaminhar"
- **Então** o setor responsável recebe a tarefa com a ficha e o agendamento

### Requirement: CA5 · Buscar pelo telefone
A busca SHALL encontrar o cliente ou o lead pelo telefone, com ou sem máscara, como na busca por nome ou CPF.

#### Scenario: CA5 · Buscar pelo telefone de quem chegou
- **Dado** o telefone de quem chegou
- **Quando** busco por ele
- **Então** o portal encontra o cliente ou o lead, como na busca por nome ou CPF

### Requirement: CA6 · CPF que já existe abre a ficha que já existe
O "Novo cliente" com um CPF que já está numa ficha MUST NOT criar uma segunda ficha: o portal SHALL abrir a ficha existente.

#### Scenario: CA6 · Tentar criar um cliente com CPF repetido
- **Dado** um CPF que já existe
- **Quando** o Atendimento tenta criar um "Novo cliente"
- **Então** o portal abre o cadastro existente e não cria um segundo

### Requirement: CA7 · "Outra etapa" pede o setor antes de encaminhar
Com "Outra etapa" escolhida, "Encaminhar" MUST ficar desabilitado até o Atendimento escolher o setor responsável: Jurídico, Documentação · ADM ou Financeiro.

#### Scenario: CA7 · Encaminhar sem o setor
- **Dado** "Outra etapa" escolhida
- **Quando** tento encaminhar sem informar o setor responsável (Jurídico, Documentação · ADM ou Financeiro)
- **Então** "Encaminhar" não habilita

### Requirement: CA8 · O encaminhamento fica no histórico do cliente
Todo encaminhamento SHALL entrar no histórico da ficha com quem encaminhou, a data, a hora e o setor de destino.

#### Scenario: CA8 · Ver o encaminhamento no histórico
- **Dado** um encaminhamento feito
- **Quando** abro o histórico do cliente
- **Então** vejo quem encaminhou, a data e a hora e o setor de destino

### Requirement: CA9 · Telefone ou nome igual só avisa
Telefone, ou nome igual, que já aparece em outra ficha SHALL gerar só um aviso no "Novo cliente", com a ficha parecida, e MUST deixar seguir com "É outra pessoa", porque família divide o mesmo celular.

#### Scenario: CA9 · Criar um cliente com telefone ou nome de outra ficha
- **Dado** um telefone, ou um nome igual, que já aparece em outra ficha
- **Quando** o Atendimento cria um "Novo cliente"
- **Então** o portal só avisa, mostra a ficha parecida e deixa seguir com "é outra pessoa"

### Requirement: CA10 · Parte do nome, com ou sem acento
A busca SHALL aceitar parte do nome, sem diferença entre maiúscula e minúscula nem entre letra com e sem acento ("Nat" ou "natali" acham "Natália"), e MUST mostrar o nome completo e a etapa de cada pessoa que bate.

#### Scenario: CA10 · Buscar por parte do nome
- **Dado** parte do nome, com ou sem acento (por exemplo "Nat" ou "natali")
- **Quando** busco
- **Então** o portal mostra as pessoas que batem, com o nome completo e a etapa de cada uma

### Requirement: CA11 · Campos a mais do "Novo cliente" e as duas saídas
Além do mínimo, o "Novo cliente" SHALL aceitar e-mail, cidade e UF, benefício de interesse (o catálogo único do portal, com "Não sei ainda", Curatela, Isenção de IR, Empréstimo fraudulento e Seguro de vida), como chegou e observação, e MUST oferecer "Salvar e marcar a entrevista" e "Salvar apenas".

#### Scenario: CA11 · Preencher o "Novo cliente"
- **Dado** a tela "Novo cliente"
- **Quando** preencho
- **Então** além do mínimo posso informar e-mail, cidade e UF, benefício de interesse (lista do escritório, com "Não sei ainda", incluindo Curatela, Isenção de IR, Empréstimo fraudulento e Seguro de vida), como chegou e observação
- **E** escolho "Salvar e marcar a entrevista" ou "Salvar apenas"

### Requirement: CA12 · Como chegou e indicação
"Como chegou" SHALL ser uma lista do escritório (as fontes de captação do Airtable). Se for indicação, o Atendimento MUST informar o nome de quem indicou, e isso MUST NOT transformar essa pessoa em captador.

#### Scenario: CA12 · Registrar como o lead chegou
- **Dado** "Como chegou"
- **Quando** registro o lead
- **Então** escolho a fonte numa lista do escritório
- **E** se for indicação, informo o nome de quem indicou, e isso não transforma essa pessoa em captador

### Requirement: CA13 · A anotação do primeiro contato vai para "Últimos contatos"
A anotação do que a pessoa pretende SHALL entrar no histórico de contatos da ficha ("Últimos contatos"), para a advogada ver antes da entrevista.

#### Scenario: CA13 · Salvar o lead com a anotação
- **Dado** a anotação do primeiro contato
- **Quando** salvo o lead
- **Então** ela fica no histórico de contatos do cliente ("Últimos contatos") e aparece para a advogada antes da entrevista

### Requirement: CA14 · Uma pasta só no Drive
Ao salvar um cadastro novo, o portal SHALL procurar uma pasta do cliente que já exista no Drive (regra do scanner: o CPF, ou o nome sem acento e sem diferença de maiúscula), usar a que achar, perguntar qual usar se achar mais de uma, e criar uma só se não achar. Enquanto cria, a tela MUST mostrar "criando a pasta…". Aqui o Drive é simulado.

#### Scenario: CA14 · Salvar um cadastro novo
- **Dado** um cadastro novo
- **Quando** é salvo
- **Então** nasce junto a pasta do cliente no Drive, uma só
- **E** antes de criar, o portal procura uma pasta que já exista, com a mesma regra do scanner, e se achar mais de uma, pergunta
- **E** enquanto cria, a tela mostra "criando a pasta…"

### Requirement: CA15 · CPF, telefone e data validados pela biblioteca campos
Todo campo do cadastro SHALL passar pela biblioteca `campos`: o CPF só passa com o dígito verificador certo e é guardado só com números; o telefone MUST ter DDD (10 ou 11 dígitos), sem o portal adivinhar o DDD; a data MUST NOT aceitar letra nem data futura.

#### Scenario: CA15 · Digitar nos campos do cadastro
- **Dado** qualquer campo do cadastro
- **Quando** digito
- **Então** o CPF só passa com o dígito verificador certo e fica guardado só com números
- **E** o telefone precisa de DDD (10 ou 11 dígitos, sem adivinhar o DDD)
- **E** a data não aceita letra nem data futura

### Requirement: CA16 · "Salvar" não grava duas vezes
O botão "Salvar" SHALL mostrar "salvando…" e MUST NOT aceitar outro clique até terminar; dois cliques gravam uma ficha só.

#### Scenario: CA16 · Clicar duas vezes em "Salvar"
- **Dado** o botão "Salvar"
- **Quando** clico
- **Então** ele fica "salvando…" e não aceita outro clique até terminar
- **E** dois cliques gravam uma ficha só

### Requirement: CA17 · Nova demanda de quem já é cliente
Para quem já é cliente, o balcão SHALL oferecer "Nova demanda", que segue para a abertura de um processo novo na mesma ficha (GGVP-124).

#### Scenario: CA17 · Cliente com outra demanda
- **Dado** alguém que já é cliente e veio com outra demanda
- **Quando** escolho "Nova demanda"
- **Então** sigo para a abertura de um processo novo na mesma ficha
