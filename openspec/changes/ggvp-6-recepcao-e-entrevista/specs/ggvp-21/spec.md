# Spec Delta · ggvp-21 · Confirmar o agendamento do lead

## Purpose

O Atendimento confirma a entrevista do lead por mensagem ou ligação, a partir da Central ou da agenda, para reduzir faltas e chegar à entrevista com a ficha preenchida. Tela do Figma: step_D1.04 `10:33`, com a agenda (`1941:2`, `1941:401`, `2164:95`, `2164:280`) e a Central do Atendimento (`11:2`). Passo D1.04 do Miro.

## ADDED Requirements

### Requirement: CA1 · Contato com "Ligar" e "Chatwoot"
A tarefa de confirmação SHALL mostrar o contato do lead e os botões "Ligar" e "Chatwoot" (com o logo do Chatwoot); o Chatwoot MUST abrir a conversa do lead com a mensagem de confirmação pronta, para a pessoa conferir e enviar. Aqui o Chatwoot e a ligação são simulados.

#### Scenario: CA1 · Abrir a tarefa de confirmação
- **Dado** um lead com data marcada
- **Quando** abro a tarefa de confirmação
- **Então** vejo o contato e os botões "Ligar" e "Chatwoot"; o Chatwoot abre a conversa do lead com a mensagem de confirmação pronta, para conferir e enviar

### Requirement: CA2 · Sem ficha, fica a pendência da ficha em papel
Ao confirmar um lead que ainda não preencheu a ficha, o portal SHALL abrir a pendência para o próprio lead preencher a ficha de atendimento em papel (no balcão ou com quem o captou) e ela ser escaneada antes da entrevista.

#### Scenario: CA2 · Confirmar sem ficha
- **Dado** que o lead ainda não preencheu a ficha
- **Quando** confirmo
- **Então** fica a pendência "Preencher ficha" na Central do Atendimento, para a ficha em papel ser preenchida e escaneada antes da entrevista

### Requirement: CA3 · Com ficha, a advogada prepara a conversa
Ao confirmar um lead que já tem ficha, a advogada SHALL receber o caso em "Preparar a conversa" (GGVP-32).

#### Scenario: CA3 · Confirmar com ficha
- **Dado** que o lead já tem ficha
- **Quando** confirmo
- **Então** o Jurídico recebe a tarefa "nome · Preparar entrevista"

### Requirement: CA4 · Data, hora, contato e ficha à vista
A tarefa de confirmação SHALL mostrar a data e a hora da entrevista, o contato do lead e se a ficha já foi preenchida.

#### Scenario: CA4 · Ver o que importa
- **Dado** um lead com data marcada
- **Quando** abro a tarefa de confirmação
- **Então** vejo a data e a hora, o contato do lead e se a ficha já foi preenchida

### Requirement: CA5 · Registrar o resultado do contato
O resultado ("Confirmou a entrevista" ou "Sem resposta") SHALL gravar a data e a hora, o canal (mensagem ou ligação) e quem registrou; "Confirmar entrevista" MUST habilitar só com as decisões respondidas e um contato feito.

#### Scenario: CA5 · Registrar o resultado
- **Dado** o contato feito
- **Quando** registro o resultado
- **Então** ficam gravados a data e a hora, o canal e quem registrou, e "Confirmar entrevista" só habilita com as decisões respondidas

### Requirement: CA6 · Duas tentativas, três dias entre elas, depois a sênior
"Sem resposta" SHALL ficar no histórico e a tela MUST mostrar o número da tentativa. São 2 tentativas, com 3 dias entre elas; sem resposta depois da segunda, a tarefa passa para a advogada sênior. Os números são regra em código com teste.

#### Scenario: CA6 · Primeira tentativa sem resposta
- **Dado** "Sem resposta" na primeira tentativa
- **Quando** registro a tentativa
- **Então** ela fica no histórico, a tela mostra "Tentativa 1 de 2" e a próxima fica para 3 dias depois

#### Scenario: CA6 · Segunda tentativa sem resposta
- **Dado** "Sem resposta" na segunda tentativa
- **Quando** registro a tentativa
- **Então** a tarefa passa para a advogada sênior e sai da Central do Atendimento

### Requirement: CA7 · A pendência da ficha vence no horário da entrevista
A pendência de preenchimento aberta na confirmação de um lead sem ficha SHALL ter como prazo o horário da entrevista.

#### Scenario: CA7 · Prazo da pendência
- **Dado** a confirmação de um lead sem ficha
- **Quando** registro
- **Então** a pendência "Preencher ficha" fica aberta, com prazo no horário da entrevista

### Requirement: CA8 · A mensagem traz o que levar
A mensagem de confirmação SHALL trazer o que o cliente deve levar para o benefício de interesse (no BPC/LOAS: RG e CPF de todos da casa, comprovante de renda e CadÚnico; sem CadÚnico, ir ao CRAS antes) e MUST citar os quatro documentos que mais travam os casos: biometria, CadÚnico, senha do Meu INSS e comprovantes de gastos.

#### Scenario: CA8 · Mensagem do LOAS
- **Dado** o benefício de interesse LOAS Idoso
- **Quando** a mensagem de confirmação é montada
- **Então** ela traz o que levar do BPC/LOAS e cita biometria, CadÚnico, senha do Meu INSS e comprovantes de gastos
