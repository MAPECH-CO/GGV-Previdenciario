# Spec Delta · ggvp-17 · Receber documento entregue no balcão

## Purpose

A Documentação recebe o documento que o cliente trouxe ao balcão, em qualquer fase do caso: papel vai ao scanner, que guarda o PDF na pasta do cliente no Drive; digital entra pelo card. O Atendimento sobe o laudo novo que o cliente ou o médico mandou, pela ficha ou pelo chat, e o Jurídico recebe para analisar sem que o Atendimento veja o conteúdo. Telas do Figma: step_D1.02 `10:440`, Overlay · Subir documento `2224:2`, Cliente · dados (Atendimento) `73:199`, chat "atualizar laudo" `2052:2`. Passo D1.02 do Miro.

## ADDED Requirements

### Requirement: CA1 · "Entregar documento" cria a tarefa da Documentação
Quando o Atendimento escolhe "Entregar documento" no balcão, a Documentação SHALL receber a tarefa com o nome do cliente.

#### Scenario: CA1 · Cliente que veio entregar documento
- **Dado** um cliente que veio entregar documento
- **Quando** o Atendimento escolhe "Entregar documento"
- **Então** a Documentação recebe a tarefa com o nome do cliente

### Requirement: CA2 · O papel vira PDF pesquisável na pasta do cliente
O documento em papel SHALL passar pela automação do balcão que já existe (scanner → servidor → n8n), que deixa o PDF pesquisável, separa os documentos e guarda na pasta do cliente no Drive do escritório, com o nome no padrão "Tipo - Nome - data". O arquivo MUST aparecer no card do cliente e no do processo e seguir para a leitura (GGVP-81). Aqui a automação é simulada.

#### Scenario: CA2 · Documento em papel no scanner
- **Dado** o documento em papel
- **Quando** passa no scanner
- **Então** a automação do balcão que já existe (scanner → servidor → n8n) deixa o PDF pesquisável, separa os documentos e guarda na pasta do cliente no Drive do escritório, com o nome no padrão "Tipo - Nome - data"
- **E** o arquivo aparece no card do cliente e no do processo e segue para a leitura (GGVP-81)

### Requirement: CA3 · Em qualquer fase, a tarefa vem ligada ao caso
O cliente pode entregar documento em qualquer fase do caso, e não só na abertura; a tarefa "Receber documento" da Documentação MUST vir ligada ao caso em andamento.

#### Scenario: CA3 · Documento entregue no meio do caso
- **Dado** um cliente em qualquer fase do caso, e não só na abertura
- **Quando** ele entrega documento no balcão
- **Então** a Documentação recebe a tarefa "Receber documento" ligada ao caso em andamento

### Requirement: CA4 · Dono incerto vai para "A REVISAR"
Papel cujo dono a automação não identifica com certeza (sem CPF escrito, duas pastas parecidas ou pilha com mais de um cliente) SHALL ir para a pasta "A REVISAR", com o motivo na planilha "Painel da digitalização", e a Documentação arrasta o arquivo para a pasta certa. Documento MUST NOT ir para a pasta de outro cliente.

#### Scenario: CA4 · Lote sem dono certo
- **Dado** um papel cujo dono a automação não identifica com certeza (sem CPF escrito, duas pastas parecidas ou pilha com mais de um cliente)
- **Quando** o lote termina
- **Então** ele vai para a pasta "A REVISAR", com o motivo na planilha "Painel da digitalização", e a Documentação arrasta o arquivo para a pasta certa
- **E** documento nunca vai para a pasta de outro cliente

### Requirement: CA5 · "Registrar" só depois de conferir o tipo
"Registrar" MUST ficar desabilitado até a Documentação marcar que conferiu o tipo de cada documento.

#### Scenario: CA5 · Registrar os documentos recebidos
- **Dado** os documentos recebidos
- **Quando** a Documentação vai registrar
- **Então** "Registrar" só habilita depois que ela marca que conferiu o tipo de cada documento

### Requirement: CA6 · Laudo novo marca a ficha e o processo
Quando o Atendimento sobe no card do cliente um laudo novo que o cliente ou o médico mandou, em qualquer fase do caso, a ficha do cliente e a página do processo SHALL passar a mostrar "Laudo novo".

#### Scenario: CA6 · Subir o laudo novo
- **Dado** um laudo novo que o cliente ou o médico mandou, em qualquer fase do caso
- **Quando** o Atendimento sobe o arquivo no card do cliente
- **Então** a ficha do cliente e a página do processo passam a mostrar "Laudo novo"

### Requirement: CA7 · A IA resume e a advogada recebe a tarefa
Confirmada a subida do laudo novo, a IA SHALL ler, comparar com o que já está no processo e resumir, e a advogada responsável MUST receber a tarefa "Analisar laudo novo" (D1.21M). A conferência e o parecer do G17 ficam no GGVP-20. Aqui a IA é simulada.

#### Scenario: CA7 · Confirmar a subida do laudo
- **Dado** o laudo novo no card
- **Quando** o Atendimento confirma a subida
- **Então** a IA lê, compara com o que já está no processo e resume, e a advogada responsável recebe a tarefa "Analisar laudo novo" (`D1.21M`; a conferência e o parecer do G17 ficam no GGVP-20)

