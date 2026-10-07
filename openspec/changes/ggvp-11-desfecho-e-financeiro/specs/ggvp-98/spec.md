# Spec Delta · ggvp-98

## Purpose

Depois do OK da advogada na prestação, o Financeiro recebe e lança, avisa o cliente e marca a ida ao banco; o Atendimento leva o cliente; o Financeiro confirma o recebimento e o caso fecha no acervo como processo bom. Vale para o deferido no INSS e para o procedente na Justiça (decisão de 07/10). Mudança do Lucas (06/10): o aviso e a marcação passam do Atendimento para o Financeiro.

## ADDED Requirements

### Requirement: CA1 · A tarefa do aviso na fila do Financeiro
Com o OK da advogada e a prestação recebida, a fila do Financeiro SHALL ter a tarefa "Avisar resultado e agendar a ida ao banco" com o nome do cliente.

#### Scenario: CA1 · Abrir a fila
- **Dado** o OK da advogada e o Financeiro com a prestação recebida
- **Quando** o Financeiro abre a fila
- **Então** vê a tarefa com o nome do cliente e a ação de avisar e agendar a ida ao banco

### Requirement: CA2 · O aviso grava o caso no acervo como processo bom
Com o aviso enviado e a ida ao banco agendada, o caso SHALL entrar no acervo como processo bom, com o desfecho do caso, uma vez só, e a baixa SHALL ficar no histórico. O desfecho fica para a conferência da jurimetria (GGVP-41, G22).

#### Scenario: CA2 · Registrar o aviso
- **Dado** o aviso feito e a ida ao banco agendada
- **Quando** o Financeiro registra o envio
- **Então** o caso entra no acervo como processo bom e a baixa fica registrada

### Requirement: CA3 · Receber e lançar só com os valores conferidos
O Financeiro SHALL ver o valor recebido, o repasse, a forma, o prazo e a versão aprovada, e escolher "Receber e lançar" ou "Divergência, devolver à advogada", com motivo obrigatório na divergência. "Receber e lançar" MUST exigir "Valores conferem com o comprovante", na tela e no servidor.

#### Scenario: CA3 · Lançar sem conferir
- **Dado** a prestação com o OK da advogada
- **Quando** o Financeiro tenta lançar sem marcar "Valores conferem com o comprovante"
- **Então** o lançamento é recusado

### Requirement: CA4 · A tarefa do aviso só nasce depois do recebimento
O recebimento SHALL gravar quem recebeu e quando, e só então nasce a tarefa do aviso. O OK da advogada MUST NOT abrir a tarefa do aviso.

#### Scenario: CA4 · OK sem recebimento
- **Dado** o OK da advogada
- **Quando** o Financeiro ainda não recebeu
- **Então** não há tarefa de aviso; ao receber, ela nasce, com quem recebeu e quando

### Requirement: CA5 · O aviso pelo modelo, com registro
O aviso SHALL usar o modelo aprovado e o canal do cliente, e o envio SHALL ficar registrado (data, canal, texto, quem). O Chatwoot é a plataforma; o envio real fica para a integração.

#### Scenario: CA5 · Enviar o aviso
- **Dado** a ida ao banco agendada
- **Quando** o Financeiro revisa e envia
- **Então** o texto vem do modelo e o envio fica registrado

### Requirement: CA6 · Ida ao banco com quatro campos e quem acompanha do Atendimento
Data, hora, agência ou local e quem acompanha MUST ser obrigatórios; quem acompanha MUST ter o perfil Atendimento. Agendar SHALL abrir para essa pessoa a tarefa "Levar ao banco", com a data, e o Financeiro vê o agendamento.

#### Scenario: CA6 · Agendar
- **Dado** a tarefa do aviso
- **Quando** o Financeiro agenda sem um dos quatro campos ou com acompanhante fora do Atendimento
- **Então** é recusado; com os quatro, quem acompanha recebe "Levar ao banco" com a data

### Requirement: CA7 · Remarcar atualiza o Financeiro e quem acompanha
Remarcar SHALL cancelar o agendamento anterior, mostrar o novo ao Financeiro e mover a tarefa "Levar ao banco" para a nova data e a nova pessoa.

#### Scenario: CA7 · Remarcar
- **Dado** a ida ao banco agendada
- **Quando** é remarcada
- **Então** o Financeiro vê a nova data e a tarefa de quem acompanha muda junto

### Requirement: CA8 · Quem deu o OK não registra o recebimento
Quem deu o OK na prestação e tenta registrar o recebimento do mesmo caso MUST ser recusado no servidor, e a tentativa SHALL ficar registrada.

#### Scenario: CA8 · Mesma pessoa
- **Dado** quem deu o OK na prestação
- **Quando** tenta registrar o recebimento
- **Então** o servidor recusa e registra a tentativa

### Requirement: CA9 · Confirmar recebimento fecha o caso
Depois do aviso, o Financeiro SHALL confirmar o recebimento: a ida ao banco fica realizada, a tarefa de quem acompanha conclui e o caso vai para "encerrado".

#### Scenario: CA9 · Confirmar
- **Dado** a ida ao banco feita
- **Quando** o Financeiro registra "Confirmar recebimento"
- **Então** o caso fecha; antes do aviso, a confirmação é recusada
