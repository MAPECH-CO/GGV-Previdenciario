# Spec Delta · ggvp-23

## Purpose

Conferência do sênior antes do INSS: a Sênior valida o caso liberado pela Documentação antes de qualquer protocolo, aprova ou reprova com motivo, e nada vai ao INSS sem o OK dela (G2), sem o checklist completo (G1) e sem o parecer médico "Suficiente" ou a dispensa justificada (G17).

## ADDED Requirements

### Requirement: CA1 · Fila da Sênior com resumo, benefício, checklist e documentos
A conferência SHALL mostrar o resumo do caso, o benefício, o checklist e os documentos do caso liberado. Na fila, a pensão por morte aparece em destaque (resposta do revisor de 05/10).

#### Scenario: CA1 · Abrir a fila
- **Dado** um caso liberado
- **Quando** abro minha fila
- **Então** vejo o resumo do caso, o benefício, o checklist e os documentos

### Requirement: CA2 · Aprovar abre protocolo e decisão de perícia juntos
Aprovar SHALL abrir, ao mesmo tempo, a tarefa de protocolo (Jurídico administrativo) e a pergunta "precisa de perícia?" (advogada responsável).

#### Scenario: CA2 · Aprovar
- **Dado** que aprovo
- **Quando** confirmo
- **Então** o protocolo e a pergunta "precisa de perícia?" são abertos ao mesmo tempo

### Requirement: CA3 · Reprovar volta ao Atendimento, com prazo opcional
Reprovar SHALL devolver o caso ao Atendimento para ajustar, com o motivo visível; a Sênior MUST responder "Essa tarefa tem prazo?": com "Sim", a data do ajuste é obrigatória; com "Não", o ajuste vai sem prazo.

#### Scenario: CA3 · Reprovar
- **Dado** que não aprovo
- **Quando** registro o motivo
- **Então** o caso volta para o Atendimento ajustar, com o motivo visível, e respondo se a tarefa tem prazo

### Requirement: CA4 · Sem o perfil Sênior, só leitura
Quem não tem o perfil Sênior SHALL ver o caso só para leitura, sem Aprovar nem Reprovar (G2).

#### Scenario: CA4 · Outro perfil abre o caso
- **Dado** uma pessoa sem o perfil Sênior
- **Quando** abre o caso
- **Então** vê o caso só para leitura, sem Aprovar nem Reprovar

### Requirement: CA5 · Aprovar só com parecer "Suficiente" ou dispensa justificada
A conferência SHALL mostrar o parecer médico item a item, e Aprovar MUST só valer com o parecer "Suficiente" e nenhum laudo novo esperando conferência, ou com a dispensa da Sênior com justificativa, feita na própria conferência (G17; resposta do revisor de 05/10). O servidor recusa o resto.

#### Scenario: CA5 · Parecer na conferência
- **Dado** um caso com documentação médica
- **Quando** abro a conferência
- **Então** vejo o parecer item a item, e Aprovar só aparece com o parecer "Suficiente" e nenhum laudo novo esperando, ou com a minha dispensa justificada

### Requirement: CA6 · Ficha, cálculo e kit assinado na conferência
A conferência SHALL mostrar também a ficha do cliente, o cálculo de tempo e pontos (quando houver) e o kit assinado.

#### Scenario: CA6 · O que mais aparece
- **Dado** um caso liberado
- **Quando** abro a conferência
- **Então** vejo também a ficha, o cálculo de tempo e pontos (quando houver) e o kit assinado

### Requirement: CA7 · Quem aprovou e quando
Aprovar SHALL registrar quem aprovou e quando.

#### Scenario: CA7 · Registro da aprovação
- **Dado** que aprovo
- **Quando** confirmo
- **Então** fica registrado quem aprovou e quando

### Requirement: CA8 · Motivo obrigatório para reprovar
Reprovar MUST exigir o motivo escrito; ao concluir, o caso sai da fila da Sênior e não vai para o protocolo.

#### Scenario: CA8 · Reprovar sem motivo
- **Dado** que reprovo
- **Quando** tento concluir sem escrever o motivo
- **Então** o portal não deixa; ao concluir, o caso sai da minha fila e não vai para o protocolo

### Requirement: CA9 · Caso reprovado e liberado de novo passa por nova conferência
Um caso reprovado e liberado de novo MUST passar por nova conferência, sem herdar a aprovação anterior.

#### Scenario: CA9 · Volta para a fila
- **Dado** um caso que reprovei e que foi liberado de novo
- **Quando** volta para a minha fila
- **Então** passa por nova conferência e não herda a aprovação anterior

### Requirement: CA10 · Aprovar ou reprovar por fora da tela é recusado
Quem não tem o perfil Sênior e tenta aprovar ou reprovar chamando o servidor direto MUST ser recusado, e a tentativa fica no histórico. O card do chat fica para quando o chat existir.

#### Scenario: CA10 · Chamada direta sem o perfil
- **Dado** alguém sem o perfil Sênior que tenta aprovar ou reprovar por fora da tela
- **Quando** envia
- **Então** a ação é recusada no servidor e registrada
