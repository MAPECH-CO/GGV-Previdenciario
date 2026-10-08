# Spec Delta · ggvp-40 · Entrevistar com gravação

## Purpose

A advogada grava o áudio da entrevista no próprio portal, para não depender de anotação e deixar a IA trabalhar sobre o que foi dito. Telas do Figma: step_D1.09 `14:65`, Atendimento · Reunião com transcrição `73:560` e o roteiro do Overlay · Entrevista `1581:348`. Passo D1.09 do Miro. Portões G9 e G10.

## ADDED Requirements

### Requirement: CA1 · Gravar lembra o aviso
Ao clicar em Gravar, o portal SHALL lembrar de avisar o cliente que a conversa será gravada.

#### Scenario: CA1 · Clicar em Gravar
- **Dado** uma entrevista aberta
- **Quando** clico em Gravar
- **Então** o portal lembra de avisar o cliente que a conversa será gravada

### Requirement: CA2 · O áudio fica no card do cliente
Encerrada a gravação, o áudio SHALL ficar no card do cliente.

#### Scenario: CA2 · Salvar a gravação
- **Dado** a gravação encerrada
- **Quando** salvo
- **Então** o áudio fica no card do cliente

### Requirement: CA3 · A senha dita vai ao cofre, não ao texto
Senha do gov.br dita na conversa SHALL ir para o cofre e MUST NOT ficar no texto da transcrição (G9).

#### Scenario: CA3 · Senha dita na conversa
- **Dado** que a senha do gov.br foi dita
- **Quando** a transcrição é gerada
- **Então** a senha vai para o cofre e não fica no texto

### Requirement: CA4 · Só grava depois do aviso registrado
A gravação SHALL começar só depois de registrado o aviso de gravação ao cliente, com o horário do aviso (G10).

#### Scenario: CA4 · Começar a gravar
- **Dado** uma entrevista aberta
- **Quando** clico em Gravar
- **Então** a gravação só começa depois de registrado o aviso, com o horário

### Requirement: CA5 · Cada ação registrada; ao encerrar, transcrição e "Cadastrar lead"
Pausar, retomar e encerrar SHALL ficar registrados; ao encerrar, o áudio MUST ir para a transcrição (D1.11) e a advogada recebe "Cadastrar lead" (D1.10).

#### Scenario: CA5 · Pausar, retomar e encerrar
- **Dado** a gravação em curso
- **Quando** pauso, retomo ou encerro
- **Então** cada ação fica registrada e, ao encerrar, o áudio vai para a transcrição e a advogada recebe "Cadastrar lead"

### Requirement: CA6 · O cofre pausa a gravação
Acionado o cofre, a gravação SHALL pausar até a senha ser salva, e o trecho MUST NOT entrar no áudio nem na transcrição.

#### Scenario: CA6 · O cliente vai dizer a senha
- **Dado** que o cliente vai informar a senha do gov.br
- **Quando** a advogada aciona o cofre
- **Então** a gravação pausa até a senha ser salva e o trecho fica fora do áudio e da transcrição

### Requirement: CA7 · Teste com senhas de teste faladas
Uma gravação de teste com senhas de teste faladas SHALL gerar texto final sem nenhuma delas (teste automático).

#### Scenario: CA7 · Senhas de teste
- **Dado** uma gravação de teste com senhas de teste faladas
- **Quando** a transcrição termina
- **Então** o texto final não contém nenhuma delas

### Requirement: CA8 · Falha avisada na hora e "sem áudio"
Na falha da gravação, a advogada SHALL ser avisada na hora e MAY registrar a entrevista como "sem áudio".

#### Scenario: CA8 · A gravação falhou
- **Dado** uma gravação que falhou
- **Quando** a falha acontece
- **Então** a advogada é avisada na hora e pode registrar a entrevista como "sem áudio"

### Requirement: CA9 · Áudio gravado fora do portal
O portal SHALL aceitar qualquer formato de áudio subido na entrevista do cliente e mandar para a transcrição.

#### Scenario: CA9 · Subir a ligação do Chatwoot
- **Dado** um áudio já gravado fora do portal
- **Quando** subo o arquivo na entrevista do cliente
- **Então** o portal aceita qualquer formato de áudio e manda para a transcrição

### Requirement: CA10 · Sem limite de tamanho
Áudio longo SHALL ser aceito sem limite de tamanho; o portal MUST dividir em partes para transcrever e juntar o texto no final.

#### Scenario: CA10 · Entrevista de uma hora
- **Dado** um áudio longo
- **Quando** é enviado
- **Então** não há limite de tamanho e o texto das partes é juntado no final

### Requirement: CA11 · A tela da entrevista em andamento
A tela SHALL ter Pausar, "Encerrar e gerar resumo", a transcrição ao vivo e o roteiro marcado pela IA; "Definir o benefício" MUST liberar só depois de encerrar.

#### Scenario: CA11 · Durante a entrevista
- **Dado** a entrevista em andamento
- **Quando** a advogada usa a tela
- **Então** tem Pausar, "Encerrar e gerar resumo", a transcrição ao vivo e o roteiro, e "Definir o benefício" só libera depois de encerrar

### Requirement: CA12 · Sem internet, nenhum áudio se perde
Sem internet, o áudio SHALL ficar guardado no computador; ao encerrar, o portal avisa "sem internet" e transcreve quando a conexão voltar, MUST NOT mandar o áudio duas vezes.

#### Scenario: CA12 · A internet cai
- **Dado** que a internet cai no meio da entrevista
- **Quando** continuo gravando e encerro
- **Então** o portal avisa "sem internet" e transcreve quando a conexão volta, sem mandar o áudio duas vezes

### Requirement: CA13 · Guardado para sempre
O áudio de entrevista SHALL ficar guardado para sempre no portal.

#### Scenario: CA13 · O tempo passa
- **Dado** um áudio de entrevista guardado
- **Quando** o tempo passa
- **Então** ele não é apagado
