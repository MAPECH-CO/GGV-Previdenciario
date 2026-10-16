# Spec Delta · ggvp-111 · Terceiro não se passa pelo cliente

## Purpose

O Atendimento confirma a identidade de quem fala em nome do cliente, por telefone ou mensagem, antes de informar dados do
caso ou mudar telefone, e-mail ou dados bancários, para que ninguém desvie um pagamento ou aplique golpe se passando pelo
cliente. Transversal: os contatos com o cliente de D1.04, D1.23, D3.04, D3a.03, D2.06, D3b.03, D3b.06 e DP.06. Respostas do
Lucas de 07/10: a verificação é por chamada de vídeo ou com o cliente no escritório; nada muda sem plena certeza de que é o
cliente, e as alterações são feitas em contrato novo; o canal é o Chatwoot; o repasse vai por Pix para a conta cadastrada
(RPV) ou na ida ao banco com o cliente (administrativo). Figma: Cliente · dados `73:199`, Prestação de contas `1578:316`,
chat "o cliente ligou" `2107:2` e `2107:1091`, Registrar conversa `2144:2`. Contrato na `design.md`, seção GGVP-111.

## ADDED Requirements

### Requirement: CA1 · Mudar contato ou banco só com o cliente verificado, em contrato novo
O pedido para mudar telefone, e-mail ou dados bancários, chegado por telefone ou mensagem, SHALL ser feito só com o cliente verificado por chamada de vídeo ou no escritório, em contrato novo, e SHALL ficar no histórico com o valor antigo e o novo. O servidor MUST recusar sem a verificação.

#### Scenario: CA1 · O pedido chega por telefone ou mensagem
- **Dado** um pedido para mudar telefone, e-mail ou dados bancários
- **Quando** chega por telefone ou mensagem
- **Então** só é feito com plena certeza de que é o cliente, por chamada de vídeo ou com o cliente no escritório; a alteração é feita em contrato novo e fica no histórico com o valor antigo e o novo

### Requirement: CA2 · Banco mudado perto da prestação de contas: alerta
A mudança de dados bancários perto da prestação de contas SHALL alertar a advogada e o Financeiro antes do OK e do repasse.

#### Scenario: CA2 · A mudança é registrada
- **Dado** uma mudança de dados bancários perto da prestação de contas
- **Quando** é registrada
- **Então** a advogada e o Financeiro recebem alerta antes do OK e do repasse

### Requirement: CA3 · Sem verificação, retorno pelo contato cadastrado
A quem não passou pela verificação e pede informação do caso, o Atendimento SHALL só dizer que vai retornar pelo contato cadastrado.

#### Scenario: CA3 · Alguém não verificado pede informação
- **Dado** alguém que não passou pela verificação
- **Quando** pede informação do caso
- **Então** o Atendimento só diz que vai retornar pelo contato cadastrado

### Requirement: CA4 · Os modelos dizem que o escritório nunca pede a senha
Os modelos de mensagem ao cliente SHALL dizer que o escritório nunca pede a senha do gov.br por mensagem.

#### Scenario: CA4 · Os modelos são enviados
- **Dado** os modelos de mensagem ao cliente
- **Quando** são enviados
- **Então** dizem que o escritório nunca pede a senha do gov.br por mensagem

### Requirement: CA5 · Dados bancários: confirmação dupla, só no histórico
A alteração de dados bancários SHALL exigir a confirmação de uma segunda pessoa. Confirmada, a mudança SHALL ficar no histórico (quem, quando, o fato, sem os números). Ela MUST NOT mandar mensagem ao cliente nem abrir tarefa para o Atendimento.

Decisão do Pedro em 15/10 (teste de 14/10): o aviso saía sozinho na confirmação; a opção B do Mateus (14/10) o trocou por uma tarefa do Atendimento. O Pedro decidiu que basta o histórico: "tem coisas desse tipo que nem precisam ficar virando tarefa ou mandar mensagem pro cliente". O alerta de mudança perto da prestação de contas (CA2) continua.

#### Scenario: CA5 · A alteração é confirmada
- **Dado** uma alteração de dados bancários pedida com a verificação
- **Quando** outra pessoa confirma
- **Então** os dados mudam, a mudança fica no histórico, nenhuma mensagem sai para o cliente e nenhuma tarefa nasce para o Atendimento

### Requirement: CA6 · A ligação da perícia com a mesma verificação
A ligação de orientação para a perícia SHALL seguir a mesma verificação antes de passar data, local e orientação.

#### Scenario: CA6 · O Jurídico administrativo liga
- **Dado** a ligação de orientação para a perícia
- **Quando** o Jurídico administrativo liga
- **Então** segue a mesma verificação antes de passar data, local e orientação

### Requirement: CA7 · O chat lembra de confirmar a identidade
Quando o chat disser o que falar ao cliente que ligou, SHALL lembrar de confirmar a identidade antes de passar dados do caso.

#### Scenario: CA7 · "O cliente me ligou, qual é a próxima tarefa dele?"
- **Dado** a pergunta "o cliente me ligou, qual é a próxima tarefa dele?" no chat
- **Quando** o chat diz o que falar ao cliente
- **Então** lembra de confirmar a identidade antes de passar dados do caso

### Requirement: CA8 · Com quem falou, e o pedido de quem não é o cliente
O registro de contato SHALL guardar com quem a pessoa falou; o pedido de mudança de dado feito por quem não é o cliente MUST NOT ser aplicado sem a verificação.

#### Scenario: CA8 · A pessoa marca com quem falou
- **Dado** um contato registrado ("Registrar conversa")
- **Quando** a pessoa marca com quem falou (cliente, familiar ou contato de apoio, médico ou clínica)
- **Então** o registro guarda isso, e pedido de mudança de dado feito por quem não é o cliente não é aplicado sem a verificação

### Requirement: CA9 · Agência e conta com o traço automático
- Os campos Agência e Conta SHALL formatar enquanto a pessoa digita, pela biblioteca `campos`: a conta ganha o traço antes do último caractere (o dígito, que pode ser X); a agência com 4 números fica como está e, com 5, o último vira o dígito, depois do traço.
- A conferência SHALL ser a da biblioteca, na tela e no servidor, com as mesmas mensagens.

Teste do Pedro (14/10): a conta digitada só com números ("123456") era recusada, pedindo o traço.

#### Scenario: CA9 · Digitar só os números
- **Dado** o cartão "Dados bancários para o repasse", com a mudança aberta
- **Quando** a pessoa digita "123456" na conta e "00019" na agência
- **Então** os campos mostram "12345-6" e "0001-9", e o pedido pode seguir
