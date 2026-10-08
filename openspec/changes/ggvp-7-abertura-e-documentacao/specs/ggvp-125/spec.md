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

### Requirement: Bloco 3a · A entrevista gravada e a transcrição ficam no banco do portal
Começar a gravar (só com o aviso ao cliente registrado, G10), pausar e retomar, encerrar, registrar sem áudio, subir o áudio gravado fora, transcrever (simulada até a OpenAI entrar), conferir o que a transcrição trouxe, conferir os documentos, marcar a prova e registrar a conversa sem áudio SHALL gravar no servidor, com as regras do Pedro; o fim da entrevista SHALL concluir o "Preparar entrevista" e abrir o "Definir benefício" e, para o lead, o "Cadastrar lead" do Jurídico, no banco.

#### Scenario: Entrevista gravada vista por outra advogada
- **Dado** a advogada gravando e encerrando a entrevista de um lead do balcão
- **Quando** outra advogada abre o caso no computador dela
- **Então** vê a transcrição e as tarefas "Definir benefício" e "Cadastrar lead"

### Requirement: Bloco 3a · A gravação com dado de saúde fica só com o Jurídico
A gravação da entrevista e a conversa registrada pelo Jurídico SHALL ir às telas só para quem tem `dado_saude.ver_detalhe`; o Atendimento SHALL receber só as conversas que não são do Jurídico. Gravar e transcrever SHALL pedir a permissão nova `entrevista.gravar` (Jurídico). Gravar sem o aviso ao cliente MUST ser recusado (G10).

#### Scenario: O Atendimento não recebe a transcrição
- **Dado** uma entrevista gravada e transcrita
- **Quando** a Atendimento abre uma tela
- **Então** a cópia do navegador dela não traz essa gravação

#### Scenario: Gravar sem o aviso
- **Dado** a advogada sem ter avisado o cliente
- **Quando** pede para começar a gravar
- **Então** o servidor recusa

### Requirement: Bloco 3b · As decisões depois da entrevista ficam no banco do portal
O cadastro do lead, a análise da ficha (auxílio acidentário), a definição do benefício, o cálculo de tempo e pontos, o fechamento ("Fechou com o escritório?"), o recontato e a nova demanda de quem já é cliente SHALL gravar no servidor, com as regras do Pedro e as tarefas que abrem e concluem. Definir o benefício, registrar o cálculo e analisar a ficha SHALL pedir a permissão nova `ficha.analisar` (Jurídico): a IA sugere e a advogada decide (G3). O papel de quem registra o fechamento SHALL vir do perfil da sessão, nunca do pedido.

#### Scenario: Benefício definido pela advogada
- **Dado** a entrevista de um lead do balcão gravada e transcrita
- **Quando** a advogada define o benefício
- **Então** a decisão fica na ficha do banco com quem decidiu, e "Definir benefício" sai da fila

### Requirement: Bloco 3b · G16 no servidor
O lead que não fecha SHALL ter o motivo da lista; "Recusado pelo escritório" MUST NOT ser registrado pelo perfil Atendimento; o lead arquivado SHALL ficar como `nao_virou_cliente` com o motivo na pessoa do portal, e as tarefas abertas dele se encerram.

#### Scenario: Lead arquivado com o motivo
- **Dado** um lead depois da entrevista
- **Quando** o Atendimento registra que não fechou, sem recontato, com o motivo "Preço"
- **Então** a pessoa fica `nao_virou_cliente` com o motivo, e as tarefas abertas dela se encerram

#### Scenario: Recusa do escritório pelo Atendimento
- **Dado** o perfil Atendimento
- **Quando** registra o motivo "Recusado pelo escritório"
- **Então** o servidor recusa

### Requirement: Bloco 3b · A senha do gov.br vai ao cofre de verdade
Nas fichas do servidor, guardar e renovar a senha do gov.br SHALL mandar a senha ao cofre do portal (`POST /api/pessoas/:id/cofre`), e a ficha SHALL guardar só a situação, quem e quando (G9); "não sei a senha" e a conferência da senha lida do papel SHALL ficar na ficha do banco.

#### Scenario: Senha guardada na entrevista
- **Dado** a advogada abrindo o cofre durante a entrevista de um lead do balcão
- **Quando** digita a senha e guarda
- **Então** a senha está cifrada no cofre do portal, e a ficha mostra só que está no cofre

