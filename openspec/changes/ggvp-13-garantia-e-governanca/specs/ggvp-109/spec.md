# Spec Delta · ggvp-109

## Purpose

Ninguém pula um portão de aprovação: cada portão já recusa no servidor, no passo dele. Esta história garante o conjunto: toda recusa fica registrada do mesmo jeito (quem, quando, caso e portão), a gestão vê as tentativas, e o botão principal só habilita com a conferência obrigatória marcada. As regras de cada portão continuam nas histórias de cada passo. Sem chat com ação até 09/10, o chat não tem card para atravessar portão. A liberação ao Jurídico (D1.24) é do épico do Pedro e usa o mesmo registro.

## ADDED Requirements

### Requirement: CA1 · Protocolo no INSS sem o OK da Sênior (G2)
O protocolo no Meu INSS sem o OK da Sênior registrado MUST ser recusado no servidor, pela tela ou pela API, e a tentativa SHALL ficar registrada com o portão G2. Até 09/10 o chat só consulta e não executa o protocolo.

#### Scenario: CA1 · Protocolar sem o OK
- **Dado** alguém que chama a ação de protocolar no Meu INSS sem o OK do sênior registrado
- **Quando** chama (pela tela, pela API ou pelo chat)
- **Então** o servidor recusa e registra a tentativa (G2)

### Requirement: CA2 · Liberar ou aprovar sem checklist, parecer ou perfil (G1, G17)
Com o checklist incompleto, sem parecer "Suficiente" ou sem o perfil, o servidor MUST recusar e SHALL devolver a lista do que falta, com a tentativa registrada. Neste épico, o teste cobre a aprovação para o INSS (G1, G17) e a ação fora do perfil; a liberação ao Jurídico (D1.24) é do épico Abertura e documentação e usa o mesmo registro.

#### Scenario: CA2 · Liberar com pendência
- **Dado** alguém que tenta liberar o caso ao Jurídico com o checklist incompleto, sem parecer "Suficiente" ou sem o perfil Documentação
- **Quando** tenta
- **Então** o servidor recusa e devolve a lista do que falta (G1, G17)

### Requirement: CA3 · Botão principal desabilitado com conferência pendente
Com um item obrigatório de conferência sem marcar, o botão principal da tela MUST ficar desabilitado: protocolo no INSS ("Revisei o requerimento antes de enviar"), aprovação da versão da manifestação ("Aprovei a versão", G6), conclusão da prestação de contas ("Conferi os valores") e conferência da petição (as três marcações). O servidor continua conferindo de novo.

#### Scenario: CA3 · Item de conferência pendente
- **Dado** um item obrigatório de conferência pendente
- **Quando** a tela é mostrada
- **Então** o botão principal fica desabilitado

### Requirement: CA4 · Aviso ao cliente antes do OK da advogada (G8)
O aviso ao cliente antes do OK da advogada na prestação de contas MUST ser recusado no servidor, e a tentativa SHALL ficar registrada com o portão G8.

#### Scenario: CA4 · Avisar antes do OK
- **Dado** um resultado favorável
- **Quando** alguém tenta avisar o cliente antes do OK da advogada na prestação de contas
- **Então** o servidor recusa (G8)

### Requirement: CA5 · O servidor confere o estado real, não a caixa
Uma caixa marcada na tela MUST NOT valer como o OK: o servidor SHALL conferir o estado real do caso (o OK registrado pela Sênior).

#### Scenario: CA5 · Caixa marcada sem o OK
- **Dado** uma caixa de conferência marcada na tela (por exemplo, "OK do sênior recebido (G2)" no protocolo)
- **Quando** a ação é enviada
- **Então** o servidor confere o estado real do caso (o OK registrado pela sênior), e não a caixa

### Requirement: CA6 · Setores ou perícia sem retorno
Pedir a petição ou protocolar a manifestação com setor sem card ou perícia sem retorno MUST ser recusado no servidor, que SHALL mostrar quem falta e registrar a tentativa.

#### Scenario: CA6 · Pedir a petição com setor pendente
- **Dado** setores acionados sem card ou perícia sem retorno
- **Quando** alguém tenta pedir a petição ou protocolar a manifestação
- **Então** o servidor recusa e mostra quem falta

### Requirement: CA7 · Item sem prova (G21)
Responder a exigência do INSS ou manifestar no processo com item sem prova MUST ser recusado no servidor, com a tentativa registrada com o portão G21.

#### Scenario: CA7 · Responder sem prova
- **Dado** um item de exigência sem prova
- **Quando** alguém tenta responder no portal do INSS ou manifestar no processo
- **Então** o servidor recusa (G21)

### Requirement: CA8 · O chat não atravessa portão
O chat MUST NOT mostrar card para executar ação que atravessa portão. Até 09/10 o chat só consulta (kit/entrega-09-10.md), então não há card de execução; a recusa com o portão que falta e a oferta da tarefa para quem pode entram com o chat com ação.

#### Scenario: CA8 · Pedido pelo chat
- **Dado** um pedido pelo chat que atravessa um portão
- **Quando** o chat o recebe
- **Então** não mostra card para executar: recusa e diz o portão que falta; se for pedido de outro perfil, oferece criar a tarefa para quem pode

### Requirement: CA9 · Toda tentativa bloqueada registrada e visível à gestão
Toda tentativa bloqueada SHALL ficar no histórico com quem, quando, o caso e o portão, sem dado de saúde, e a gestão (`gestao.ver`) SHALL ver a lista das tentativas, das mais recentes para as mais antigas.

#### Scenario: CA9 · Ver as tentativas
- **Dado** qualquer tentativa bloqueada
- **Quando** acontece
- **Então** fica registrada (quem, quando, caso e portão), e a gestão consegue ver as tentativas

### Requirement: CA2 e G17 · Regra única do parecer, confirmação de pessoa e dispensa por duas Sêniores
A trava do parecer SHALL ser uma regra só, `travaDoParecer` em `packages/contratos`, usada pela tela (GGVP-33) e pelo servidor. O parecer só sugerido pela IA, sem pessoa do Jurídico que o confirme, MUST NOT abrir o portão. A dispensa MUST ser de duas Sêniores diferentes (Lucas, 01/10, Q14): uma pede com justificativa, outra aprova ou recusa; se a mesma pessoa tenta aprovar, o servidor recusa e registra a tentativa. Benefício sem laudo não pede parecer; benefício ainda não definido pede.

#### Scenario: CA2 · Parecer só da IA
- **Dado** um parecer "Suficiente" sugerido pela IA e sem confirmação de pessoa
- **Quando** a Sênior tenta aprovar para o INSS
- **Então** o servidor recusa, diz que falta a confirmação do Jurídico, e registra a tentativa (G17)

#### Scenario: G17 · Dispensa pela mesma Sênior
- **Dado** uma dispensa do parecer pedida por uma Sênior
- **Quando** a mesma Sênior tenta aprová-la
- **Então** o servidor recusa e registra a tentativa; só outra Sênior aprova, e aí o portão abre

