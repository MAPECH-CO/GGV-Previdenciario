# Spec Delta · ggvp-22

## Purpose

Caso perdido: o Jurídico escreve e aprova o resumo para o cliente, sem estratégia interna, e decide quem fala com ele (a advogada, em caso complexo, ou o Atendimento, no padrão). Quem fala registra cada contato; "Expliquei ao cliente" fecha o caso. Sem IA até 09/10: o Jurídico escreve o texto, e a IA só passa a sugerir quando voltar. A tarefa nasce de `abrirExplicacaoDoResultado`, que o "Não recorrer" (GGVP-100) e o estudo de caso (GGVP-19) chamam quando existirem; até lá, o caso de exemplo entra pela semente.

## ADDED Requirements

### Requirement: CA1 · A tarefa "Explicar resultado" na fila
Com o resumo aprovado, a fila de quem fala com o cliente SHALL ter a tarefa "Explicar resultado", com o nome do cliente, que abre a tela com o resumo em linguagem simples.

#### Scenario: CA1 · Abrir a fila
- **Dado** o resumo aprovado pelo Jurídico
- **Quando** quem fala com o cliente abre a fila
- **Então** vê "Explicar resultado" com o nome do cliente

### Requirement: CA2 · Explicado, o caso fecha como "Perdemos: estudo registrado"
Com a conversa registrada como explicada, o caso SHALL ir para a fase "encerrado" e a tela SHALL mostrar "Perdemos: estudo registrado".

#### Scenario: CA2 · Registrar a conversa
- **Dado** a conversa feita
- **Quando** registro "Expliquei ao cliente"
- **Então** o caso fica como "Perdemos: estudo registrado"

### Requirement: CA3 · O resumo vem aprovado pelo Jurídico, com o nome de quem aprovou
O resumo SHALL ser escrito e aprovado por pessoa do Jurídico (advogada ou Sênior), com o nome e a data de quem aprovou à vista. Sem resumo aprovado, MUST NOT haver tarefa para o cliente. A IA, quando voltar, só sugere o texto, que o Jurídico completa antes de aprovar.

#### Scenario: CA3 · Ler o resumo
- **Dado** a tarefa aberta
- **Quando** leio o resumo para o cliente
- **Então** ele vem aprovado pelo Jurídico, com o nome de quem aprovou

### Requirement: CA4 · Cada contato fica registrado
Cada contato SHALL registrar a data, o canal e o que foi explicado. "Sem contato, tentar de novo" SHALL manter a tarefa aberta; "Expliquei ao cliente" SHALL concluí-la e exige o que foi explicado. A explicação SHALL mostrar só os contatos registrados nela, e não outro atendimento do caso.

#### Scenario: CA4 · Sem contato e depois explicado
- **Dado** a tarefa aberta
- **Quando** registro "Sem contato" e depois "Expliquei ao cliente"
- **Então** os dois contatos ficam com data e canal, a tarefa continua aberta depois do primeiro e conclui no segundo

#### Scenario: CA4 · Só os contatos desta explicação
- **Dado** outro atendimento do caso registrado depois do resumo
- **Quando** abro a explicação
- **Então** a lista de contatos mostra só os registrados nesta explicação

### Requirement: CA5 · A advogada decide quem fala com o cliente
Ao aprovar o resumo, a advogada SHALL escolher se ela mesma fala com o cliente (a tarefa fica com ela) ou se passa ao Atendimento. Só quem ficou com a explicação SHALL registrar o contato.

#### Scenario: CA5 · Caso complexo
- **Dado** um caso complexo
- **Quando** a advogada aprova o resumo escolhendo "Eu ligo"
- **Então** a tarefa "Explicar resultado" fica com ela, e não com o Atendimento

#### Scenario: CA5 · Só quem fala registra
- **Dado** a explicação com a advogada
- **Quando** o Atendimento tenta registrar o contato
- **Então** o portal recusa, e a tarefa continua com ela

### Requirement: CA6 · Resumo com "[completar]" não se aprova
Enquanto o texto tiver um marcador "[completar...]", deixado pela IA ou por alguém, aprovar o resumo MUST ser recusado com "O texto ainda tem [completar]: preencha antes de aprovar." (revisão de 08/10). A regra é a mesma na tela e no servidor.

#### Scenario: CA6 · Rascunho da IA sem o motivo preenchido
- **Dado** o rascunho da IA com "[completar: o motivo da decisão]"
- **Quando** a advogada aprova sem preencher
- **Então** o portal recusa, diz que falta completar, e nada vai para quem fala com o cliente
