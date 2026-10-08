# Spec Delta · ggvp-125

## Purpose

Ligar a Recepção e a Abertura no servidor (Mateus, 08/10), em ordem, elo por elo, sobre as telas do Pedro. As telas e as regras do Pedro já têm a forma das rotas (servidor de exemplo em `apps/web/src/dados/`); ligar é criar a rota com o mesmo contrato, levar a regra para o servidor (portões e perfil da sessão) e trocar o corpo da função por uma chamada à API. Bloco 1, este: o lead e a ficha (busca do balcão, "Já existe?", novo cliente, ficha do cliente com edição e histórico, ficha de atendimento). Os blocos seguintes, cada um com a sua parte desta spec: agenda e confirmação; entrevista e benefício; contrato; documentos, checklist e cobrança; liberação à Sênior.

Modo misto, até a ligação terminar: o lead que nasce no balcão é do servidor; as pessoas da semente de exemplo continuam no modo exemplo, para as telas e os testes do Pedro seguirem valendo. A busca junta os dois lados. A ficha do servidor é copiada para o modo exemplo do navegador, para as telas ainda não ligadas (agenda, entrevista e o resto) acharem a pessoa; cada bloco ligado tira a sua parte dessa cópia.

## ADDED Requirements

### Requirement: Bloco 1 · O lead e a ficha ficam no banco do portal
"Novo cliente" SHALL gravar a pessoa no banco (tabela `pessoa`, situação lead) e a ficha da Recepção (documento da ficha, no formato das telas), com o primeiro contato e o histórico; a ficha SHALL abrir para outra pessoa do escritório, em outro computador, pela busca do balcão. A busca SHALL juntar as pessoas do banco e as da semente de exemplo, sem repetir.

#### Scenario: Lead do balcão visto por outra pessoa
- **Dado** a Atendimento cadastrando um lead novo no balcão
- **Quando** a advogada, no computador dela, busca pelo nome
- **Então** acha o lead e abre a ficha com os dados e o histórico que a Atendimento gravou

### Requirement: Bloco 1 · As regras da ficha valem no servidor (GGVP-16, GGVP-24)
O servidor SHALL repetir as regras do Pedro: CPF repetido nunca grava e devolve a ficha que já existe (GGVP-16 CA6); nome ou telefone igual só grava com "É outra pessoa" (CA9); toda alteração da ficha entra no histórico com o que mudou; CPF de outra ficha não grava na edição nem na ficha de atendimento; a ficha de atendimento grava a triagem, os dados pessoais na ficha e o que ficou em branco, e MUST NOT aceitar senha (G9: a senha do gov.br só no cofre). Dados inválidos MUST ser recusados no servidor, com a biblioteca de campos.

#### Scenario: CPF repetido
- **Dado** uma pessoa já cadastrada com um CPF
- **Quando** alguém cadastra outro lead com o mesmo CPF
- **Então** nada é gravado e a resposta leva à ficha que já existe

#### Scenario: Ficha de atendimento sem senha
- **Dado** uma ficha de atendimento enviada com um campo de senha
- **Quando** o servidor grava
- **Então** a senha não fica em lugar nenhum da ficha

### Requirement: Bloco 1 · Perfil da sessão e dado pessoal fora do endereço (CA4)
As rotas SHALL usar o perfil da sessão: ver a ficha com `caso.ver`; cadastrar, editar e preencher a ficha de atendimento com `ficha.editar` (Atendimento, Documentação e Jurídico); nunca um perfil vindo do pedido ou do endereço. A busca e o "Já existe?" SHALL mandar nome, CPF e telefone no corpo do pedido, nunca no endereço, para não irem ao registro do servidor.

#### Scenario: Financeiro tenta cadastrar
- **Dado** o perfil Financeiro
- **Quando** chama o cadastro de um lead
- **Então** é recusado, e a tentativa fica registrada

### Requirement: Bloco 2 · A agenda e a confirmação ficam no banco do portal
Marcar, remarcar e iniciar a entrevista agora, registrar realizado ou faltou, o convite, o compromisso interno e a confirmação do lead (mensagem e registro) SHALL gravar no servidor, na ficha do banco, com as regras do Pedro; o horário ocupado SHALL olhar a agenda do escritório inteiro. Ao abrir cada tela, a cópia do navegador SHALL trazer do servidor as fichas da Recepção, as tarefas abertas e os compromissos internos, para a agenda e as Centrais mostrarem o que outro computador gravou.

#### Scenario: Entrevista marcada por um, vista por outro
- **Dado** a Atendimento marcando a entrevista de um lead do balcão
- **Quando** outra pessoa abre a agenda no computador dela
- **Então** a entrevista está lá, e o mesmo horário avisa que está ocupado

### Requirement: Bloco 2 · G15 no servidor
O servidor SHALL recusar a terceira remarcação da mesma entrevista (resposta `limite`, a tela leva à advogada sênior), e a segunda tentativa de confirmação sem resposta SHALL passar a tarefa à advogada sênior, sem nova tentativa marcada.

#### Scenario: Remarcação além do limite
- **Dado** uma entrevista já remarcada duas vezes
- **Quando** alguém pede outra remarcação
- **Então** nada é marcado e a resposta é `limite`

#### Scenario: Confirmação sem resposta duas vezes
- **Dado** a primeira tentativa sem resposta e a nova tentativa no dia marcado
- **Quando** a segunda também fica sem resposta
- **Então** a tarefa "Confirmar agendamento" vai para a advogada sênior

### Requirement: Bloco 2 · As tarefas da Recepção ficam no banco
As tarefas que o balcão, a agenda, a confirmação e a ficha de atendimento abrem ou concluem (encaminhar ao setor, receber para a entrevista, preencher ficha, preparar entrevista, cadastrar lead, a confirmação da sênior) SHALL ficar no servidor, uma por motivo, e aparecer na Central do setor em qualquer computador.

#### Scenario: A advogada recebe o "Preparar entrevista"
- **Dado** a Atendimento registrando que o lead confirmou e já preencheu a ficha
- **Quando** a advogada abre a Central dela, em outro computador
- **Então** a tarefa "Preparar entrevista" está lá
