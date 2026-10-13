# Spec Delta · ggvp-142

## Purpose

Chat e Suporte respondendo pelo motor de IA de verdade (Mateus, 09/10). O chat das Centrais e a aba Suporte respondem pelo motor de IA do portal, com o caso que o perfil vê, o acervo da casa e as fontes. As travas do chat continuam no servidor, como código. A ação pedida no chat vira um cartão, que só executa depois do "Confirmar" de quem pediu. O Sócio vê o conteúdo médico no chat, com o acesso registrado (decisão do Mateus, 09/10). As ações que dependem de enviar arquivo (comprovante do INSS, laudo, documento, comprovante de RPV e lote do acervo) levam à tela certa até as rotas de envio existirem no servidor.

## ADDED Requirements

### Requirement: CA1 · A pergunta é respondida pelo motor, com fontes e registro
Uma pergunta no chat SHALL ser respondida pelo servidor (`POST /api/chat`) com o motor de IA do portal, trazendo as fontes usadas (o caso, o acervo, a regra) e o modelo.
- Cada conversa MUST ficar registrada como chamada de IA, com quem perguntou.
- O contexto do modelo SHALL ser só o que o perfil de quem pergunta vê do caso.
- O conteúdo médico SHALL entrar só para o Jurídico e o Sócio, com o acesso registrado.
- Sem a IA (desligada, sem autorização ou sem resposta), a resposta MUST dizer o motivo e dar os links, sem inventar.

#### Scenario: CA1 · Pergunta sobre um caso
- **Dado** a advogada no chat aberto no caso da cliente
- **Quando** pergunta o que falta no caso
- **Então** recebe a resposta do motor com o caso e o acervo como fontes e o modelo, e a chamada fica registrada

#### Scenario: CA1 · Atendimento não recebe conteúdo médico
- **Dado** o Atendimento perguntando sobre um caso com laudo
- **Quando** o chat monta o contexto
- **Então** o modelo não recebe o conteúdo médico do caso

#### Scenario: CA1 · IA desligada
- **Dado** o servidor sem a chave da IA
- **Quando** alguém pergunta
- **Então** o chat diz que a IA está desligada e mostra os links do caso, sem resposta inventada

### Requirement: CA2 · As travas continuam no servidor, como código
O servidor SHALL decidir, como código, antes e depois do modelo:
- as recusas: pular o parecer médico (G17); esconder ou mudar a situação real na perícia (G11);
- os portões do pedido e o pedido que é de outro perfil;
- a regra do responsável e a lista fixa de ações do perfil;
- as permissões e os números.

Nos casos de recusa e de portão, o modelo MUST NOT ser chamado. O modelo só pode propor as ações da lista do perfil de quem pergunta. Os números da resposta MUST vir do código. A saída para quem não vê dado de saúde MUST NOT trazer código de doença.

#### Scenario: CA2 · Pedir para pular o parecer
- **Dado** alguém pede no chat para seguir sem o parecer médico
- **Quando** pergunta
- **Então** recebe a recusa do G17, e o modelo não é chamado

#### Scenario: CA2 · Ação de outro perfil
- **Dado** o Financeiro pedindo para marcar uma perícia
- **Quando** pergunta
- **Então** o chat diz de quem é a ação, sem cartão e sem chamar o modelo

### Requirement: CA3 · A ação só acontece depois do clique de quem tem o perfil certo
Uma ação pedida no chat SHALL virar um cartão (passos, o que conferir, travas e responsável) e MUST NOT executar antes do "Confirmar".
- Só quem pediu, com o perfil que pode a ação, SHALL confirmar.
- Ao executar, o servidor confere de novo as permissões e os portões.
- O histórico do caso SHALL guardar a ação como "feito pelo chat".
- Cancelar descarta o cartão.
- **Executam no servidor:** criar tarefa e pedir a peça.
- **Levam à tela:** marcar a perícia com o comprovante (a pessoa confere a leitura na perícia do caso), anexar o laudo, enviar documento, lançar o comprovante de RPV e subir processos no acervo, até a rota de envio existir no servidor.

#### Scenario: CA3 · Criar tarefa pelo chat
- **Dado** a advogada pede no chat para criar uma tarefa para a Documentação
- **Quando** confirma o cartão
- **Então** a tarefa entra na Central da pessoa responsável, e o histórico do caso mostra "feito pelo chat"

#### Scenario: CA3 · Outra pessoa tenta confirmar
- **Dado** um cartão pedido pela advogada
- **Quando** outra pessoa tenta confirmar
- **Então** o servidor recusa e nada acontece

#### Scenario: CA3 · Ação que depende de arquivo
- **Dado** o Atendimento pede no chat para anexar o laudo novo
- **Quando** pergunta
- **Então** o chat mostra o link da tela onde sobe o laudo, sem executar nada

### Requirement: CA4 · Testes sem rede
Os testes do chat SHALL usar um `fetch` falso no lugar do serviço de IA.

#### Scenario: CA4 · Teste do chat
- **Dado** os testes do chat
- **Quando** rodam
- **Então** nenhuma chamada sai para a rede
