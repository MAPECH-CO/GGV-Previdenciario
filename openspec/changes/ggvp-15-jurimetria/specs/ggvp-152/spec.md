# Spec Delta · ggvp-152

## Purpose

Perfil do perito laudo a laudo (continua a GGVP-59, nasceu da conferência da jurimetria de 09/10): o laudo entra no perfil
do perito sem apagar o anterior nem duplicar, também quando duas gravações acontecem juntas; o perfil, calculado no
servidor, ganha os laudos favoráveis por benefício; e o perito nomeado na publicação fica ligado à perícia do caso.

**Travado (CA2, a parte "por CID"):** o laudo não traz o CID, e o caso pode ter vários documentos médicos com CIDs
diferentes. A pergunta de qual CID vale está no cartão para o Lucas (09/10).

Quem vê: o Jurídico e o Sócio. O CID e o conteúdo do laudo são dado de saúde; o Atendimento não vê os números.

## ADDED Requirements

### Requirement: CA1 · Um laudo por vez, sem sobrescrever
Ao salvar o resultado da perícia, o servidor SHALL juntar os laudos já guardados no perfil do perito com os novos, pelo
identificador do laudo. Um laudo guardado MUST NOT sair do perfil por causa de outra gravação, e o mesmo laudo salvo de
novo MUST NOT duplicar.

#### Scenario: CA1 · Salvar o resultado
- **Dado** um resultado de perícia registrado
- **Quando** é salvo
- **Então** o servidor acrescenta esse laudo ao perfil do perito; os anteriores não mudam, e o mesmo laudo salvo de novo não duplica

### Requirement: CA2 · Favoráveis por benefício
O laudo SHALL guardar o benefício do processo ao entrar no perfil, e o perfil do perito, calculado no servidor, SHALL
mostrar os laudos favoráveis por benefício, cada taxa com o número de laudos e a data da base (G22). Laudo antigo, sem o
benefício, fica fora desse recorte. O recorte por CID MUST esperar a resposta do Lucas.

#### Scenario: CA2 · Abrir o overlay
- **Dado** o overlay do perito
- **Quando** abre
- **Então** mostra os laudos favoráveis por benefício e por CID, cada taxa com o número de laudos e a data da base, calculados no servidor

### Requirement: CA3 · O perito nomeado ligado à perícia
Ao classificar uma nomeação de perito reconhecido, o servidor SHALL ligar o perito à perícia aberta do caso (sem
resultado e sem perito) do mesmo tipo do perito, a mais recente. Sem perícia aberta, o perito fica no histórico do caso,
como hoje, e nada trava.

#### Scenario: CA3 · Classificar a nomeação
- **Dado** uma nomeação de perito reconhecido
- **Quando** a advogada classifica a publicação
- **Então** a perícia do juízo do caso fica ligada a esse perito, e o nome vira link para o overlay

### Requirement: CA4 · O Atendimento sem os números
Para quem não é do Jurídico, o servidor MUST NOT mandar os números do perfil do perito nem os laudos (nem por assunto,
nem por benefício).

#### Scenario: CA4 · Atendimento
- **Dado** o Atendimento
- **Quando** abre a perícia
- **Então** não vê os números nem o CID
