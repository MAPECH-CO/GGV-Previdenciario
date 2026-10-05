# Spec Delta · ggvp-123 · Marcar a entrevista e a agenda

## Purpose

O Atendimento marca a entrevista do lead ou do cliente com a advogada, manda o convite pelo Chatwoot e acompanha a agenda do escritório: semana, mês e lista, com o que foi realizado, o que faltou e o que passou sem registro. Telas do Figma: Atendimento · Marcar reunião `73:459`, Agenda · Semana `1941:2`, Agenda · Lista `1941:401`, Agenda · Mês `1941:198`, detalhe do compromisso de entrevista `2164:280` e `2164:95`. Passo D1.03 do Miro e a agenda do escritório.

## ADDED Requirements

### Requirement: CA1 · "Marcar entrevista" com tipo, dia, horário e com quem
Ao clicar em "Marcar entrevista" (na ficha do cliente, no processo ou na agenda), o Atendimento SHALL escolher o tipo (vídeo pelo Google Meet, presencial ou telefone), o dia, o horário e com quem, e o compromisso MUST ir para a agenda como "Entrevista".

#### Scenario: CA1 · Marcar a entrevista
- **Dado** um lead ou cliente
- **Quando** clico em "Marcar entrevista" (na ficha do cliente, no processo ou na agenda)
- **Então** escolho o tipo (vídeo pelo Google Meet, presencial ou telefone), o dia, o horário e com quem; o compromisso vai para a agenda como "Entrevista"

### Requirement: CA2 · "Com quem" só tem gente do escritório
A lista de "Com quem" SHALL mostrar só funcionários do escritório e MUST NOT mostrar captador; quem conduz a entrevista é a advogada.

#### Scenario: CA2 · Escolher com quem
- **Dado** "Com quem"
- **Quando** escolho
- **Então** a lista mostra só funcionários do escritório, nunca captador; quem conduz a entrevista é a advogada

### Requirement: CA3 · Horário ocupado avisa e deixa confirmar
Num horário já ocupado, o portal SHALL avisar e MUST deixar confirmar mesmo assim, porque o escritório tem duas salas.

#### Scenario: CA3 · Marcar num horário ocupado
- **Dado** um horário já ocupado
- **Quando** marco
- **Então** o portal avisa e deixa confirmar mesmo assim, porque o escritório tem duas salas

### Requirement: CA4 · "Enviar convite" abre o Chatwoot com a mensagem pronta
Com o compromisso marcado, "Enviar convite" SHALL abrir a conversa do cliente no Chatwoot com a mensagem pronta (data, hora, link da ficha e o que trazer), e a pessoa MUST conferir e enviar. Enquanto o tablet não chega, a ficha de atendimento é em papel (Lucas e Pedro, 05/10): no lugar do link, o convite pede para preencher a ficha em papel no balcão antes da conversa. Aqui o Chatwoot é simulado.

#### Scenario: CA4 · Enviar o convite
- **Dado** o compromisso marcado
- **Quando** clico em "Enviar convite"
- **Então** o Chatwoot abre a conversa do cliente com a mensagem pronta (data, hora, link da ficha e o que trazer), para a pessoa conferir e enviar

### Requirement: CA5 · Todo agendamento aparece na agenda, até o interno
Todo agendamento SHALL aparecer na agenda com tipo e responsável, e o portal MUST deixar criar compromisso interno, sem cliente (por exemplo, "gravação amanhã").

#### Scenario: CA5 · Criar um agendamento
- **Dado** qualquer agendamento
- **Quando** é criado
- **Então** aparece na agenda com tipo e responsável
- **E** também dá para criar compromisso interno, sem cliente (por exemplo, "gravação amanhã")

### Requirement: CA6 · "Realizado" conclui a tarefa e o caso segue
Marcar o compromisso como "Realizado" SHALL concluir a tarefa, e o caso MUST seguir para o próximo passo.

#### Scenario: CA6 · Marcar como realizado
- **Dado** o compromisso
- **Quando** marco "Realizado"
- **Então** a tarefa fica concluída e o caso segue para o próximo passo

### Requirement: CA7 · "Remarcar" pede o motivo
"Remarcar" SHALL abrir a tela de marcar de novo; o motivo MUST ser obrigatório e SHALL aparecer em "Últimos contatos" do cliente. A remarcação tem limite (G15): 2 remarcações (Pedro, 05/10); passou disso, o portal MUST avisar que o caso sobe para a advogada sênior.

#### Scenario: CA7 · Remarcar o compromisso
- **Dado** o compromisso
- **Quando** clico em "Remarcar"
- **Então** abre a tela de marcar de novo; o motivo é obrigatório e aparece em "Últimos contatos" do cliente

### Requirement: CA8 · Passou sem registro, fica cinza até alguém confirmar
Compromisso que passou sem ninguém marcar SHALL ficar cinza, como "confirmar se aconteceu", a partir da meia-noite, até o responsável marcar "Realizado" ou "Faltou"; "Faltou" MUST abrir o remarcar com motivo.

#### Scenario: CA8 · Compromisso que passou sem registro
- **Dado** um compromisso que passou sem ninguém marcar
- **Quando** vira o dia (meia-noite)
- **Então** ele fica cinza, como "confirmar se aconteceu", e o responsável marca "Realizado" ou "Faltou"
- **E** "Faltou" abre o remarcar com motivo

### Requirement: CA9 · Lead que faltou é remarcado
Quando o Atendimento registra a falta do lead à entrevista, SHALL remarcar com o cliente.

#### Scenario: CA9 · Registrar a falta do lead
- **Dado** o lead que faltou à entrevista
- **Quando** o Atendimento registra a falta
- **Então** remarca com o cliente
