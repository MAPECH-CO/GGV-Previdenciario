# Spec Delta · ggvp-103

## Purpose

Cofre de senhas do gov.br (G9). O cofre já existe: a senha fica cifrada (AES-256-GCM, chave na variável `COFRE_CHAVE`, fora do banco) e a advogada ou o Jurídico administrativo a revela por 60 segundos depois de confirmar a própria senha do portal, com registro (GGVP-27). Esta história completa o resto. A senha só entra pelo cofre: o Atendimento ou o Jurídico cadastra e troca. O uso só vale com tarefa aberta que precise do gov.br. Cada ação fica registrada sem o valor, e a gestão tem o relatório. O uso fora do padrão gera alerta. Encerrado o caso, a senha fica guardada por 1 ano. Respostas do Lucas (01/10 e 02/10): revelar por tempo limitado; o Jurídico administrativo usa o acesso; a senha fica até 1 ano depois do encerramento. A transcrição da conversa (D5) e a IA entram com os épicos deles.

## ADDED Requirements

### Requirement: CA1 · Senha dita na conversa vai para o cofre
A senha dita na entrevista ou na conversa gravada MUST NOT aparecer na transcrição e SHALL ir para o cofre. Entra com a conversa gravada (D5) e a IA, que não existem nesta entrega.

#### Scenario: CA1 · Transcrição
- **Dado** uma senha dita na entrevista ou na conversa gravada
- **Quando** a transcrição é gerada
- **Então** a senha não aparece no texto e vai para o cofre do cliente

### Requirement: CA2 · Revelar com confirmação e tempo limitado
Revelar a senha SHALL pedir a confirmação da identidade (a senha do portal de quem pede), MUST mostrar a senha por tempo limitado (60 segundos) e SHALL registrar a revelação no histórico.

#### Scenario: CA2 · Revelar
- **Dado** uma senha no cofre
- **Quando** alguém com permissão clica em Revelar
- **Então** confirma a identidade, a senha fica visível por tempo limitado e a revelação fica no histórico

### Requirement: CA3 · IA e chat não pegam a senha
A IA e o chat MUST NOT ter acesso à senha: o cofre só abre pela rota de revelar, com a senha do portal de uma pessoa. Sem IA nem chat com ação nesta entrega, não há caminho deles até o cofre.

#### Scenario: CA3 · Pedido da IA
- **Dado** a IA ou o chat
- **Quando** pedem a senha
- **Então** o acesso é negado e fica registrado

### Requirement: CA4 · Só pelo componente do cofre
A senha do gov.br SHALL entrar só pelo componente do cofre (campo de senha, que vai direto ao cofre), e MUST NOT ficar em campo de texto da ficha, da entrevista ou da conversa.

#### Scenario: CA4 · Entrar com a senha
- **Dado** a senha do gov.br
- **Quando** entra no portal (ficha, renovação, entrevista, conversa)
- **Então** entra só pelo componente do cofre, nunca num campo de texto

### Requirement: CA5 · Uso só com tarefa que precise do gov.br
Sem tarefa aberta no caso que exija o gov.br (protocolar no Meu INSS ou marcar a perícia), o uso MUST ser recusado no servidor e a tentativa SHALL ficar registrada.

#### Scenario: CA5 · Uso sem tarefa
- **Dado** alguém sem tarefa aberta no caso que exija o gov.br
- **Quando** tenta usar a senha
- **Então** o uso é recusado no servidor e a tentativa fica registrada

### Requirement: CA6 · Cada ação registrada, sem o valor
Cada leitura, cadastro, troca ou uso SHALL ficar no histórico com quem, o caso, a data e a hora e o motivo (a tarefa), MUST NOT ter o valor, e a gestão SHALL ter o relatório de usos por pessoa.

#### Scenario: CA6 · Relatório
- **Dado** cada leitura, gravação, alteração ou uso da senha
- **Quando** acontece
- **Então** fica registrado quem, o caso, a data e hora e o motivo, sem o valor; a gestão tem o relatório de usos por pessoa

### Requirement: CA7 · Uso fora do padrão gera alerta
O uso fora do padrão SHALL gerar alerta para a Sênior: mais leituras no dia do que o limite, ou leitura fora do horário. Os limites são parâmetros da configuração (`cofre.alerta.leituras_por_dia`, `cofre.alerta.horario`, Q1). O caso sem tarefa já é recusado (CA5).

#### Scenario: CA7 · Fora do padrão
- **Dado** um uso fora do padrão (volume, horário, caso sem tarefa)
- **Quando** acontece
- **Então** gera alerta; os limites do alerta são parâmetros

### Requirement: CA8 · Cifrada, com a chave fora do banco
A senha guardada SHALL ficar cifrada, com a chave fora do banco da aplicação.

#### Scenario: CA8 · No cofre
- **Dado** a senha guardada
- **Quando** está no cofre
- **Então** fica cifrada, com a chave fora do banco da aplicação

### Requirement: CA9 · Testes procuram a senha de teste
Os testes automatizados SHALL procurar a senha de teste no histórico e na exportação do histórico, e MUST falhar se a encontrarem.

#### Scenario: CA9 · Varredura
- **Dado** senhas de teste
- **Quando** os testes automatizados rodam
- **Então** procuram essas senhas em logs, transcrições e exportações e falham se encontrarem

### Requirement: CA10 · Guardada até 1 ano depois do encerramento
Com todos os casos do cliente encerrados, a senha SHALL continuar no cofre por até 1 ano depois do último encerramento, e depois disso o sistema MUST apagá-la, registrando o fato.

#### Scenario: CA10 · Caso encerrado
- **Dado** o caso encerrado
- **Quando** o encerramento é registrado
- **Então** a senha continua guardada no cofre por até 1 ano, porque o cliente às vezes liga pedindo ajuda para entrar no gov.br

### Requirement: CA11 · Cadastrar ou trocar pelo cofre
O Atendimento ou o Jurídico SHALL poder cadastrar ou trocar a senha pelo cofre, sempre com o registro de quem fez e sem o valor no registro.

#### Scenario: CA11 · Senha nova
- **Dado** um cliente que passa uma senha nova do gov.br fora da renovação
- **Quando** o Atendimento abre o cofre pela ficha do cliente
- **Então** pode cadastrar ou trocar a senha, sempre pelo cofre e com registro de quem fez

### Requirement: CA12 · Revelar para responder a exigência no portal do INSS
Quem trata a exigência do INSS (a advogada, e a Sênior quando tiver os passos da advogada) SHALL revelar a senha do gov.br pelo cofre com a tarefa "Responder exigência no portal do INSS" aberta no caso, como o Jurídico administrativo no protocolo; a tarefa é o motivo que vai para o histórico (CA6). A tela da exigência SHALL oferecer o revelar na hora de responder (orquestrador, 09/10).

#### Scenario: CA12 · A advogada responde a exigência
- **Dado** a tarefa "Responder exigência no portal do INSS" aberta e a senha do cliente no cofre
- **Quando** a advogada confirma a própria senha do portal
- **Então** vê a senha por tempo limitado, e o histórico guarda o passo e o motivo

### Requirement: CA13 · O revelar trava depois de senhas erradas
A senha do portal errada no revelar MUST contar para a mesma trava do login: na 5ª errada, a conta trava por 15 minutos, mesmo com a senha certa; acertar zera a contagem; a trava fica no histórico.

#### Scenario: CA13 · Cinco erros
- **Dado** a pessoa com a tarefa que usa o gov.br
- **Quando** erra a senha do portal pela 5ª vez
- **Então** o revelar trava por 15 minutos, mesmo com a senha certa, e a trava fica no histórico
