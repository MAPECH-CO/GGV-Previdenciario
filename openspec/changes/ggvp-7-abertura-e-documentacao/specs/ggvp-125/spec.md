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

### Requirement: Bloco 3b · Telefone e e-mail: o lead troca livre; o cliente, só com a verificação
Decisão do Pedro em 08/10, na revisão: o lead, ainda sem contrato, SHALL trocar telefone e e-mail livremente, no cadastro e na edição da ficha. Para cliente, a troca de telefone e e-mail SHALL pedir a verificação da GGVP-111 (cliente verificado por chamada de vídeo ou no escritório, em contrato novo) em toda tela que muda esses campos, inclusive o cadastro: nenhuma tela contorna a trava. A regra SHALL ser uma só para a tela e o servidor.

#### Scenario: Lead troca o telefone no cadastro
- **Dado** um lead do balcão, depois da entrevista
- **Quando** a Atendimento cadastra o lead com outro telefone
- **Então** o telefone muda e o valor anterior fica no histórico, sem pedir verificação

#### Scenario: Cliente não troca o telefone pelo cadastro
- **Dado** a ficha de quem já é cliente
- **Quando** o cadastro chega com outro telefone, sem a verificação
- **Então** nada muda, a recusa fica no histórico, e a tela avisa que o telefone só muda com o cliente verificado

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

### Requirement: Bloco 4c · A leitura, a conferência e a cópia do contrato ficam no banco do portal
Depois de assinado, o contrato SHALL seguir no servidor com as regras do Pedro: a leitura da IA (ainda a de exemplo) SHALL ser feita no servidor, nunca vir da tela, e decidir entre a conferência do Atendimento e a cópia; a conferência SHALL seguir para a cópia ou voltar a preparar com o que corrigir, guardando a versão assinada no histórico; a cópia SHALL registrar a impressão, a visita marcada na agenda da ficha (a anterior fica remarcada) e a entrega, só com a confirmação, a data e quem recebeu, levando o caso ao checklist do benefício.

#### Scenario: Conferência e cópia
- **Dado** o contrato assinado em papel de um cliente do servidor
- **Quando** a IA aponta a página cortada, a Atendimento confere que está certo, imprime a cópia e registra a entrega
- **Então** o contrato do banco fica entregue e o caso segue para o checklist do benefício; outra sessão vê o mesmo

#### Scenario: Corrigir e reenviar
- **Dado** o contrato assinado com pendência
- **Quando** a Atendimento responde que não está certo, com o que corrigir
- **Então** o contrato volta a preparar no banco, a versão assinada fica no histórico, e a nova versão é gerada pelo mesmo caminho

### Requirement: Bloco 5a · A lista de arquivos da ficha fica no banco do portal
A lista de arquivos da ficha (nome, tipo, pasta, data, origem e se espera leitura) SHALL ficar na ficha do servidor, só com os dados do arquivo: o arquivo de verdade segue simulado até a ligação com o Drive. Os arquivos que o servidor cria (a imagem da ficha de atendimento e da segunda ficha lidas do papel, o contrato assinado pelo ZapSign ou em papel e a página corrigida) SHALL entrar nessa lista sem sobrescrever o nome de outro arquivo da mesma pasta, e a cópia das telas SHALL recebê-los em três vias, pelo nome: o que o servidor acrescentou ou mudou vem de lá; o que só existe aqui fica. A leitura da ficha de atendimento em papel SHALL ser feita no servidor, como a da segunda ficha; a leitura simulada não traz senha de verdade, e nada vai ao cofre (G9).

#### Scenario: O contrato assinado aparece em outro computador
- **Dado** o contrato de um cliente do servidor assinado pelo ZapSign
- **Quando** outra pessoa abre a pasta do processo em outro computador
- **Então** o arquivo assinado está lá, com a data e a origem

#### Scenario: A ficha de atendimento em papel
- **Dado** um lead do servidor
- **Quando** a Atendimento passa a ficha de atendimento em papel no scanner
- **Então** a imagem fica em Documentos pessoais no servidor, sem sobrescrever outra de mesmo nome, e nenhuma senha vai ao cofre

### Requirement: Bloco 5b · A chegada, a leitura e o arquivo dos documentos ficam no banco do portal
Os documentos que chegam pelo card ("Conferir e enviar") e pelo lote do scanner SHALL entrar na lista de arquivos da ficha do servidor, sem sobrescrever nem apagar nada, e o registro do recebimento SHALL concluir a tarefa no servidor. A leitura da IA (ainda simulada) SHALL ser feita no servidor quando o arquivo chega, uma por arquivo, guardada à parte da ficha e entregue à cópia das telas. A conferência da Documentação SHALL gravar no servidor: arquivar com o tipo e a data conferidos (o duplicado só sai com a decisão da pessoa; documento médico nunca sai), liberar da quarentena, mover para outro caso com o motivo e usar no cadastro o que a IA leu, campo a campo; o contrato assinado arquivado SHALL seguir para a verificação do contrato. O laudo que chega pelo card SHALL marcar o laudo novo e abrir "Analisar laudo novo" para o Jurídico, como na tela, sem guardar o resumo simulado (dado de saúde); a ligação com o parecer, que lê a tabela de documentos do portal, fica para quando o Drive trouxer o arquivo de verdade (decisão do Mateus, 09/10).

