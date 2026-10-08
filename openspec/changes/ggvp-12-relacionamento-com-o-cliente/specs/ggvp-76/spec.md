# Spec Delta · ggvp-76 · Registrar a conversa por telefone ou presencial

## Purpose

O Atendimento ou a advogada grava a conversa no escritório ou sobe a gravação da ligação no card do lead ou do cliente,
para que a dúvida ou a informação nova do cliente não se perca. Passo D5.01 do Miro (canal da conversa: telefone ou
presencial; guardar o áudio no card). Respostas do Lucas de 06/10: os áudios ficam guardados; o lead sem processo tem a
conversa na tela dele, que é a mesma do cliente; Atendimento e Jurídico conduzem e gravam; WhatsApp e vídeo saem. Fluxo
presencial do Pedro de 07/10 (CA9). Figma: Overlay · Registrar conversa `2144:2`, step_D5.01 `2281:2`, Transcrições
`1626:2`. Contrato na `design.md`, seção GGVP-76.

## ADDED Requirements

### Requirement: CA1 · Gravar lembra o aviso
Na conversa presencial, "Gravar" SHALL lembrar de avisar que a conversa será gravada, e o aviso SHALL ficar na gravação (G10).

#### Scenario: CA1 · Clicar em Gravar
- **Dado** uma conversa presencial
- **Quando** clico em Gravar
- **Então** o portal lembra de avisar que a conversa será gravada e o aviso fica na gravação (G10)

### Requirement: CA2 · A ligação gravada fica no card
O arquivo da ligação gravada SHALL ficar no card do lead ou do cliente.

#### Scenario: CA2 · Subir o arquivo
- **Dado** uma ligação gravada
- **Quando** subo o arquivo
- **Então** ele fica no card do lead ou cliente

### Requirement: CA3 · Canal e com quem falou
Ao abrir o registro de um lead ainda não aceito ou de um cliente com o caso em análise, a pessoa SHALL escolher o canal, telefone (subir a gravação) ou presencial (conversar e gravar), e a tela SHALL perguntar com quem falou: cliente, familiar ou contato de apoio, médico ou clínica. WhatsApp e vídeo MUST NOT aparecer.

#### Scenario: CA3 · Abrir o registro
- **Dado** um lead ainda não aceito ou um cliente com o caso em análise que procura o escritório
- **Quando** abro o registro
- **Então** escolho o canal, telefone ou presencial, e a tela pergunta com quem falei; WhatsApp e vídeo não entram

### Requirement: CA4 · Gravar agora, anexar ou só escrever
Com o registro aberto, a pessoa SHALL poder gravar e transcrever agora, com o aviso ao cliente antes (G10), anexar o áudio de uma ligação já feita ou fazer só o registro escrito.

#### Scenario: CA4 · Escolher a gravação
- **Dado** o registro aberto
- **Quando** escolho a gravação
- **Então** posso gravar e transcrever agora com o aviso antes, anexar o áudio de uma ligação já feita ou fazer só o registro escrito

### Requirement: CA5 · Só grava depois do aviso
A gravação presencial SHALL começar só depois do aviso registrado, e a hora do aviso SHALL ficar guardada. O servidor MUST recusar começar sem o aviso.

#### Scenario: CA5 · Tentar começar
- **Dado** uma gravação presencial
- **Quando** tento começar
- **Então** a gravação só começa depois do aviso registrado, e a hora do aviso fica guardada

### Requirement: CA6 · O áudio fica no card e a transcrição começa
Ao terminar a gravação, o sistema SHALL guardar o áudio no card do lead ou cliente e começar a transcrição (GGVP-80).

#### Scenario: CA6 · A gravação termina
- **Dado** a gravação salva
- **Quando** termina
- **Então** o sistema guarda o áudio no card do lead ou cliente e a transcrição começa

### Requirement: CA7 · O registro nas Transcrições
O registro salvo SHALL aparecer nas transcrições do processo com data, canal, quem registrou e se tem áudio ("só registro" quando não tem).

#### Scenario: CA7 · Abrir as transcrições
- **Dado** o registro salvo
- **Quando** abro as transcrições do processo
- **Então** ele aparece com data, canal, quem registrou e se tem áudio ("só registro" quando não tem)

### Requirement: CA8 · A tarefa "Registrar conversa" na Central
A tarefa de registrar conversa SHALL aparecer na Central com o nome do cliente em negrito e "Registrar conversa".

#### Scenario: CA8 · A tarefa aparece
- **Dado** uma tarefa de registrar conversa
- **Quando** aparece na Central
- **Então** o título é o nome do cliente em negrito + "Registrar conversa"

### Requirement: CA9 · Iniciar conversa no card e finalizar com o que mudou
No card do lead ou cliente, "Iniciar conversa" SHALL abrir a escolha entre "Anexar arquivo" e "Transcrição em tempo real". A transcrição em tempo real SHALL gravar e transcrever com o mesmo motor da entrevista, depois do aviso (G10). "Finalizar conversa" SHALL encerrar, e a IA SHALL mostrar o que mudou, o que precisa atualizar, os dados novos e uma observação; tudo SHALL ficar no histórico do contato.

#### Scenario: CA9 · Conversa presencial pelo card
- **Dado** um lead ou cliente que chega ao escritório
- **Quando** a pessoa o procura nos registros e abre o card dele
- **Então** "Iniciar conversa" abre a escolha entre "Anexar arquivo" e "Transcrição em tempo real"; a transcrição em tempo real grava e transcreve com o mesmo motor da entrevista, depois do aviso (G10); "Finalizar conversa" encerra, e a IA mostra o que mudou, o que precisa atualizar, os dados novos e uma observação, e tudo fica no histórico do contato