### Requirement: Bloco 3c · A segunda ficha fica no banco, com a seção médica só no Jurídico
A leitura da segunda ficha em papel (simulada até o scanner e a IA entrarem) e o salvar da segunda ficha SHALL gravar no servidor, com as regras do Pedro: a ficha guarda a segunda ficha sem os campos médicos, e a seção médica SHALL ficar à parte, só para quem tem `dado_saude.ver_detalhe`. A tela do Jurídico que mostra a seção médica SHALL buscá-la ao abrir, e cada leitura SHALL ficar em `acesso_dado_sensivel`; a seção médica MUST NOT ficar guardada no navegador nem ir à cópia das telas. No tablet, campo médico que volta em branco MUST NOT apagar o que já estava salvo. A leitura simulada do papel MUST NOT dar a senha do gov.br como guardada no cofre do portal.

#### Scenario: A seção médica não vai à Atendimento
- **Dado** a segunda ficha de um lead do balcão salva, com a seção médica
- **Quando** a Atendimento abre a ficha ou uma tela da Recepção
- **Então** a ficha dela vem sem os campos médicos

#### Scenario: A advogada lê a seção médica, e a leitura fica registrada
- **Dado** a mesma segunda ficha
- **Quando** a advogada abre a preparação da entrevista
- **Então** vê a seção médica, e a leitura entra em `acesso_dado_sensivel`

#### Scenario: Tablet sem a seção médica não apaga
- **Dado** a segunda ficha salva com a seção médica
- **Quando** é salva de novo no tablet com os campos médicos em branco
- **Então** a seção médica que estava salva continua

### Requirement: Bloco 4a · O "fechou" vira caso no banco do portal, com o contrato
Quando o cliente fecha (o "Fechou com o escritório?" ou a nova demanda), o servidor SHALL criar o caso em `caso` (fase atendimento, com o benefício do catálogo do portal) e o contrato do caso com o kit do benefício, e o lead SHALL virar cliente na ficha e na pessoa do portal. As condições do kit e a geração do contrato pelo modelo SHALL gravar no servidor, com as regras do Pedro (conferências, correções no histórico, campo obrigatório vazio e sobra do modelo não seguem, CPF de outra ficha não grava). Os processos e os contratos da Recepção SHALL ir à cópia das telas.

#### Scenario: O caso nasce no fechamento
- **Dado** um lead do balcão com o benefício definido pela advogada
- **Quando** a Atendimento registra que ele fechou
- **Então** o caso existe no banco do portal, em atendimento, a pessoa é cliente, e a tarefa "Preparar contrato" aparece na Central de qualquer computador

#### Scenario: Contrato gerado no servidor
- **Dado** o contrato do caso para preparar
- **Quando** a Atendimento confere e gera o contrato pelo modelo
- **Então** a versão gerada fica no contrato do banco, e o caso segue para colher a assinatura

### Requirement: Bloco 4b · A assinatura do contrato fica no banco do portal
A assinatura do contrato do caso SHALL gravar no servidor, pelo ZapSign (simulado) ou em papel na hora, com as regras do Pedro: um documento no ZapSign por kit, e pedir de novo devolve o mesmo; o link e os lembretes SHALL ficar como tentativas com a data e o canal, a próxima 3 dias depois; com a segunda tentativa sem assinatura, o caso SHALL subir para a advogada sênior (G15), com a tarefa no banco, e sair da Central do Atendimento. O retorno do assinado SHALL anexar o arquivo uma vez só, levar o contrato à leitura e encerrar a tarefa da assinatura, inclusive a da sênior. O papel na hora SHALL valer só na entrevista presencial, antes do ZapSign, e só concluir com a digitalização do assinado. Enquanto o ZapSign não é contratado, o retorno é simulado pelo botão da tela, no servidor; o retorno de verdade (webhook com o segredo) entra com a ligação ao ZapSign, e o botão sai junto.

#### Scenario: Assinatura pelo ZapSign
- **Dado** o contrato gerado de um cliente do servidor
- **Quando** a Atendimento envia para assinatura, manda o link pelo WhatsApp e o ZapSign devolve o assinado
- **Então** o contrato do banco fica assinado, com o arquivo e a data, e segue para a leitura; outra sessão vê o mesmo

#### Scenario: Limite de tentativas (G15)
- **Dado** o link enviado e, 3 dias depois, ainda sem assinatura
- **Quando** a Atendimento registra a segunda tentativa
- **Então** a tarefa "Colher assinatura · limite de tentativas" abre no banco para a advogada sênior, e o retorno assinado a encerra

#### Scenario: Papel na hora
- **Dado** o contrato gerado de um cliente com entrevista presencial
- **Quando** a Atendimento imprime o kit, digitaliza o assinado e conclui
- **Então** o contrato do banco fica assinado em papel e segue para a leitura; sem a digitalização, não conclui; com entrevista por vídeo, o papel não é oferecido