#### Scenario: Documento pelo card, conferido em outro computador
- **Dado** um cliente do servidor
- **Quando** a Atendimento envia o RG pelo card e a Documentação, em outro computador, confere e arquiva
- **Então** o RG fica arquivado em Documentos pessoais no servidor e a tarefa "Conferir documento" sai

#### Scenario: Lote do scanner
- **Dado** a tarefa de receber documentos em papel de um cliente do servidor
- **Quando** o lote do scanner chega e a Atendimento registra o recebimento
- **Então** os arquivos entram na pasta do servidor para a leitura, e a tarefa se conclui no servidor

#### Scenario: Quarentena
- **Dado** um documento lido com o CPF de outro cliente
- **Quando** a Documentação abre a conferência
- **Então** o documento está em quarentena e só volta à conferência com "É deste cliente", ou muda de pasta com o motivo


### Requirement: Bloco 5b+ · O arquivo do card fica guardado e o laudo novo chega ao parecer
O arquivo enviado pelo card SHALL ficar guardado no armazenamento de arquivos do portal (o mesmo da carta do INSS e dos comprovantes da perícia) até o Drive entrar, ligado à pessoa e ao caso, e só quando o hash do conteúdo confere com o do envio. O que é documento médico (laudo, relatório médico, prontuário, atestado, exame e os outros do catálogo médico) SHALL ficar sensível: o conteúdo só com `dado_saude.ver_detalhe`. O laudo, o relatório médico e o prontuário com caso em andamento SHALL entrar também como documento médico não conferido, que a tela do laudo novo e o parecer leem (pedido do Pedro, 09/10, com o ok do Mateus: substitui o "fica para o Drive" do bloco 5b).

#### Scenario: Laudo pelo card chega ao parecer
- **Dado** um cliente do servidor com caso em andamento
- **Quando** a Atendimento envia um laudo pelo card
- **Então** o PDF fica guardado como documento sensível do caso, nasce o documento médico não conferido e "Analisar laudo novo" abre a tela com ele

#### Scenario: Conteúdo diferente do anunciado
- **Dado** um envio pelo card
- **Quando** o conteúdo que chega não tem o hash do arquivo anunciado
- **Então** é recusado, e nada é guardado

### Requirement: Bloco 5c · O checklist, as boas-vindas e a cobrança ficam no banco do portal
O checklist do caso SHALL ser calculado no servidor, com as regras das telas, a partir do banco: os documentos da ficha já lidos e arquivados, do card e do scanner (a quarentena não conta), o contrato assinado, a circunstância do acidente e a condição da criança. A lista do benefício SHALL vir do kit que o escritório configura no servidor (GGVP-104), o vigente quando o caso abriu, o mesmo da liberação; uma tabela única SHALL traduzir os nomes de documento do kit para os das telas, sem mudar o nome que o card grava. As listas de exemplo ficam só no modo exemplo; a lista da entrevista (GGVP-46) e o prazo do juiz ou do INSS na cobrança ficam para as histórias deles. A conferência SHALL gravar no servidor a situação calculada, nunca a marcada à mão, e a incompleta SHALL abrir a cobrança. A liberação ao Jurídico (G1) do caso que veio da Recepção SHALL conferir esse mesmo checklist: a última conferência completa e o checklist de agora completo (decisão do Mateus, 09/10). Por enquanto o portal não manda as boas-vindas (decisão do Mateus, 09/10): conferido o checklist de cliente novo, a Atendimento SHALL receber na Central "Enviar boas-vindas", com a mensagem pronta para copiar; ela manda por fora e marca "Já enviei", que SHALL ficar no servidor, no histórico e nos contatos. Quem já era cliente MUST NOT receber, e o servidor MUST recusar a segunda vez. Cada tentativa da cobrança, o adiamento e a decisão SHALL gravar no servidor; a decisão MUST ser da Sênior (ação nova na matriz), no limite (G15) e com justificativa. A cobrança SHALL fechar sozinha quando nada mais falta. O checklist calculado, os registros das boas-vindas e as cobranças SHALL ir na cópia das telas, de onde saem as tarefas da Central.

#### Scenario: Checklist incompleto, cobrança em outro computador
- **Dado** um caso do servidor com documentos pendentes
- **Quando** a Documentação confere o checklist
- **Então** a conferência fica no servidor, incompleta, e a Atendimento, em outro computador, recebe "Cobrar documento" com o que falta

#### Scenario: O kit do escritório com os nomes das telas
- **Dado** o kit do LOAS com "documento_de_identidade" e um RG enviado pelo card e arquivado
- **Quando** o checklist é calculado e a Documentação libera ao Jurídico
- **Então** o RG conta como o documento de identidade, e a liberação só recusa pelo que falta de verdade

#### Scenario: Boas-vindas pela Atendimento, uma vez
- **Dado** um cliente novo com o checklist conferido
- **Quando** a Atendimento manda a mensagem por fora e marca "Já enviei"
- **Então** a tarefa "Enviar boas-vindas" sai, o envio fica no histórico e nos contatos, e o servidor recusa a segunda vez

