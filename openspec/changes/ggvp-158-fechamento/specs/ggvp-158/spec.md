# Spec Delta · ggvp-158

## Purpose

Fechamento do desenvolvimento (GGVP-158): o que falta no servidor, na infra e nas integrações para o portal ficar pronto pela definição de pronto da história do sistema. Vem da auditoria de 11/10 e anda uma parte por vez. Esta spec cobre as partes 1 (ligar a homologação) e 2 (segurança e processo do repositório): o que é código e, desde 12/10, o que é de infraestrutura, feito com o Mateus. As outras partes entram quando chegar a vez.

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

### Requirement: P1.7 · Chatwoot ligado na homologação, com a trava
A homologação SHALL enviar as mensagens ao cliente pelo Chatwoot da caixa do escritório só para os telefones de `CHATWOOT_PERMITIDOS`. Para telefone fora da lista, o portal MUST NOT chamar o Chatwoot, e o envio fica registrado como não enviado.

#### Scenario: P1.7 · Telefone da lista e telefone de fora
- **Dado** o Chatwoot ligado na homologação, com a lista dos telefones do time
- **Quando** alguém manda a mensagem a um lead com telefone da lista e a outro com telefone de fora
- **Então** a primeira chega no WhatsApp e fica "enviada"; a segunda fica "fora da lista de teste", sem chamar o Chatwoot

### Requirement: P1.8 · Os modelos do Word no portal
Cada modelo do kit que tenha arquivo aceito pela conferência do portal SHALL estar no ar na homologação, com versão. O que falta MUST ficar registrado no cartão, com o motivo: sem arquivo, ou com variável que o portal não preenche.

#### Scenario: P1.8 · Subida dos modelos do ZapSign
- **Dado** os modelos do ZapSign anexados na GGVP-136
- **Quando** a Sênior sobe os que passam na conferência
- **Então** a Configuração mostra a versão de cada um, e o cartão diz quais faltam e por quê

### Requirement: P1.9 · O kit aceita os nomes de variável do ZapSign
O portal SHALL aceitar os nomes de variável dos modelos do ZapSign como sinônimos dos dele e preencher cada um com o mesmo dado: `{{ENDEREÇO}}`, `{{TELEFONE PARA RECADO}}`, `{{NOME BENEFICIARIO COMPLETO}}`, `{{CPF BENEFICIARIO}}`, e `{{DIA}}`, `{{MÊS}}` e `{{ANO}}` da data do contrato, com a mesma regra da `{{DATA DE HOJE}}`. O que a ficha não tem, como `{{COMPLEMENTO}}` e `{{E-MAIL GENITOR(A)}}`, sai em branco e MUST NOT barrar o kit.

#### Scenario: P1.9 · Contrato Completo do ZapSign
- **Dado** um Contrato Completo com os nomes de variável do ZapSign
- **Quando** a Sênior sobe o arquivo e o Atendimento gera o kit
- **Então** o portal aceita o arquivo, e o kit sai com os dados da ficha nos lugares dos nomes do ZapSign

### Requirement: P1.10 · Kit em PDF pelo Gotenberg
Com o Gotenberg ligado na homologação, sem domínio público, o kit SHALL sair em PDF.

#### Scenario: P1.10 · Gerar o kit
- **Dado** o `GOTENBERG_URL` apontando para o serviço na rede interna do Coolify
- **Quando** o Atendimento gera o kit
- **Então** o portal entrega o PDF, e `GET /api/contrato/servicos` diz `pdf: true`

### Requirement: P1.11 · A homologação não grava no Drive real
A homologação MUST NOT gravar nas pastas reais do Drive do escritório: ela fica só leitura, ou com pastas de teste. O que o teste já gravou lá SHALL sair.

#### Scenario: P1.11 · Lead novo na homologação
- **Dado** a homologação depois do ajuste do Drive
- **Quando** alguém salva um lead novo
- **Então** nenhuma pasta nasce nas pastas reais do escritório

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

### Requirement: P2.8 · O banco da homologação conferido
O que existe no banco da homologação além do portal (o esquema `juridico`, as cópias `zz_backup_*` e a `_snap_pgss`) SHALL ficar registrado no cartão com nomes e contagens, sem ler dado, junto com a proposta de separar ou apagar. Apagar MUST ficar com o Mateus.

#### Scenario: P2.8 · Conferência só de leitura
- **Dado** a autorização do Mateus
- **Quando** o banco da homologação é conferido
- **Então** o cartão traz os nomes, as contagens e a proposta, e nenhum dado foi lido nem apagado

### Requirement: P2.9 · A main protegida
A `main` SHALL exigir pedido, os 3 testes da CI e 1 aprovação de outra pessoa antes de mesclar.

#### Scenario: P2.9 · Pedido sem aprovação
- **Dado** um pedido com a CI vermelha ou sem aprovação de outra pessoa
- **Quando** alguém tenta mesclar na `main`
- **Então** o GitHub não deixa

### Requirement: P2.10 · O CodeQL sem falso alerta aberto
Os 2 alertas do CodeQL em `textoDoHtml` SHALL ficar dispensados como falso positivo, com o motivo. O da regex lenta fecha pelo código (P2.2).

#### Scenario: P2.10 · Aba de alertas
- **Dado** o código de `textoDoHtml` reconferido
- **Quando** os alertas são dispensados e o #62 entra na `main`
- **Então** a aba de alertas não mostra nenhum dos 3