### Requirement: CA8 · Pelo chat, só depois de "Confirmar"
Quando o Atendimento anexa o laudo no chat e pede para atualizar, e o chat identifica o cliente, o chat SHALL mostrar o card de confirmação (subir na pasta do cliente, marcar "Laudo novo" na ficha e no processo, avisar a advogada) e MUST executar só depois de "Confirmar".

#### Scenario: CA8 · Atualizar o laudo pelo chat
- **Dado** o Atendimento que anexou o laudo no chat e pediu para atualizar
- **Quando** o chat identifica o cliente
- **Então** mostra o card de confirmação (subir na pasta do cliente, marcar "Laudo novo" na ficha e no processo, avisar a advogada) e só executa depois de "Confirmar"

### Requirement: CA9 · O Atendimento vê que foi, não o conteúdo
Com um laudo novo enviado, a ficha na visão do Atendimento SHALL mostrar que o laudo foi para o Jurídico e aguarda a análise, e MUST NOT mostrar o conteúdo do laudo nem o resumo da IA.

#### Scenario: CA9 · Abrir a ficha depois do laudo novo
- **Dado** um laudo novo enviado
- **Quando** o Atendimento abre a ficha do cliente
- **Então** vê que o laudo foi para o Jurídico e aguarda a análise, sem ver o conteúdo do laudo nem o resumo da IA

### Requirement: CA10 · Papel ou digital, e "CONFERIR O PAPEL" antes de devolver
Ao receber o documento, a Documentação SHALL escolher "Papel: vai ao scanner" (uma pilha por cliente, de até umas 20 folhas) ou "Digital: anexar ao card", e MUST devolver o original só depois de conferir o aviso "CONFERIR O PAPEL".

#### Scenario: CA10 · Receber no balcão
- **Dado** o cliente no balcão
- **Quando** a Documentação recebe o documento
- **Então** escolhe "Papel: vai ao scanner" (uma pilha por cliente, de até umas 20 folhas) ou "Digital: anexar ao card", e só devolve o original depois de conferir o aviso "CONFERIR O PAPEL"

### Requirement: CA11 · Uma pasta só por cliente
Quando o portal ou o scanner vai guardar um documento de um cliente que já tem pasta, SHALL usar a pasta que já existe e MUST NOT criar uma segunda: procura pelo CPF escrito dentro dos documentos da pasta, depois pelo nome igual ao da pasta e por fim pelo nome com uma letra de diferença. Pasta nova MUST nascer só com o CPF do cliente escrito no papel.

#### Scenario: CA11 · Guardar documento de quem já tem pasta
- **Dado** um cliente que já tem pasta
- **Quando** o portal ou o scanner vai guardar um documento
- **Então** usa a pasta que já existe e nunca cria uma segunda: procura pelo CPF escrito dentro dos documentos da pasta, depois pelo nome igual ao da pasta e por fim pelo nome com uma letra de diferença
- **E** pasta nova só nasce com o CPF do cliente escrito no papel

### Requirement: CA12 · "Conferir e enviar": PDF, JPG ou PNG de até 20 MB
Arquivos soltos na área "Solte os documentos aqui" (na ficha ou no processo) SHALL abrir a janela "Conferir e enviar", que aceita PDF, JPG ou PNG de até 20 MB cada; a IA diz o tipo de cada arquivo e a pessoa MUST conferir antes de enviar para a pasta do cliente no Drive. Aqui a IA e o Drive são simulados.

#### Scenario: CA12 · Soltar arquivos na área tracejada
- **Dado** arquivos soltos na área tracejada "Solte os documentos aqui" (na ficha ou no processo)
- **Quando** solto
- **Então** a janela "Conferir e enviar" aceita PDF, JPG ou PNG de até 20 MB cada, a IA diz o tipo de cada arquivo e a pessoa confere antes de enviar para a pasta do cliente no Drive

### Requirement: CA13 · Nada é apagado nem sobrescrito
Arquivo com o mesmo nome de outro que já está na pasta SHALL entrar como "(2)"; nada MUST ser apagado nem sobrescrito. O mesmo arquivo enviado duas vezes SHALL ficar marcado como repetido, e foto é aceita mesmo se não virar PDF.

#### Scenario: CA13 · Enviar arquivo com nome que já existe
- **Dado** um arquivo com o mesmo nome de outro que já está na pasta
- **Quando** é enviado
- **Então** entra como "(2)": nada é apagado nem sobrescrito
- **E** o mesmo arquivo enviado duas vezes fica marcado como repetido, e foto é aceita mesmo se não virar PDF

### Requirement: CA14 · A pasta inteira no card do cliente
O card do cliente SHALL mostrar a pasta inteira (Documentos pessoais e uma subpasta por processo) e o card do processo SHALL mostrar os Documentos pessoais e a subpasta daquele processo.

#### Scenario: CA14 · Abrir os documentos
- **Dado** a pasta do cliente
- **Quando** abro os documentos
- **Então** o card do cliente mostra a pasta inteira (Documentos pessoais e uma subpasta por processo) e o card do processo mostra os Documentos pessoais e a subpasta daquele processo

### Requirement: CA15 · Ficha do scanner sem telefone
Ficha criada pela automação do scanner chega sem telefone, porque o scanner não lê telefone; o portal SHALL aceitá-la e MUST mostrar "completar telefone" para o Atendimento.

#### Scenario: CA15 · Ficha nova vinda do scanner
- **Dado** uma ficha criada pela automação do scanner
- **Quando** ela chega sem telefone (o scanner não lê telefone)
- **Então** o portal aceita e mostra "completar telefone" para o Atendimento
