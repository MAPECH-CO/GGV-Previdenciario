# Spec Delta · ggvp-158

## Purpose

Fechamento do desenvolvimento (GGVP-158): o que falta no servidor, na infra e nas integrações para o portal ficar pronto pela definição de pronto da história do sistema. Vem da auditoria de 11/10 e anda uma parte por vez. Esta spec cobre o que é código nas partes 1 (ligar a homologação) e 2 (segurança e processo do repositório). As outras partes entram quando chegar a vez.

## ADDED Requirements

### Requirement: P1.1 · Sem Chatwoot, a mensagem não sai como entregue
Quando o servidor não tem as variáveis do Chatwoot, a mensagem ao cliente MUST NOT ser gravada como "entregue". O servidor SHALL gravá-la como não enviada, com o motivo "simulado, não saiu".

#### Scenario: P1.1 · Homologação sem Chatwoot
- **Dado** o servidor sem as variáveis do Chatwoot
- **Quando** alguém manda uma mensagem pronta ao cliente
- **Então** a mensagem fica gravada como não enviada, com o motivo "simulado, não saiu", e a tela mostra isso

### Requirement: P1.2 · O /saude diz qual versão está no ar
O `/saude` SHALL devolver a versão do build (o commit, gravado na imagem na hora de montar). Fora da imagem, devolve "local".

#### Scenario: P1.2 · Versão no ar
- **Dado** a imagem montada a partir de um commit
- **Quando** alguém abre o /saude
- **Então** a resposta traz o commit desse build

### Requirement: P1.3 · Cabeçalhos de segurança HTTP
Toda resposta do servidor SHALL levar `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` e uma política de conteúdo (CSP) básica que não quebra a tela. Por HTTPS, SHALL levar também o HSTS.

#### Scenario: P1.3 · Resposta da API e da tela
- **Dado** o portal no ar por HTTPS
- **Quando** o navegador pede uma tela ou uma rota da API
- **Então** a resposta traz os quatro cabeçalhos, e a tela abre normalmente

### Requirement: P1.4 · Produção não sobe sem banco
Em produção (`NODE_ENV=production`), sem `DATABASE_URL` o servidor MUST NOT subir: hoje ele cai num banco em memória com os usuários de exemplo. Fora de produção, segue o banco embutido de hoje.

#### Scenario: P1.4 · Imagem sem DATABASE_URL
- **Dado** a imagem em produção sem `DATABASE_URL`
- **Quando** o servidor sobe
- **Então** ele para com a mensagem de que falta o banco, sem abrir o banco em memória

### Requirement: P1.5 · Uma lista só das variáveis do servidor
O repositório SHALL ter um `.env.example` sem valores e a mesma lista em `docs/infra/homologacao.md`, com todas as variáveis que o servidor lê. Variável nova que o código lê MUST entrar na lista: um teste confere.

#### Scenario: P1.5 · Variável nova no código
- **Dado** o servidor lendo uma variável que não está no `.env.example`
- **Quando** os testes rodam
- **Então** o teste da lista falha e diz qual variável falta

### Requirement: P1.6 · Dados de teste dos recursos novos
O preparo da homologação SHALL trazer um exemplo de cada recurso novo que só o servidor cria e o roteiro abre, só com dado inventado. São os peritos com perfil, os entendimentos do juízo dos processos de exemplo (as decisões do juízo já vêm na semente) e um compromisso na agenda. Numa homologação já preparada, rodar o preparo de novo SHALL acrescentar o que faltar, sem duplicar e sem trocar senha. O contrato da Recepção, a leitura, o checklist, as boas-vindas, a cobrança e a perícia nascem no próprio roteiro e não entram como exemplo. O kit do contrato depende dos modelos do Word na homologação.

#### Scenario: P1.6 · Homologação já preparada
- **Dado** uma homologação preparada antes dos recursos novos
- **Quando** o preparo roda de novo
- **Então** os peritos com perfil, os entendimentos do juízo e a reunião na agenda passam a existir, uma vez só, e nenhuma senha muda

