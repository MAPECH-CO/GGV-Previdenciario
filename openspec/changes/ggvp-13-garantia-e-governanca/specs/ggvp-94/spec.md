# Spec Delta · ggvp-94

## Purpose

Tarefa com laço, lembrete e escalonamento (G15), nos laços que o portal já tem: a exigência do juiz (D3a.03), as pendências do despacho (D3.04) e a cobrança da exigência do INSS (D2.05). O lembrete é a tarefa na Central do setor, na data do próximo lembrete. Respostas do Lucas (02/10): 3 tentativas com 3 dias úteis entre elas; com prazo do juiz ou do INSS, o prazo manda e as tentativas se comprimem para caber nele; passou do limite, sobe para a Sênior. As esperas por quem é de fora (CA5) são proposta do Fernando, não aprovada, e ficam fora. O portal não envia mensagem sozinho: o lembrete sai pela Central.

## ADDED Requirements

### Requirement: CA1 · Lembrete no intervalo
Passado o intervalo sem conclusão, o responsável SHALL receber o lembrete na Central do setor (a tarefa fica para hoje), e cada tentativa registrada SHALL contar no card. O intervalo MUST ser de 3 dias úteis (parâmetro `cobranca.intervalo_dias`, Q1, resposta do Lucas de 02/10); com prazo, as tentativas que faltam se comprimem para caber antes dele, com pelo menos 1 dia útil, e o lembrete MUST NOT passar do prazo.

#### Scenario: CA1 · O intervalo passa
- **Dado** uma tarefa de cobrança criada
- **Quando** o intervalo configurado passa sem conclusão
- **Então** o responsável recebe um lembrete e a tentativa conta no card

### Requirement: CA2 · No limite, sobe com o histórico
Atingido o limite de tentativas (parâmetro `cobranca.limite`, 3), a tarefa SHALL aparecer na fila da Sênior com o histórico das tentativas. Na perícia, a remarcação sobe para a advogada responsável (épico Perícia).

#### Scenario: CA2 · A última tentativa falha
- **Dado** uma tarefa que atingiu o limite de tentativas
- **Quando** a última tentativa falha
- **Então** a tarefa aparece na fila da sênior (ou da advogada responsável, na perícia) com o histórico das tentativas

### Requirement: CA3 · Cada tentativa com data, canal e resultado
Cada tentativa registrada SHALL aparecer na tarefa com a data, o canal e o resultado.

#### Scenario: CA3 · Abrir a tarefa
- **Dado** que a pessoa registra cada tentativa
- **Quando** abro a tarefa
- **Então** vejo data, canal e resultado de cada uma

### Requirement: CA4 · O caso espera os setores
Com vários setores acionados, o caso SHALL continuar esperando enquanto um deles não subir o card, e SHALL mostrar quem falta.

#### Scenario: CA4 · Um sobe, outro não
- **Dado** vários setores acionados no mesmo caso
- **Quando** um sobe o card e outro não
- **Então** o caso continua esperando e mostra quem falta (a "espera os setores acionados" do BPMN)

### Requirement: CA5 · [proposta] Espera por quem é de fora
A espera por cliente, INSS, perito ou Justiça como tarefa com prazo e lembrete é proposta do Fernando, não aprovada, e MUST NOT entrar nesta entrega.

#### Scenario: CA5 · Espera de fora
- **Dado** uma espera por alguém de fora do escritório
- **Quando** ela começa
- **Então** vira tarefa com prazo e lembrete; quando o evento chega (o cliente entrega, o INSS decide, a Justiça publica), o fluxo retoma no passo do escritório e os lembretes param (proposta do Fernando, não aprovada)

### Requirement: CA6 · Data do próximo lembrete
A cobrança aberta SHALL mostrar a data do próximo lembrete.

#### Scenario: CA6 · Abrir a cobrança
- **Dado** uma cobrança aberta
- **Quando** abro a tarefa
- **Então** vejo a data do próximo lembrete

### Requirement: CA7 · Chegou, a cobrança encerra
Registrado o documento ou a informação, a cobrança SHALL se encerrar e os lembretes seguintes MUST ser cancelados: tarefa concluída não aparece na Central.

#### Scenario: CA7 · O documento chegou
- **Dado** que o documento ou a informação chegou
- **Quando** a pessoa registra
- **Então** a cobrança se encerra e os lembretes seguintes são cancelados; lembrete de tarefa concluída nunca sai

### Requirement: CA8 · A Sênior vê o laço
A tarefa que subiu SHALL mostrar à Sênior o laço: as tentativas (data, canal e resultado), o prazo e o impacto no caso (quem falta).

#### Scenario: CA8 · Abrir a tarefa que subiu
- **Dado** uma tarefa que subiu por passar do limite
- **Quando** a sênior (ou a advogada, na perícia) a abre
- **Então** vê o laço, as tentativas (data, canal e resultado), o prazo e o impacto no caso

### Requirement: CA9 · A decisão com justificativa
Quem recebeu a tarefa que subiu SHALL registrar a decisão; enquanto as opções não forem definidas (Q1), o texto "O que o setor deve fazer" MUST ser obrigatório. Só a Sênior decide, e o servidor recusa os outros perfis.

#### Scenario: CA9 · Decidir
- **Dado** a tarefa que subiu
- **Quando** quem recebeu decide
- **Então** registra a decisão; enquanto as opções não forem definidas (Q1), a justificativa em texto é obrigatória

### Requirement: CA10 · Volta para o setor
Salva a decisão, a tarefa SHALL voltar para o setor do laço com o que ele deve fazer, a contagem de tentativas zerada e o próximo lembrete marcado; a decisão fica no histórico do laço.

#### Scenario: CA10 · Decisão salva
- **Dado** a decisão registrada
- **Quando** é salva
- **Então** volta para o setor do laço, com o que ele deve fazer

### Requirement: CA11 · O que cada lembrete diz
Cada lembrete SHALL mostrar o gatilho, o destinatário, o canal, o modelo e a data prevista.

#### Scenario: CA11 · Ver o lembrete
- **Dado** cada lembrete
- **Quando** abro a tarefa
- **Então** vejo o gatilho, o destinatário, o canal, o modelo e a data prevista

### Requirement: CA12 · Falha de envio vira tarefa
A falha de envio de lembrete ou mensagem SHALL virar tarefa para o Atendimento, sem reenvio automático duplicado. Nesta entrega o portal não envia nada sozinho (o lembrete é a Central e a mensagem ao cliente é enviada pela pessoa e registrada), então não há envio automático que falhe nem reenvio.

#### Scenario: CA12 · Falha de envio
- **Dado** uma falha de envio de lembrete ou mensagem
- **Quando** acontece
- **Então** vira tarefa para o Atendimento, sem reenvio automático duplicado
