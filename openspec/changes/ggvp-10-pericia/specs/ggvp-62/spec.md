# Spec Delta · ggvp-62 · Preparar o cliente

## Purpose

O Jurídico administrativo passa ao cliente data, local, o que levar e, na social, como é a visita em casa, numa ligação (DP.06 "Ligar e orientar o cliente"), para o cliente chegar preparado. Resposta do Lucas de 02/10 (Q5): o canal oficial é o Chatwoot, sempre pelo sistema do escritório; o documento de orientação vai ao cliente, como documento e como instrução. A orientação nunca manda esconder ou mudar a situação real (G11) nem sugere diagnóstico ou frase pronta (G20). Passo DP.06 do Miro. Figma: step_DP.06 `10:405`, chat "o cliente ligou" `2107:1091`. Contrato na `design.md`, seção GGVP-62.

## ADDED Requirements

### Requirement: CA1 · O documento para enviar ou imprimir, com o contato do cliente
Com a orientação pronta, a tarefa SHALL mostrar o documento para enviar ou imprimir, com o contato do cliente (ligar ou WhatsApp pelo Chatwoot).

#### Scenario: CA1 · Abrir a tarefa
- **Dado** a orientação pronta
- **Quando** abro a tarefa
- **Então** vejo o documento para enviar ou imprimir, com o contato do cliente (ligar ou WhatsApp)

### Requirement: CA2 · A preparação fica no histórico com data e canal
Registrada a preparação, ela SHALL ficar no histórico com a data e o canal.

#### Scenario: CA2 · Registrar a preparação
- **Dado** a preparação feita
- **Quando** registro
- **Então** fica no histórico com data e canal

### Requirement: CA3 · Só depois de "Revisei a orientação"
Enviar ou registrar a ligação SHALL só ser possível depois de marcar "Revisei a orientação".

#### Scenario: CA3 · Revisar antes
- **Dado** a orientação pronta
- **Quando** vou enviar ou registrar a ligação
- **Então** só consigo depois de marcar "Revisei a orientação"

### Requirement: CA4 · O texto passa pela verificação antes do envio
Antes de enviar, o texto SHALL passar pela verificação de conteúdo proibido: esconder ou mudar a situação real (G11), diagnóstico sugerido ou frase pronta (G20).

#### Scenario: CA4 · Enviar
- **Dado** a orientação a enviar
- **Quando** envio
- **Então** o texto passa antes pela verificação de conteúdo proibido

### Requirement: CA5 · Data ou local mudados geram a orientação de novo
Lido o novo comprovante com a data ou o local mudados, a orientação SHALL ser gerada de novo, e a preparação feita antes deixa de valer.

#### Scenario: CA5 · Comprovante novo
- **Dado** a data ou o local da perícia mudados
- **Quando** o novo comprovante é lido
- **Então** a orientação é gerada de novo

### Requirement: CA6 · O servidor recusa o texto editado com conteúdo proibido e registra
Editada a orientação à mão com texto que manda esconder ou mudar a situação real, ou que sugere diagnóstico, o envio SHALL ser recusado no servidor e a tentativa SHALL ficar registrada.

#### Scenario: CA6 · Texto editado
- **Dado** alguém que edita a orientação à mão
- **Quando** tenta enviar texto que manda esconder ou mudar a situação real, ou que sugere diagnóstico
- **Então** o envio é recusado no servidor e a tentativa fica registrada

### Requirement: CA7 · O texto enviado fica guardado no caso
Concluído o envio, o texto enviado ao cliente SHALL ficar guardado no caso.

#### Scenario: CA7 · Enviado
- **Dado** a orientação enviada
- **Quando** o envio é concluído
- **Então** o texto enviado ao cliente fica guardado no caso

### Requirement: CA8 · O chat mostra a orientação e a tarefa, sem executar nada
Perguntado no chat o que falar ao cliente que ligou, o chat SHALL mostrar a orientação pronta e a tarefa "<nome do cliente> · Orientar para a perícia", só respondendo e orientando.

#### Scenario: CA8 · O cliente ligou
- **Dado** o cliente que liga
- **Quando** pergunto ao chat o que falar
- **Então** o chat mostra a orientação pronta e a tarefa **nome do cliente** · Orientar para a perícia, só respondendo e orientando, sem executar nada sozinho