### Requirement: P2.1 · drizzle-orm sem a falha de injeção de SQL
O servidor SHALL usar o drizzle-orm na versão 0.45.2 ou mais nova, com o drizzle-kit compatível. As migrações de hoje MUST seguir aplicando iguais.

#### Scenario: P2.1 · Versão corrigida
- **Dado** o alerta alto do drizzle-orm 0.44.7
- **Quando** o servidor sobe com a versão nova
- **Então** os alertas fecham e as migrações e os testes passam

### Requirement: P2.2 · A conferência do "[completar]" sem regex lenta
A regra que acha o marcador "[completar]" no texto MUST rodar em tempo linear: texto grande com muitos "[completar" sem fechar não trava o servidor.

#### Scenario: P2.2 · Texto montado para travar
- **Dado** um texto com milhares de "[completar" sem o fecho
- **Quando** a regra confere o texto
- **Então** responde na hora, e o texto com "[completar ...]" fechado segue barrado

### Requirement: P2.3 · `@ggv/campos` no typecheck e no lint do CI
O pacote `@ggv/campos` SHALL ter typecheck e lint, que o CI roda como nos outros pacotes.

#### Scenario: P2.3 · Erro de tipo na biblioteca de campos
- **Dado** um erro de tipo em `@ggv/campos`
- **Quando** o CI roda
- **Então** o typecheck falha

### Requirement: P2.4 · Erro do servidor sem SQL nem parâmetros
Um erro inesperado do servidor MUST NOT devolver nem registrar no log o SQL e os parâmetros da consulta: a resposta é uma mensagem genérica, e o log guarda a rota, o código e o tipo do erro. O log SHALL esconder o cookie e o cabeçalho de autorização.

#### Scenario: P2.4 · Consulta que falha
- **Dado** uma consulta ao banco que falha com dado do cliente nos parâmetros
- **Quando** o servidor responde
- **Então** a resposta é "Algo deu errado.", e nem ela nem o log trazem o SQL ou os parâmetros

### Requirement: P2.5 · Toda rota /api com trava de permissão
Toda rota `/api`, fora as da sessão, SHALL ter trava de permissão da matriz. As 7 sem trava são o chat (3 rotas), a lista de tarefas, as tarefas das conversas, a pendência cumprida da conversa e o arquivo da gravação. Perfil sem a permissão recebe a recusa, e a recusa fica no histórico. Rota `/api` nova sem trava MUST NOT subir.

#### Scenario: P2.5 · Perfil sem a permissão
- **Dado** um perfil sem a permissão da rota
- **Quando** chama a rota
- **Então** recebe 403, e a tentativa fica no histórico

#### Scenario: P2.5 · Rota nova sem trava
- **Dado** uma rota `/api` nova registrada sem trava de permissão
- **Quando** o servidor sobe
- **Então** ele para e diz qual rota está sem trava

### Requirement: P2.6 · A sugestão da IA citada é deste caso
Quando uma decisão ou uma versão de petição cita a chamada da IA de onde partiu, o servidor SHALL conferir que a chamada é do mesmo caso. Chamada de outro caso, ou que não existe, MUST ser recusada.

#### Scenario: P2.6 · Chamada de outro caso
- **Dado** um despacho que cita a chamada da IA de outro caso
- **Quando** é gravado
- **Então** o servidor recusa e nada é gravado

### Requirement: P2.7 · O que segue desligado fica registrado
A documentação SHALL dizer que a revisão automática do Claude e o workflow do Jira seguem desligados no repositório da MAPECH-CO, por falta dos segredos, e quem revisa os pedidos enquanto isso.

#### Scenario: P2.7 · Quem chega no repositório
- **Dado** alguém lendo a documentação de ferramentas
- **Quando** procura a revisão automática e o workflow do Jira
- **Então** encontra que estão desligados, por quê e quem revisa