#### Scenario: A decisão no limite é da Sênior
- **Dado** uma cobrança com duas tentativas sem resposta
- **Quando** quem não é a Sênior tenta decidir
- **Então** o servidor recusa; a Sênior decide com justificativa, e a decisão volta ao Atendimento

#### Scenario: Chegou tudo
- **Dado** uma cobrança aberta
- **Quando** o último documento pendente é arquivado
- **Então** a cobrança fecha sozinha no servidor

### Requirement: Bloco 5d · O documento de qualquer canal confere as pendências
Ao arquivar, cada documento arquivado SHALL ficar no registro de documentos do portal com o tipo conferido pela pessoa, quem conferiu e quando: o do card e do chat no registro que já existe (pelo conteúdo); o do scanner, cujo arquivo fica no Drive (ainda simulado), num registro novo que aponta para o Drive, sem o conteúdo (decisão do Mateus, 09/10). O documento médico MUST ficar sensível e, com caso, entrar como documento médico não conferido, para o parecer; a sensibilidade nunca volta atrás sozinha. O laudo, o relatório médico e o prontuário de qualquer canal SHALL abrir "Analisar laudo novo" para o Jurídico, uma tarefa aberta por ficha: na chegada pelo card, pelo chat e pelo lote do scanner, e no arquivamento, quando a pessoa confere como laudo o que chegou com outro tipo. Conferido completo o checklist do caso da Recepção, "Liberar ao Jurídico" (D1.24) SHALL nascer no servidor para a Documentação, uma por caso, e fechar na liberação; a tela MUST NOT repetir a tarefa do caso do servidor. O item da exigência do INSS e do juiz SHALL ganhar o tipo de documento esperado (opcional, do catálogo das telas; a IA sugere), e o documento arquivado desse tipo, no caso com a exigência aberta, SHALL dar baixa no item sozinho: cumprido, com o documento como prova e quem conferiu o tipo (decisão do Mateus, 09/10). A perícia SHALL casar o kit pelo tipo do registro, de qualquer canal. O laudo ou o relatório que chega com o complemento do médico aberto SHALL registrar a chegada e parar a cobrança do médico até o parecer; o parecer Suficiente encerra, como hoje (GGVP-29, CA5). A cobrança e o checklist da Recepção casam pelo tipo do documento lido e arquivado, também o do scanner. A entrega é em duas partes, cada uma com o seu "Agora ok?": a main e o fluxo da Recepção; depois a baixa na exigência, na perícia e no complemento.

#### Scenario: O scanner atende a cobrança
- **Dado** um caso do servidor com a cobrança aberta pelo comprovante de residência
- **Quando** o comprovante chega pelo lote do scanner e a Documentação arquiva
- **Então** a cobrança fecha sozinha, e o comprovante fica no registro de documentos com o tipo conferido

#### Scenario: O laudo de qualquer canal
- **Dado** um documento que chegou pelo scanner com outro tipo
- **Quando** a Documentação confere como laudo e arquiva
- **Então** nasce "Analisar laudo novo" para o Jurídico, o registro fica sensível e o documento médico entra para o parecer

#### Scenario: "Liberar ao Jurídico" nasce no servidor
- **Dado** um caso da Recepção com o checklist completo
- **Quando** a Documentação confere o checklist
- **Então** nasce "Liberar ao Jurídico" para a Documentação, uma só, que fecha na liberação

#### Scenario: Baixa na exigência
- **Dado** uma exigência aberta com um item que espera o comprovante de residência
- **Quando** o comprovante é arquivado no caso
- **Então** o item fica cumprido, com o documento como prova e quem conferiu

#### Scenario: Complemento do médico
- **Dado** um complemento aberto
- **Quando** chega um laudo novo
- **Então** a cobrança do médico para até o parecer, e o parecer Suficiente encerra

### Requirement: Bloco 6 · A primeira liberação ao Jurídico vai ao servidor
Para o caso do servidor, "Liberar ao Jurídico" (D1.24, Documentação) SHALL seguir pela rota `POST /api/casos/:id/liberacao` (GGVP-127, #20), que confere de novo no servidor o perfil, o checklist (G1) e o parecer (G17), fecha a tarefa D1.24 e abre "Conferir antes do INSS" para a Sênior; a recusa do servidor MUST aparecer na tela, e nada é gravado aqui. A fila da Sênior desse caso vem do servidor, sem a cópia local repetir a tarefa (pedido do Pedro, 09/10). A tarefa D1.24 nasce do checklist conferido completo, no bloco 5d.

#### Scenario: Liberar o caso do servidor
- **Dado** um caso do servidor com o checklist completo e o parecer em ordem
- **Quando** a Documentação confere e libera
- **Então** o servidor fecha a D1.24 e abre "Conferir antes do INSS" para a Sênior, que vê uma tarefa só

#### Scenario: O servidor recusa
- **Dado** um caso do servidor com o parecer pendente no servidor
- **Quando** a Documentação libera
- **Então** a tela mostra o motivo do G17, e o caso não fica liberado
