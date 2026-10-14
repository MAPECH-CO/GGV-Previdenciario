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

Em produção (`NODE_ENV=production`), o modo de entrega de mentira dos testes de tela (`RELACIONAMENTO_SIMULADO=entrega`)
MUST NOT valer: a mensagem segue como não enviada, mesmo com a variável posta por engano (revisão do #63, 12/10).

#### Scenario: P1.1 · A entrega de mentira não vale em produção
- **Dado** o servidor em produção, sem as variáveis do Chatwoot e com `RELACIONAMENTO_SIMULADO=entrega`
- **Quando** alguém manda uma mensagem pronta ao cliente
- **Então** a mensagem fica gravada como não enviada, com o motivo "simulado, não saiu"

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

A CSP SHALL aceitar quadro (`frame-src`) da própria origem e de `blob:`, porque a tela imprime o kit do contrato em PDF
num quadro escondido com o arquivo baixado em `blob:` (revisão do #62, 12/10: sem isso, a impressão era barrada).

#### Scenario: P1.3 · Imprimir o kit em PDF
- **Dado** o kit do contrato em PDF, baixado pela tela em "Colher assinatura"
- **Quando** a pessoa manda imprimir
- **Então** o quadro com o PDF abre, e a CSP não barra o endereço `blob:`

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

### Requirement: P3.1 · A Sênior aprova o caso que veio da Recepção
O portão G1 da aprovação SHALL contar como assinado o contrato da Recepção conferido (etapa da cópia em diante), e não só a tabela `contrato` da semente. A aprovação MUST seguir recusando, com o G1 no histórico, o caso sem kit cadastrado, com o checklist incompleto ou sem contrato assinado e conferido.

#### Scenario: P3.1 · Contrato conferido na Recepção
- **Dado** um caso que nasceu no "fechou" da Recepção, com o checklist completo e o contrato assinado e conferido
- **Quando** a Sênior aprova
- **Então** o caso vai para o INSS

#### Scenario: P3.1 · Contrato ainda na leitura
- **Dado** o mesmo caso com o contrato assinado, mas ainda não conferido
- **Quando** a Sênior aprova
- **Então** o portal recusa com "Contrato não assinado (G1)", e o bloqueio fica no histórico

### Requirement: P3.2 · A liberação ao Jurídico confere o G1 inteiro
A liberação ao Jurídico MUST recusar o caso sem kit cadastrado e o caso sem contrato assinado e conferido, com a mesma regra da aprovação, e o G1 SHALL ficar no histórico.

#### Scenario: P3.2 · Benefício sem kit cadastrado
- **Dado** um caso de um benefício sem kit cadastrado na Configuração
- **Quando** o Atendimento libera ao Jurídico
- **Então** o portal recusa com a mensagem do G1, e o bloqueio fica no histórico

### Requirement: P3.3 · O percentual de honorários vem do modelo
A Sênior SHALL informar, na Configuração, o percentual de honorários de cada modelo do kit. O contrato gerado SHALL guardar o percentual do modelo usado. A prestação de contas do caso SHALL ler esse percentual e MUST recusar um percentual digitado diferente do contrato.

#### Scenario: P3.3 · Prestação com o percentual do contrato
- **Dado** um modelo com 30% de honorários e um caso da Recepção com o kit gerado por ele
- **Quando** a advogada registra a prestação com 25%
- **Então** o portal recusa e diz que o percentual é o do contrato, 30%

### Requirement: P3.4 · O cálculo de tempo e pontos sai do CNIS digitado
O advogado do atendimento SHALL digitar no portal os vínculos do CNIS impresso ou baixado do Meu INSS. O servidor SHALL calcular em código, com teste, o tempo de contribuição, a carência e os pontos, e MUST NOT usar número calculado fora dele nem pela IA (G19). A regra de aposentadoria e o "já pode se aposentar" SHALL seguir escolhidos pelo advogado. O cálculo registrado libera o "Sim, fechou".

#### Scenario: P3.4 · Lead do servidor com o CNIS impresso
- **Dado** um lead do servidor cujo benefício exige cálculo, com o CNIS impresso
- **Quando** o advogado digita os vínculos, escolhe a regra e registra o cálculo
- **Então** o tempo, a carência e os pontos são os do servidor, e o "Sim, fechou" fica liberado

### Requirement: P3.5 · A Sênior vê o cálculo na conferência
A conferência da Sênior SHALL mostrar o último cálculo do caso: tempo, pontos, carência, regra, se já pode aposentar, quem calculou e quando.

#### Scenario: P3.5 · Conferência com cálculo
- **Dado** um caso com o cálculo registrado na Recepção
- **Quando** a Sênior abre a conferência
- **Então** vê o cálculo com quem o fez e quando

### Requirement: P3.6 · A agenda marca com as advogadas e as Sêniores reais
O portal SHALL listar as advogadas e as Sêniores pelos usuários com esse perfil, e a marcação SHALL guardar o id de quem atende, para o filtro "só as minhas".

#### Scenario: P3.6 · Marcar com uma advogada
- **Dado** uma advogada cadastrada como usuária do portal
- **Quando** o Atendimento marca a entrevista com ela
- **Então** o compromisso guarda o id e o nome dela

### Requirement: P3.7 · A desistência antes da entrevista fica no servidor
O resultado da entrevista marcada SHALL aceitar "desistiu", com o motivo da lista (G16) e a data de recontato opcional. Sem motivo, MUST recusar. Com recontato, a data SHALL ir para a agenda; sem recontato, o lead SHALL ser arquivado com o motivo.

#### Scenario: P3.7 · Desistiu e pediu para ligar depois
- **Dado** um lead com a entrevista marcada
- **Quando** o Atendimento registra que ele desistiu, com o motivo e o recontato para daqui a um mês
- **Então** o motivo fica no histórico, e o recontato aparece na agenda na data

### Requirement: P3.8 · A ficha guarda o bairro
A edição da ficha SHALL aceitar o bairro, como o endereço e a cidade.

#### Scenario: P3.8 · Completar a ficha
- **Dado** o kit pedindo o bairro que falta na ficha
- **Quando** o Atendimento completa a ficha com o bairro
- **Então** o bairro fica gravado, e o kit pode ser gerado

### Requirement: P4.1 · A IA lê o conteúdo dos documentos do balcão
A leitura dos documentos que chegam pelo card, pelo chat e pelo scanner SHALL vir do conteúdo do arquivo, lido pelo motor de IA:
- o tipo, a data, o nome, o CPF, o RG e o endereço;
- a assinatura, a data em branco e a legibilidade;
- no documento médico, quem emitiu e o registro profissional.

O nome do arquivo MUST NOT decidir nada da leitura. O código MUST conferir o CPF, a data e o tipo antes de guardar, e a pessoa confere antes de arquivar. Sem a IA (sem chave, recusada ou com falha), o documento SHALL ficar a conferir, com confiança zero, para a pessoa classificar.

#### Scenario: P4.1 · O CNIS lido pelo conteúdo
- **Dado** um CNIS enviado pelo card, com o nome e o CPF do cliente no conteúdo
- **Quando** o conteúdo chega ao servidor
- **Então** a leitura traz o tipo, o nome e o CPF que a IA leu, e o documento fica a conferir

#### Scenario: P4.1 · O nome do arquivo não conta
- **Dado** um documento assinado, num arquivo chamado "sem assinatura"
- **Quando** a IA lê e acha a assinatura
- **Então** a leitura não aponta falta de assinatura

#### Scenario: P4.1 · CPF que não confere
- **Dado** a IA leu um CPF inválido
- **Quando** a leitura é guardada
- **Então** o CPF fica de fora da leitura

#### Scenario: P4.1 · Sem IA
- **Dado** o servidor sem a chave da IA
- **Quando** o conteúdo chega
- **Então** o documento fica a conferir, com confiança zero, e a pessoa classifica

### Requirement: P4.2 · A ficha em papel e a segunda ficha lidas pelo motor
A leitura da ficha de atendimento em papel e a da segunda ficha SHALL receber o arquivo digitalizado (PDF ou imagem), guardá-lo em Documentos pessoais e devolver os campos que a IA leu, com os que ela não leu. Sem o arquivo, a leitura MUST recusar.

A senha do gov.br escrita no papel SHALL ir direto ao cofre (GGVP-24 CA15). Ela MUST NOT aparecer em nenhum destes lugares (G9):
- na resposta, na ficha ou no histórico;
- no registro da IA;
- no log.

A seção médica da segunda ficha segue só para quem vê dado de saúde.

#### Scenario: P4.2 · A senha escrita na ficha
- **Dado** a ficha em papel com a senha do gov.br escrita
- **Quando** a IA lê a ficha
- **Então** a senha vai ao cofre, a resposta diz só que havia senha, e o valor não está na resposta, no histórico nem no registro da IA

#### Scenario: P4.2 · Sem o arquivo
- **Quando** a leitura da ficha em papel é pedida sem o arquivo
- **Então** o portal recusa com "Anexe a ficha digitalizada (PDF ou imagem)."

#### Scenario: P4.2 · Sem IA
- **Dado** o servidor sem a chave da IA
- **Quando** a ficha digitalizada chega
- **Então** a imagem fica guardada, e todos os campos voltam como não lidos

### Requirement: P4.3 · O papel do scanner entra pelo Drive
O portal SHALL olhar o Drive do escritório a cada minuto, pela lista de mudanças, e trazer o arquivo novo que aparecer na pasta de um cliente:
- o arquivo entra na ficha como chegado pelo scanner e aponta para o Drive, sem cópia;
- a IA lê o arquivo;
- os arquivos da mesma ficha que chegam juntos formam o lote da tarefa "Receber documento" aberta dela.

A pasta que ainda não está ligada a uma ficha SHALL ser ligada só quando o título dela leva a uma ficha só (CPF, depois nome, a regra do balcão).

MUST NOT entrar:
- o que o próprio portal mandou ao Drive;
- pasta, item da lixeira e o que está em "A REVISAR";
- o mesmo arquivo duas vezes.

A rodada MUST NOT rodar com o Drive só leitura, para não trazer documento real à homologação. A escolha fica no ADR-017 (decisão do Mateus, 13/10).

#### Scenario: P4.3 · Arquivo novo na pasta ligada
- **Dado** a pasta do cliente ligada à ficha
- **Quando** o scanner guarda um PDF nela
- **Então** na rodada seguinte o arquivo aparece na ficha como do scanner, e a IA lê

#### Scenario: P4.3 · A mesma mudança duas vezes
- **Quando** a mudança do mesmo arquivo chega de novo
- **Então** o arquivo não se repete na ficha

#### Scenario: P4.3 · Arquivo do próprio portal
- **Quando** a mudança é de um arquivo que o portal enviou
- **Então** nada entra

#### Scenario: P4.3 · Pasta que serve a duas fichas
- **Dado** uma pasta não ligada, cujo título serve a duas fichas
- **Quando** um arquivo novo aparece nela
- **Então** a pasta não é ligada, e nada entra

#### Scenario: P4.3 · Drive só leitura
- **Dado** o Drive só leitura
- **Então** a rodada do scanner não roda

### Requirement: P4.4 · O contrato assinado de verdade
A digitalização do contrato assinado em papel SHALL receber o arquivo (PDF ou imagem) e guardá-lo como documento do caso.

A leitura SHALL ser da IA sobre o arquivo:
- a assinatura;
- as páginas e rubricas que faltam, contra os documentos do kit;
- o que mais ela apontar.

A regra que já existe decide entre a conferência do Atendimento e a cópia. Sem a IA, o contrato MUST ir à conferência, com o motivo. A cópia ao cliente SHALL sair do arquivo guardado.

#### Scenario: P4.4 · Assinado e completo
- **Dado** o contrato digitalizado, com a assinatura e todas as páginas
- **Quando** a IA lê
- **Então** o contrato segue para a cópia

#### Scenario: P4.4 · Falta uma rubrica
- **Dado** o contrato digitalizado sem a rubrica de uma página
- **Quando** a IA lê
- **Então** o Atendimento recebe a conferência com o que a IA apontou

#### Scenario: P4.4 · Sem o arquivo
- **Quando** a digitalização chega sem o arquivo
- **Então** o portal recusa com "Anexe o contrato assinado digitalizado (PDF ou imagem)."

#### Scenario: P4.4 · Sem IA
- **Dado** o servidor sem a chave da IA
- **Quando** a leitura do contrato roda
- **Então** o contrato vai à conferência com "A IA não leu o contrato agora: confira à mão."

### Requirement: P4.5 · Sem ZapSign
O portal MUST NOT oferecer o ZapSign, nem com a variável `ZAPSIGN_API_TOKEN`: nenhuma rota de envio ou de retorno. O serviço SHALL responder `zapsign: false`. A assinatura é só em papel (GGVP-136).

#### Scenario: P4.5 · Com a variável preenchida
- **Dado** o servidor com `ZAPSIGN_API_TOKEN`
- **Quando** a tela pergunta os serviços do contrato
- **Então** a resposta diz `zapsign: false`, e a rota de envio ao ZapSign não existe

### Requirement: P4.6 · Os 34 benefícios no servidor
O servidor SHALL aceitar os 34 benefícios do catálogo das telas, num catálogo só, com um id do servidor para cada um. O caso que nasce de qualquer um deles MUST guardar o benefício. A gestão SHALL publicar pela Configuração a lista de documentos de qualquer um deles. O benefício sem lista aprovada continua sem liberar o caso (GGVP-104 CA7).

#### Scenario: P4.6 · Caso de aposentadoria rural
- **Quando** o "Sim, fechou" de um lead da aposentadoria rural cria o caso
- **Então** o caso guarda o benefício

#### Scenario: P4.6 · A lista pela Configuração
- **Dado** a gestão publicou a lista de documentos da aposentadoria rural
- **Quando** o checklist do caso é montado
- **Então** ele usa essa lista

#### Scenario: P4.6 · Sem lista aprovada
- **Dado** um benefício sem lista publicada
- **Quando** o Atendimento libera o caso
- **Então** o portal recusa, dizendo que não há lista de documentos aprovada para o benefício

### Requirement: P4.7 · O Drive recebe só o conferido, e a pasta nasce no servidor
A rodada do Drive MUST NOT enviar o documento que chegou pelo card ou pelo chat antes de a Documentação conferir.

Ao criar a ficha com o Drive ligado, o servidor SHALL devolver as pastas de "#5. CLIENTES" que parecem ser do lead (CPF, depois nome). A rota da pasta SHALL:
- ligar a pasta escolhida;
- ou criar "<Nome> X A CLASSIFICAR", só com o CPF.

Com o Drive só leitura, nada é criado.

#### Scenario: P4.7 · Documento do card a conferir
- **Dado** um documento do card ainda não conferido
- **Quando** a rodada do Drive passa
- **Então** ele não vai ao Drive; depois de conferido, vai

#### Scenario: P4.7 · Pasta com o CPF do lead
- **Dado** uma pasta em "#5. CLIENTES" com o CPF do lead
- **Quando** a ficha é criada
- **Então** a resposta traz a pasta, e ligá-la grava na ficha e no histórico

#### Scenario: P4.7 · Pasta nova sem CPF
- **Quando** quem atende pede a pasta nova para um lead sem CPF
- **Então** o portal recusa com "A pasta nova só nasce com o CPF."

#### Scenario: P4.7 · Drive só leitura
- **Dado** o Drive só leitura
- **Quando** quem atende pede a pasta nova
- **Então** o portal recusa com "O Drive está só leitura: a pasta não pode ser criada."

### Requirement: P4.8 · A cobrança respeita o limite também na mensagem
O envio do modelo "cobrança" MUST obedecer ao limite da cobrança do caso. Com a cobrança na Sênior, ou antes dos 3 dias da última tentativa, o portal recusa com o mesmo motivo da cobrança.

#### Scenario: P4.8 · Cobrança na Sênior
- **Dado** a cobrança do caso passou do limite e está com a Sênior
- **Quando** o Atendimento manda a mensagem de cobrança
- **Então** o portal recusa com o motivo da cobrança

#### Scenario: P4.8 · Dentro do limite
- **Dado** a cobrança com uma tentativa, feita há 3 dias
- **Quando** o Atendimento manda a mensagem de cobrança
- **Então** a mensagem sai

### Requirement: P4.9 · O documento vai ao caso certo
Quando o cliente tem mais de um caso, o envio pelo card ou pelo chat MUST dizer o caso, e o conteúdo e a conferência SHALL usar esse caso.

O documento que chegou antes de existir o caso SHALL entrar no primeiro caso que nascer. O laudo vira documento médico desse caso, para o parecer.

#### Scenario: P4.9 · Dois casos, sem escolher
- **Dado** um cliente com dois casos
- **Quando** o Atendimento envia um documento sem dizer o caso
- **Então** o portal recusa com "Escolha o caso do documento."

#### Scenario: P4.9 · Dois casos, com o escolhido
- **Dado** um cliente com dois casos
- **Quando** o Atendimento envia o documento para o segundo caso
- **Então** o documento fica no segundo caso

#### Scenario: P4.9 · Laudo antes do caso
- **Dado** um laudo que chegou quando o lead ainda não tinha caso
- **Quando** o "Sim, fechou" cria o caso
- **Então** o laudo está no caso e aparece no parecer

### Requirement: P4.10 · A leitura de exemplo só nos testes de tela
Estas partes SHALL existir só com `LEITURA_SIMULADA=sim`, que só os testes de tela usam:
- a leitura de exemplo, pelo nome do arquivo;
- a chamada sem arquivo;
- as rotas que simulam o lote do scanner e a leitura do contrato.

O servidor MUST NOT subir com essa variável na homologação nem na produção.

#### Scenario: P4.10 · Homologação com a leitura de exemplo
- **Dado** `AMBIENTE=homologacao` e `LEITURA_SIMULADA=sim`
- **Quando** o servidor sobe
- **Então** ele recusa, dizendo que a leitura de exemplo é só dos testes

#### Scenario: P4.10 · Sem a variável
- **Dado** o servidor sem `LEITURA_SIMULADA`
- **Quando** a tela chama a rota que simula o lote do scanner
- **Então** a rota não existe

### Requirement: P5.1 · A orientação da perícia sai de verdade pelo Chatwoot
A orientação pelo Chatwoot SHALL ficar registrada como enviada só quando a mensagem saiu. A rota da orientação MUST achar a mensagem que o correio do cliente enviou (pelo id, quando vem, ou a mais nova) e conferir que ela:
- é do mesmo cliente;
- é do modelo "Perícia: data, o que levar e orientação";
- tem o texto da orientação;
- não ficou como "não saiu".

O lembrete da véspera ("Perícia: confirmar a presença") e a cobrança dos documentos da perícia ("Cobrança de documentos") SHALL seguir a mesma regra. A orientação por ligação fica como hoje, sem mensagem.

#### Scenario: P5.1 · A mensagem saiu
- **Dado** a orientação enviada pelo Chatwoot e entregue
- **Quando** o Jurídico administrativo registra a orientação com essa mensagem
- **Então** a perícia guarda a orientação com a mensagem, e a tarefa de orientar sai da fila

#### Scenario: P5.1 · A mensagem não saiu
- **Dado** a mensagem da orientação que ficou como "não saiu"
- **Quando** o Jurídico administrativo registra a orientação com ela
- **Então** o portal recusa com "A orientação não saiu pelo Chatwoot: envie de novo ou ligue para o cliente.", e nada é registrado

#### Scenario: P5.1 · Nada saiu
- **Dado** nenhuma mensagem da orientação enviada ao cliente
- **Quando** o Jurídico administrativo registra a orientação pelo Chatwoot
- **Então** o portal recusa com "Envie a orientação pelo Chatwoot antes de registrar."

### Requirement: P5.2 · O perito nasce da nomeação
Na classificação da nomeação de perito, a IA SHALL ler o nome do perito, quando ele está escrito, e a pessoa confere. Com o nome conferido, o servidor SHALL:
- achar o perito pelo nome e pelas grafias conhecidas;
- ou, sem achar, criá-lo com o tipo da perícia aberta do caso (médica ou social) e o perfil vazio;
- ligá-lo à perícia aberta.

A pergunta de um clique da Perícia SHALL aceitar também o nome de um perito novo. O perfil SHALL crescer laudo a laudo, na perícia médica e na social. Pelo Raio-X, o perito entra com o importador da parte 7, pela mesma regra.

#### Scenario: P5.2 · Perito novo
- **Dado** nenhum perito com o nome "Ana Souza"
- **Quando** a pessoa classifica a nomeação com o perito "Ana Souza"
- **Então** o perito nasce, fica ligado à perícia aberta do caso e aparece na lista de peritos

#### Scenario: P5.2 · Perito conhecido por outra grafia
- **Dado** o perito "José da Silva", com a grafia "Jose Silva"
- **Quando** a nomeação traz "Jose Silva"
- **Então** a perícia liga ao perito que já existe, sem criar outro

#### Scenario: P5.2 · O laudo da perícia social
- **Dado** a perícia social com o perito ligado
- **Quando** o laudo é registrado
- **Então** o perfil do perito ganha esse laudo

### Requirement: P5.3 · Os limites vêm da Configuração
Os laços SHALL ler os limites da Configuração. Quando a gestão não mudou nada, valem os números do Lucas:

| Laço | Tentativas | Intervalo |
|---|---|---|
| Cobrança de documento da Recepção | 2 | 3 dias |
| Confirmação da entrevista do lead (parâmetros novos) | 2 | 3 dias |
| Remarcação da perícia | 1 remarcação, depois sobe para a advogada responsável | — |

Com prazo do juiz ou do INSS, a próxima tentativa MUST NOT passar do dia antes do prazo. A Configuração SHALL dizer quais limites estão em uso. O do cliente sumido segue sem uso: o laço não existe e fica fora da parte 5.

#### Scenario: P5.3 · Cobrança com outro limite
- **Dado** a gestão pôs 3 tentativas na cobrança
- **Quando** a segunda tentativa fica sem resposta
- **Então** a cobrança não sobe para a Sênior

#### Scenario: P5.3 · Remarcação da perícia
- **Dado** o limite padrão de 1 remarcação
- **Quando** a perícia é remarcada pela segunda vez
- **Então** ela sobe para a advogada responsável

#### Scenario: P5.3 · Confirmação do lead
- **Dado** a gestão pôs 3 tentativas na confirmação da entrevista
- **Quando** a segunda tentativa fica sem confirmação
- **Então** a confirmação não sobe para a Sênior

#### Scenario: P5.3 · O prazo manda
- **Dado** uma cobrança com prazo do juiz daqui a 2 dias e 3 dias entre as tentativas
- **Quando** a tentativa de hoje fica sem resposta
- **Então** a próxima fica para o dia antes do prazo

### Requirement: P5.4 · A espera de fora volta ao topo todo dia útil
Enquanto o caso espera o INSS ou o resultado da perícia já feita, a Central da advogada SHALL mostrar a espera no topo uma vez por dia útil. Do INSS, contam as três esperas: receber o requerimento, decidir e analisar a resposta.

Com "Olhei, sem novidade", a espera SHALL sair do topo até o próximo dia útil, e a marca fica no histórico. Fim de semana e feriado não chamam.

A espera da Justiça fica com a vigília do diário, que olha três vezes por dia. A vigília do Meu INSS continua manual.

#### Scenario: P5.4 · Dia útil
- **Dado** um caso esperando o INSS decidir
- **Quando** a advogada abre a Central numa terça-feira útil
- **Então** o caso está no topo, com "Olhar a espera: INSS decidir"

#### Scenario: P5.4 · Olhei, sem novidade
- **Quando** a advogada marca "Olhei, sem novidade"
- **Então** a espera sai do topo até o próximo dia útil, e a marca fica no histórico

#### Scenario: P5.4 · Sábado
- **Dado** um sábado
- **Quando** a advogada abre a Central
- **Então** a espera não está no topo

### Requirement: P5.5 · A perícia do juiz com a data da publicação
Quando a exigência do juiz abre a perícia e a publicação traz a data, a hora e o local, o servidor SHALL marcar a perícia na hora, como lida pelo sistema, sem a tarefa de marcar. Também:
- o resumo do processo SHALL dizer que o sistema marcou;
- a tarefa de orientar SHALL dizer que o sistema marcou, com a data e como preparar.

Sem data na publicação, a tarefa de marcar nasce, como hoje.

#### Scenario: P5.5 · Data na publicação
- **Dado** a publicação da exigência com "perícia médica em 20/11/2026, às 9h, na sede da Justiça Federal"
- **Quando** a exigência é distribuída pedindo a perícia médica
- **Então** a perícia fica marcada para 20/11/2026, às 9h, o resumo do processo diz que o sistema marcou, e não nasce a tarefa de marcar

#### Scenario: P5.5 · Sem data
- **Dado** a publicação sem data da perícia
- **Quando** a exigência é distribuída pedindo a perícia
- **Então** nasce a tarefa de marcar, como hoje

### Requirement: P5.6 · O item sem documento passa antes pela dilação ou pelo reagendamento
Para encerrar sem prova um item da exigência do juiz, a advogada SHALL ter antes o pedido de dilação do prazo autorizado pela Sênior nesta exigência. Na perícia, vale o pedido de reagendamento registrado. Sem nenhum dos dois, ela SHALL dizer por que nenhum cabe. Sem isso, o portal MUST recusar.

#### Scenario: P5.6 · Sem dilação
- **Dado** a exigência sem pedido de dilação
- **Quando** a advogada encerra um item sem prova, só com o motivo
- **Então** o portal recusa com "Antes de encerrar sem prova, peça a dilação do prazo (na perícia, o reagendamento). Se nenhum cabe, diga por quê."

#### Scenario: P5.6 · Depois da dilação
- **Dado** a dilação autorizada pela Sênior nesta exigência
- **Quando** a advogada encerra o item sem prova, com o motivo
- **Então** o item fica encerrado

#### Scenario: P5.6 · Nenhum cabe
- **Quando** a advogada encerra o item sem prova, com o motivo e o porquê de não caber a dilação
- **Então** o item fica encerrado, e o porquê fica no histórico

### Requirement: P5.7 · Encerrar só com o despacho esperando, e liberar de novo zera o OK
`POST /api/casos/:id/encerrar` SHALL aceitar só o caso que espera o despacho da Sênior, como a tela já mostra.

Liberar de novo um caso já aprovado SHALL zerar o OK anterior:
- o protocolo MUST NOT andar com o OK antigo;
- as tarefas abertas por ele (protocolar e decidir a perícia) são canceladas.

#### Scenario: P5.7 · Caso já despachado
- **Dado** um caso indeferido que a Sênior já despachou
- **Quando** a Sênior tenta encerrar o caso
- **Então** o portal recusa com "Este caso não está esperando o despacho da Sênior."

#### Scenario: P5.7 · Liberar de novo
- **Dado** um caso aprovado pela Sênior, com "Protocolar no Meu INSS" aberta
- **Quando** a Documentação libera o caso de novo
- **Então** "Protocolar no Meu INSS" sai da fila, e o protocolo só anda com o novo OK

### Requirement: P5.8 · O tribunal e a assinatura na Configuração
A Configuração SHALL mostrar e editar, com histórico:
- os tribunais do protocolo: nome, site e tamanho máximo por arquivo, em MB;
- a assinatura padrão da petição.

Só a gestão edita. Ao subir com um banco novo, o servidor SHALL pôr a Justiça Federal da 3ª Região, com 3 MB por arquivo, e a assinatura do Dr. Glauco, com a OAB a completar, só o que faltar. A petição MUST NOT protocolar com a assinatura a completar, e a peça não sai sem a assinatura inteira.

#### Scenario: P5.8 · Banco novo
- **Quando** o servidor sobe com um banco sem tribunal nem assinatura
- **Então** a Configuração mostra a Justiça Federal da 3ª Região e a assinatura a completar, e o histórico diz que o sistema pôs o padrão

#### Scenario: P5.8 · Assinatura a completar
- **Dado** a assinatura com "[completar]"
- **Quando** a advogada abre a petição aprovada
- **Então** a trava do pacote diz "A assinatura padrão da petição ainda tem [completar]: complete na Configuração."

#### Scenario: P5.8 · Mudar o tamanho
- **Quando** a Sênior muda o tamanho do tribunal para 10 MB
- **Então** a trava do pacote passa a usar 10 MB, e a mudança fica no histórico

### Requirement: P5.9 · A trava do pacote sem tribunal
Sem tribunal cadastrado, a trava do pacote MUST falhar com "Falta o tribunal do protocolo: a Sênior cadastra na Configuração." O protocolo SHALL recusar com a mesma mensagem.

#### Scenario: P5.9 · Nenhum tribunal
- **Dado** a Configuração sem tribunal
- **Quando** a advogada abre a petição aprovada
- **Então** a trava do pacote falha com a mensagem do tribunal que falta

### Requirement: P5.10 · O alarme da vigília chega ao suporte
Estes casos SHALL virar alarme:
- a rodada presa em "rodando" além do tempo vira falha;
- na produção, nenhuma fonte ligada.

Todo alarme SHALL ir ao topo da Central da Sênior e ao suporte técnico. Valem a falha de qualquer tipo, a rodada que não rodou e a vigília sem fonte. O suporte recebe:
- a mensagem no canal da equipe, por webhook;
- o chamado no Jira.

Cada um liga com as suas variáveis; sem elas, o alarme fica no portal e no log. O alarme sai uma vez por rodada e MUST NOT levar dado de cliente nem texto de publicação.

#### Scenario: P5.10 · Rodada presa
- **Dado** uma rodada em "rodando" há 15 minutos
- **Quando** o relógio da vigília bate
- **Então** a rodada vira falha, com o motivo

#### Scenario: P5.10 · Produção sem fonte
- **Dado** a produção sem fonte de publicação ligada
- **Quando** a Sênior abre a Central
- **Então** o topo diz que a vigília está sem fonte ligada

#### Scenario: P5.10 · Falha de qualquer tipo
- **Dado** o canal e o Jira ligados
- **Quando** uma rodada falha por tempo esgotado
- **Então** sai uma mensagem no canal e um chamado no Jira, com a fonte, o horário e o motivo, uma vez só

### Requirement: P5.11 · Os feriados do ano que falta
Quando o ano corrente não tem feriado nenhum, a Central da Sênior SHALL mostrar "Carregar os feriados de <ano>". O mesmo vale para o ano seguinte, a partir de dezembro. A carga da lei SHALL aceitar o ano.

#### Scenario: P5.11 · Dezembro sem o ano seguinte
- **Dado** dezembro de 2027, sem feriados de 2028
- **Quando** a Sênior abre a Central
- **Então** ela vê "Carregar os feriados de 2028"; depois da carga, os da lei de 2028 entram, e a tarefa some

### Requirement: P5.12 · Número de jurimetria fora do texto da peça
A aprovação da petição, da manifestação e do pedido de dilação MUST recusar o texto com número de jurimetria: taxa, tempo médio ou chance, no formato que o portal mostra (G22). A peça pode citar os entendimentos e os processos de exemplo.

A manifestação e a dilação sobem como arquivo: a IA lê o texto. Sem a leitura, a versão SHALL ser aprovada com o aviso para a advogada conferir à mão.

#### Scenario: P5.12 · Taxa no texto
- **Dado** a versão da manifestação com "71% em 34 processos · base de 07/10"
- **Quando** a advogada aprova a versão
- **Então** o portal recusa com "O texto cita número de jurimetria (G22): tire antes de aprovar."

#### Scenario: P5.12 · Entendimento citado
- **Dado** a versão que cita um entendimento do juízo e o processo de exemplo
- **Quando** a advogada aprova a versão
- **Então** a versão fica aprovada

#### Scenario: P5.12 · Sem a leitura da IA
- **Dado** a IA desligada
- **Quando** a advogada aprova a versão da manifestação
- **Então** a versão fica aprovada, com o aviso "A IA não leu a versão agora: confira à mão que o texto não cita número de jurimetria (G22)."

### Requirement: P5.13 · A jurimetria só para o Jurídico e os sócios
Estes números MUST ir só a quem tem `estudo.ver` (Jurídico e sócios), a mesma regra da GGVP-156 (#73):
- as taxas por perito, por juízo, por vara e por tese do painel de resultados;
- os números e o resumo do perfil do perito na perícia (o que observou, perguntou e pediu). O nome do perito segue para todos.

A taxa de êxito de cada advogada (o recorte por advogada) MUST ir só aos sócios (`resultados.ver_por_advogada`, matriz 31),
nem ao Jurídico (decisão do Mateus, 13/10, na revisão do #75).

Os outros perfis veem o resto do painel e da perícia, sem esses números.

#### Scenario: P5.13 · Painel por perito
- **Quando** o líder do Atendimento pede o painel de resultados por perito
- **Então** o portal recusa com "Os recortes por perito, juízo, vara e tese são da jurimetria: só o Jurídico e o Sócio veem."

#### Scenario: P5.13 · Taxa por advogada
- **Quando** a Sênior, o líder do Atendimento ou o Financeiro pedem o painel por advogada
- **Então** o portal recusa com "A taxa de êxito de cada advogada é só dos sócios.", e a tela não oferece o recorte
- **E** o Sócio vê o painel por advogada

#### Scenario: P5.13 · Perícia na Documentação
- **Quando** a Documentação abre a perícia do caso
- **Então** vê o perito, mas a resposta não traz os números nem o resumo do perfil dele

### Requirement: P5.14 · O juízo com o juiz e o perito
`GET /api/casos/:id/juizo` SHALL trazer também:
- o juiz do caso, com quantos casos do escritório estão com ele;
- o perito da perícia do caso, com quantos casos do escritório ele tem.

As contas são feitas no código. O resumo do processo SHALL trazer a vara, o juiz e o nome do perito, sem números, para todos que veem o caso.

#### Scenario: P5.14 · O juiz e o perito com os casos
- **Dado** dois casos do escritório com o mesmo juiz e o mesmo perito
- **Quando** a advogada abre o juízo de um deles
- **Então** o juiz e o perito vêm com 2 casos cada

#### Scenario: P5.14 · O resumo sem números
- **Quando** o Atendimento abre o resumo do processo
- **Então** vê a vara, o juiz e o nome do perito, sem número nenhum

### Requirement: P5.15 · O protocolo do recurso fecha a tarefa
A Sênior SHALL registrar o protocolo do recurso com o comprovante (PDF ou imagem, até 25 MB) e a data. O registro SHALL:
- fechar "Elaborar e protocolar o recurso";
- guardar o comprovante no caso;
- ficar no histórico.

O processo segue na vigília.

#### Scenario: P5.15 · Recurso protocolado
- **Dado** a tarefa "Elaborar e protocolar o recurso" aberta
- **Quando** a Sênior registra o protocolo com o comprovante
- **Então** a tarefa fecha, e o comprovante fica no caso

#### Scenario: P5.15 · Sem recurso a protocolar
- **Dado** um caso sem a tarefa do recurso
- **Quando** a Sênior registra o protocolo
- **Então** o portal recusa com "Este caso não tem recurso esperando o protocolo."

### Requirement: P6.1 · O texto da decisão de mérito só para quem vê dado de saúde
A confirmação do desfecho de mérito (o pedido #31, da GGVP-90) SHALL entrar na main com a revisão do Pedro, atualizada com a main. O `GET /api/casos/:id/desfecho` MUST devolver o texto da publicação da decisão só a quem tem `dado_saude.ver_detalhe`. Os outros perfis que veem o caso recebem o desfecho sem o texto. A separação é pelo perfil, no servidor, sem filtro por palavra.

#### Scenario: P6.1 · A advogada lê a decisão
- **Dado** a sentença que cita o laudo do perito
- **Quando** a advogada abre o desfecho do caso
- **Então** vê o texto da decisão

#### Scenario: P6.1 · O Atendimento não lê a decisão
- **Dado** a mesma sentença
- **Quando** o Atendimento ou a Documentação abrem o desfecho
- **Então** veem o desfecho sem o texto da decisão

### Requirement: P6.2 · A entrada e as parcelas ficam no contrato
Ao gerar o kit do contrato ("Preparar contrato"), quem conduz SHALL poder registrar o que foi combinado com o cliente:
- o valor da entrada;
- as parcelas: quantas e o valor de cada uma.

O servidor MUST conferir os valores pela biblioteca `campos`, guardar o combinado no contrato do caso e registrar no histórico da ficha. Sem o combinado, o contrato fica como hoje; gerar de novo sem ele mantém o que já estava.

#### Scenario: P6.2 · O combinado fica no contrato
- **Dado** o contrato para preparar
- **Quando** a Recepção gera o kit com a entrada de R$ 500,00 e 4 parcelas de R$ 300,00
- **Então** o contrato guarda o combinado, e o histórico da ficha diz qual foi

#### Scenario: P6.2 · Valor errado
- **Quando** o valor da parcela vem como "abc"
- **Então** o portal recusa com "Informe o valor de cada parcela, como 1.234,56", e o kit não é gerado

### Requirement: P6.3 · A prestação de contas segue o contrato
A prestação de contas SHALL abrir com a entrada e as parcelas do contrato, editáveis antes do OK. Nela:
- o percentual de honorários é o do contrato e não muda (como hoje);
- os honorários saem do percentual, e quem confere pode ajustá-los antes do OK;
- o repasse é sempre o valor recebido menos os honorários, em centavos, calculado no código;
- a forma de pagamento é Pix ou boleto do escritório no nome do cliente, e uma parte pode ser paga na Caixa, quando o escritório vai junto, até o valor dos honorários;
- não há custas.

Cada valor MUST guardar a fonte: o contrato, o cálculo do sistema, quem conferiu ou a carta de concessão. Transferência e dinheiro deixam de ser aceitos; as versões antigas com eles continuam legíveis.

#### Scenario: P6.3 · A prestação abre com o contrato
- **Dado** o contrato com a entrada e as parcelas
- **Quando** a advogada abre a prestação
- **Então** vê a entrada e as parcelas, com a fonte "contrato"

#### Scenario: P6.3 · Ajuste antes do OK
- **Dado** a prestação aberta
- **Quando** a advogada ajusta os honorários e as parcelas e dá o OK
- **Então** a versão guarda os valores com a fonte "quem conferiu", o histórico guarda o calculado e o ajustado, e o repasse fecha em centavos

#### Scenario: P6.3 · Contrato sem o combinado
- **Dado** um contrato sem a entrada e as parcelas
- **Quando** a advogada abre a prestação
- **Então** os dois vêm vazios, sem zero inventado, e ela preenche

#### Scenario: P6.3 · A parte na Caixa
- **Quando** a parte paga na Caixa passa dos honorários
- **Então** o portal recusa com "A parte paga na Caixa vai até o valor dos honorários."

### Requirement: P6.4 · A ida ao banco: a ligação registra, e o WhatsApp sai de verdade
O aviso da ida ao banco SHALL ser a ligação do Financeiro, registrada no portal depois do OK e do recebimento, como hoje. A mensagem pelo WhatsApp SHALL ser só o complemento:
- depois da ligação registrada;
- com o texto do modelo aprovado "Confirmação da ida ao banco", sem mudar uma letra;
- enviada de verdade pelo Chatwoot. A que não sai MUST ser recusada com o motivo e ficar no histórico do cliente.

E-mail e SMS saem da lista, porque o portal não envia por eles. Ao subir com banco de verdade, o modelo "Confirmação da ida ao banco" SHALL entrar se faltar; a Sênior ajusta o texto na Configuração.

#### Scenario: P6.4 · A ligação
- **Dado** o OK da advogada e o recebimento
- **Quando** o Financeiro registra a ligação
- **Então** o aviso fica registrado, e o caso entra no acervo, como hoje

#### Scenario: P6.4 · O WhatsApp antes da ligação
- **Quando** o Financeiro manda o complemento sem a ligação registrada
- **Então** o portal recusa com "Ligue para o cliente antes: a mensagem é só o complemento da ligação."

#### Scenario: P6.4 · O WhatsApp que não saiu
- **Dado** a ligação registrada e o Chatwoot que não entregou
- **Quando** o Financeiro manda o complemento
- **Então** o portal recusa com o motivo, e a tentativa fica no histórico do cliente

#### Scenario: P6.4 · O modelo ao subir
- **Dado** um banco sem o modelo "Confirmação da ida ao banco"
- **Quando** o servidor sobe
- **Então** o modelo nasce; o que a Sênior mudou nunca é refeito

### Requirement: P6.5 · A mensagem do WhatsApp entra no portal
O Chatwoot SHALL avisar o portal de cada mensagem por uma rota pública, com um segredo no endereço (`CHATWOOT_WEBHOOK_SEGREDO`). A rota MUST:
- responder 404 sem o segredo certo, ou sem a variável;
- não registrar o endereço no log;
- aceitar só a conta e a caixa do escritório;
- fora da produção, aceitar só os telefones de teste, como no envio.

A mensagem do cliente SHALL entrar na conversa do WhatsApp da pessoa do telefone, cliente ou lead, ligada ao caso mais recente. Sem pessoa com o telefone, o lead SHALL nascer com o nome do contato. A conversa junta as mensagens até 30 minutos sem mensagem nova, e a seguinte abre outra. A resposta do escritório pelo Chatwoot entra na mesma conversa. A entrega e a leitura de uma mensagem que o portal mandou SHALL atualizar o status dela.

#### Scenario: P6.5 · Cliente conhecida
- **Dado** a cliente com o telefone (11) 98888-7777
- **Quando** chega pelo WhatsApp "Mudei de endereço"
- **Então** a mensagem entra na conversa do WhatsApp dela, ligada ao caso

#### Scenario: P6.5 · Telefone novo
- **Dado** nenhuma pessoa com o telefone
- **Quando** chega a primeira mensagem
- **Então** o lead nasce com o nome do contato, e a mensagem entra na conversa dele

#### Scenario: P6.5 · Segredo errado
- **Quando** alguém chama a rota com outro segredo
- **Então** o portal responde 404 e não grava nada

#### Scenario: P6.5 · Entregue e lida
- **Dado** a orientação da perícia que saiu pelo portal
- **Quando** o Chatwoot avisa que ela foi lida
- **Então** a mensagem passa a "lida"

### Requirement: P6.6 · A IA da conversa só aponta o que foi dito, e a Sênior confere
Na análise da conversa, a IA SHALL apontar só o valor que aparece na fala de onde veio:
- o texto, sem acento nem caixa;
- os números do telefone, do CPF, do CEP e do NB;
- a data, em números ou com o mês escrito.

O que não aparece MUST ficar de fora, conferido no código. O fato novo e o documento citado seguem como hoje, com a fala junto.

Quem conduziu a conversa SHALL registrar e responder a pendência. Confirmar, corrigir ou desfazer o que a IA apontou SHALL ser da Sênior, numa tarefa dela. Na conversa do WhatsApp, quem responde a pendência é o Atendimento.

#### Scenario: P6.6 · O valor que não foi dito
- **Dado** a fala "moro na Rua das Flores"
- **Quando** a IA aponta o endereço "Rua das Palmeiras"
- **Então** o item fica de fora da conferência

#### Scenario: P6.6 · Quem conduziu não confirma
- **Dado** a conversa da atendente, com dois itens apontados
- **Quando** a atendente confirma um item
- **Então** o portal recusa com "Quem confirma, corrige ou desfaz o que a IA apontou é a Sênior."

#### Scenario: P6.6 · A Sênior confere
- **Dado** a pendência respondida pela atendente
- **Quando** a Sênior confirma um item e desfaz o outro
- **Então** só o confirmado entra na ficha, e a tarefa dela fecha

### Requirement: P6.7 · A pendência da conversa é uma tarefa
A pendência que nasce na conferência SHALL virar uma linha da tabela de tarefas, com a pessoa, o responsável e o prazo, e o caso quando há. A pendência de quem ainda não tem caso SHALL ser tarefa da pessoa, sem caso. Dar por cumprida MUST fechar a linha, e o prazo novo da Sênior muda a linha. A Central SHALL ler as linhas, sem ler todas as conversas.

#### Scenario: P6.7 · O lead sem caso
- **Dado** a conversa com um lead, sem caso
- **Quando** a atendente responde que surgiu pendência para a Documentação
- **Então** nasce a tarefa da pessoa, sem caso, e ela aparece na Central da responsável

#### Scenario: P6.7 · Cumprida
- **Quando** a responsável dá a pendência por cumprida
- **Então** a tarefa fecha e sai da Central

#### Scenario: P6.7 · Prazo novo
- **Dado** a pendência atrasada
- **Quando** a Sênior dá um prazo novo
- **Então** a tarefa passa a ter o prazo novo

### Requirement: P6.8 · Telefone, e-mail e dado bancário só com o cliente verificado, também na ligação
Na ligação e no WhatsApp, a verificação do cliente SHALL ser por chamada de vídeo; "no escritório" só vale na conversa presencial. Quem conduziu SHALL registrar a verificação na conversa (como, quem e quando), e a conversa SHALL devolvê-la. A conferência MUST usar a verificação registrada. A recusa fica no histórico, como hoje.

#### Scenario: P6.8 · Ligação com vídeo
- **Dado** a ligação em que a atendente verificou o cliente por chamada de vídeo
- **Quando** a Sênior confirma o telefone novo, em contrato novo
- **Então** o telefone muda, e a verificação fica na conversa

#### Scenario: P6.8 · Ligação com "no escritório"
- **Quando** a atendente registra, numa ligação, a verificação "no escritório"
- **Então** o portal recusa com "Na ligação e no WhatsApp, o cliente se verifica por chamada de vídeo."

#### Scenario: P6.8 · Sem verificação
- **Dado** a ligação sem verificação
- **Quando** a Sênior confirma o e-mail novo
- **Então** o portal recusa, e a recusa fica no histórico

### Requirement: P7.1 · A estratégia do caso: a IA propõe, e o Jurídico confere
A página do processo SHALL ter a estratégia do caso, que só quem vê o estudo de caso (o Jurídico e os sócios) lê. A IA SHALL propor a estratégia, pronta e sem botão, pelo que o caso já tem:
- o parecer registrado;
- o despacho da Sênior;
- o motivo do indeferimento;
- o resultado da perícia;
- a decisão de mérito;
- os casos parecidos do acervo.

A advogada ou a Sênior confere, ajusta e salva. Cada versão salva MUST ficar no histórico, com quem e quando. Pedir outra proposta é o único botão.

#### Scenario: P7.1 · A proposta pronta
- **Dado** o caso com o parecer registrado
- **Quando** a advogada abre a estratégia
- **Então** a proposta da IA já está lá, com as fontes, para conferir

#### Scenario: P7.1 · Salvar com ajuste
- **Dado** a proposta da IA
- **Quando** a advogada ajusta o texto e salva
- **Então** a estratégia vale com o texto dela, e a versão fica no histórico com quem e quando

#### Scenario: P7.1 · Fora do Jurídico
- **Quando** o Atendimento abre o resumo do processo
- **Então** ele vem sem a estratégia

### Requirement: P7.2 · As tarefas da Recepção são linhas da tabela de tarefas
Estas tarefas, que a Central do Atendimento calcula no navegador, SHALL ser linhas da tabela de tarefas:
- "Cobrar documento" e "Decidir cobrança" (D1.23);
- "Conferir checklist" (D1.21);
- "Reenviar boas-vindas" (D1.22);
- as do fechamento (D1.14).

O servidor MUST abrir e fechar cada linha a cada mudança do que a origina, com a pessoa e o caso, quando há. A Central geral SHALL mostrar também a tarefa da pessoa que ainda não tem caso.

#### Scenario: P7.2 · A cobrança aberta
- **Dado** o caso com documento faltando
- **Quando** a cobrança abre
- **Então** nasce a linha "Cobrar documento" do Atendimento, com o prazo da próxima tentativa

#### Scenario: P7.2 · A cobrança encerrada
- **Dado** a linha "Cobrar documento" aberta
- **Quando** o documento chega e a cobrança encerra
- **Então** a linha fecha

#### Scenario: P7.2 · O fechamento do lead
- **Dado** o lead entrevistado, ainda sem caso
- **Quando** a entrevista termina sem o fechamento registrado
- **Então** a tarefa do fechamento aparece na Central do Atendimento, da pessoa, sem caso

### Requirement: P7.3 · O chat só cria tarefa e só pede a peça quando pode
Criar tarefa pelo chat SHALL ser só de quem tem `tarefa.atribuir` (a Sênior e o líder do Atendimento). Pedir a peça pelo chat MUST esperar o despacho da Sênior:
- sem a tarefa "Pedir a petição" aberta pelo despacho, recusa;
- com ela, aponta para a mesma tarefa, sem criar outra.

#### Scenario: P7.3 · Quem não atribui tarefa
- **Quando** a atendente pede ao chat para criar uma tarefa
- **Então** o chat não oferece a ação, e o servidor recusa se ela vier

#### Scenario: P7.3 · A peça antes do despacho
- **Dado** o caso sem o despacho da Sênior
- **Quando** a advogada pede a peça pelo chat
- **Então** o chat diz "A petição é pedida depois do despacho da Sênior.", e nenhuma tarefa nasce

#### Scenario: P7.3 · A peça depois do despacho
- **Dado** a tarefa "Pedir a petição" aberta pelo despacho
- **Quando** a advogada pede a peça pelo chat
- **Então** o chat aponta para a mesma tarefa, e nenhuma outra nasce

### Requirement: P7.4 · A sugestão de benefício vem do acervo de verdade
A sugestão de benefício da entrevista SHALL vir da IA, com os casos parecidos do acervo de verdade, pronta quando a transcrição fica pronta, e com as fontes. A IA SHALL recomendar sempre; sem caso parecido, diz que não achou referência na casa. A advogada confirma ou não, e a recusa fica no histórico, com o motivo. O servidor MUST deixar de usar o acervo e o CNIS de exemplo.

#### Scenario: P7.4 · Pronta, com as fontes
- **Dado** a entrevista transcrita
- **Quando** a advogada abre a definição do benefício
- **Então** a sugestão da IA já está lá, com os casos do acervo de onde veio

#### Scenario: P7.4 · Sem caso parecido
- **Dado** um acervo sem caso parecido
- **Quando** a sugestão fica pronta
- **Então** ela vem com "Sem referência na casa" no porquê

#### Scenario: P7.4 · A advogada recusa
- **Quando** a advogada escolhe outro benefício
- **Então** a recusa fica no histórico, com o motivo e a sugestão que ela recusou

#### Scenario: P7.4 · Sem a IA
- **Dado** o servidor sem a IA
- **Quando** a advogada abre a definição
- **Então** não há sugestão, e o aviso diz que a IA não respondeu

### Requirement: P7.5 · O desfecho entra no acervo quando é conhecido
O registro do desfecho de cada caso no acervo SHALL nascer quando o desfecho é conhecido:
- o deferimento no INSS, na hora do registro;
- o desfecho de mérito, pela mesma função;
- a ida ao banco, como hoje.

Um registro por caso MUST valer, sem duplicar, com o número, o perito, o juízo e a data da decisão, sem dado pessoal.

#### Scenario: P7.5 · O deferimento no INSS
- **Quando** a vigília registra o deferimento do caso
- **Então** o caso entra no acervo como deferido, com a data da decisão

#### Scenario: P7.5 · Sem duplicar
- **Dado** o caso já no acervo
- **Quando** a ida ao banco é avisada
- **Então** o acervo segue com um registro só do caso

### Requirement: P7.6 · O valor da causa e a renda por pessoa do LOAS
O valor da causa (na petição) e a renda por pessoa do LOAS (na ficha e na entrevista) SHALL ficar no servidor, pela regra de valores do Pedro (06/10):
- a advogada grava;
- a advogada, o Sócio e o Financeiro leem;
- o Atendimento, a Documentação e a Sênior não leem.

O resumo do processo SHALL trazer os valores que o perfil pode ver. O valor MUST passar pela biblioteca `campos`.

#### Scenario: P7.6 · A advogada grava o valor da causa
- **Quando** a advogada grava o valor da causa de R$ 15.000,00
- **Então** o caso guarda o valor, e o Financeiro o vê no resumo do processo

#### Scenario: P7.6 · Quem não vê valor
- **Quando** o Atendimento pede os valores do caso
- **Então** o portal recusa com 403

#### Scenario: P7.6 · Valor errado
- **Quando** a advogada grava a renda "abc"
- **Então** o portal recusa com "Informe a renda por pessoa, como 1.234,56"

### Requirement: P7.7 · O importador do Raio-X
A Sênior SHALL subir a base histórica (o Raio-X dos processos) e ver antes o relatório da carga, sem gravar nada:
- quantos peritos, juízes, varas e processos vão entrar;
- a data de corte;
- as linhas recusadas, com o motivo.

Na confirmação, os processos MUST entrar no acervo com o desfecho, o benefício, o perito, o juízo e a vara. O mesmo processo carregado de novo não duplica.

Os indicadores do Raio-X SHALL sair da base importada, por código com teste, cada um com o número de casos e a data da base. O acervo não guarda CPF, endereço nem telefone, e nada do arquivo vai ao log. O formato é o do importador de hoje (a planilha com os títulos na primeira linha), com as colunas da base, até o Pedro entregar o formato do Raio-X.

#### Scenario: P7.7 · A simulação
- **Dado** a planilha com três processos, um sem número
- **Quando** a Sênior simula a carga
- **Então** vê dois processos, os peritos, os juízes, as varas, a data de corte e a linha recusada com o motivo, e nada é gravado

#### Scenario: P7.7 · A confirmação, sem duplicar
- **Dado** o relatório conferido
- **Quando** a Sênior confirma, e depois carrega a mesma planilha de novo
- **Então** os processos entram no acervo uma vez só

#### Scenario: P7.7 · Os indicadores
- **Dado** a base carregada
- **Quando** a Gestão abre o Raio-X
- **Então** cada indicador vem calculado da base, com o número de casos e a data da base

#### Scenario: P7.7 · Onde julgam, só para o Jurídico e o Sócio
- **Dado** a base carregada
- **Quando** o Financeiro ou a líder do Atendimento abrem o Raio-X
- **Então** veem os indicadores, mas o "Onde julgam" (a taxa de êxito por juízo) vem vazio, como na GGVP-156 CA3 e na P5.13
- **E** o Jurídico e o Sócio veem o "Onde julgam"

#### Scenario: P7.7 · As palavras de desfecho do Raio-X
- **Dado** a planilha com os desfechos "Êxito", "Acordo", "Perdido no mérito", "Extintos sem mérito" e "Em andamento"
- **Quando** a Sênior simula a carga
- **Então** eles entram como procedente, acordo, improcedente e extinto sem mérito, sem linha recusada
- **E** o "Em andamento" entra sem desfecho

#### Scenario: P7.7 · Dado pessoal na planilha
- **Dado** a planilha com as colunas nome, CPF e telefone
- **Quando** a Sênior simula
- **Então** as três aparecem como colunas ignoradas, e nada delas é gravado

### Requirement: P8.1 · Quem abre conteúdo médico fica registrado
Toda rota que entrega conteúdo com a trava do dado de saúde SHALL registrar a leitura, como as outras: quem leu, o perfil, o caso e o que foi lido. Valem:
- a lista da Recepção com as gravações do Jurídico;
- as perícias do caso com a recomendação aprovada;
- a recomendação sugerida pela IA;
- o texto da sentença.

Sem o conteúdo na resposta, nada MUST ser registrado.

#### Scenario: P8.1 · As gravações do Jurídico na lista da Recepção
- **Dado** a entrevista gravada com a advogada, só do Jurídico
- **Quando** a advogada abre a lista da Recepção
- **Então** a leitura fica registrada, uma vez por abertura
- **E** a Atendimento abre a lista sem a gravação, e nada é registrado

#### Scenario: P8.1 · A recomendação da perícia
- **Dado** a perícia com a recomendação aprovada
- **Quando** a advogada abre as perícias do caso, ou pede a recomendação da IA
- **Então** cada leitura fica registrada, com o caso

#### Scenario: P8.1 · O texto da sentença
- **Dado** a sentença de mérito com o texto
- **Quando** a advogada abre o desfecho do caso
- **Então** a leitura fica registrada
- **E** a Atendimento recebe o desfecho sem o texto, e nada é registrado

### Requirement: P8.2 · O registro das chamadas da IA só cresce
O banco MUST recusar alterar ou apagar uma chamada da IA já registrada, como no histórico (GGVP-106 CA4). Registrar uma chamada nova SHALL seguir como hoje.

#### Scenario: P8.2 · Alterar ou apagar
- **Dado** uma chamada da IA registrada
- **Quando** alguém tenta alterar ou apagar a linha no banco
- **Então** o banco recusa com "O histórico não pode ser alterado nem apagado"

### Requirement: P8.3 · A senha dita não fica no registro da IA
Na transcrição de áudio, o texto guardado no registro da chamada da IA MUST sair sem a senha dita (G9). A regra é a mesma da entrevista: a fala que cita a senha e a resposta logo depois. Vale para a entrevista e para a fala do chat.

#### Scenario: P8.3 · A senha dita na entrevista
- **Dado** o áudio em que o cliente diz "a senha é Girassol2024"
- **Quando** a transcrição volta
- **Então** o registro da chamada guarda a fala com a senha retirada, sem "Girassol2024"

### Requirement: P8.4 · O histórico da ficha também no histórico de auditoria
Cada linha nova do histórico da ficha (agenda, entrevista, contrato, documentos e o resto da Recepção) SHALL entrar também no histórico de auditoria, que não se altera: quem fez, quando e o que aconteceu, com a senha mascarada. A mesma linha MUST NOT entrar duas vezes.

#### Scenario: P8.4 · A entrevista marcada
- **Quando** a Atendimento marca a entrevista
- **Então** o histórico de auditoria recebe a linha "Marcou a entrevista…", com ela como autora e a hora
- **E** guardar a ficha de novo não repete a linha

#### Scenario: P8.4 · O que o sistema faz
- **Quando** o scanner guarda documentos na ficha
- **Então** a linha entra como do sistema, com o nome do scanner no detalhe

### Requirement: P8.5 · O áudio gravado fora do portal só entra com o aviso de gravação
O áudio da entrevista gravado fora do portal MUST ser recusado sem a confirmação de que a gravação começou com o aviso ao cliente (G10), como na ligação da conversa. Com a confirmação, o histórico da ficha SHALL dizer que o aviso foi confirmado.

#### Scenario: P8.5 · Sem a confirmação
- **Quando** a advogada sobe o áudio da entrevista sem marcar o aviso
- **Então** o portal recusa com "Confirme que a gravação começou com o aviso de gravação (G10)." e nada fica no caso

#### Scenario: P8.5 · Com a confirmação
- **Quando** a advogada sobe o áudio marcando o aviso
- **Então** o áudio entra e vai à transcrição, e o histórico diz que o aviso foi confirmado

### Requirement: P8.6 · A justificativa da dispensa e da nova tentativa só para quem vê dado de saúde
A justificativa em texto livre da dispensa do parecer e da nova tentativa do complemento MUST ficar só para quem vê dado de saúde (o Jurídico e o Sócio). Ela sai do histórico da ficha, e as telas dos outros perfis a recebem vazia. A decisão SHALL guardar o texto.

#### Scenario: P8.6 · A dispensa pedida
- **Dado** a Sênior pediu a dispensa do parecer com a justificativa
- **Quando** a Atendimento abre o parecer e a ficha
- **Então** vê que a dispensa foi pedida, por quem e quando, sem a justificativa
- **E** a advogada vê a justificativa

#### Scenario: P8.6 · A nova tentativa do complemento
- **Dado** a Sênior decidiu a nova tentativa com a justificativa
- **Quando** a Atendimento abre o complemento
- **Então** vê o prazo novo, sem a justificativa

### Requirement: P9.1 · A produção sobe pela versão que passou na homologação, sem variável de teste
A produção SHALL rodar com `AMBIENTE=producao`, num domínio próprio com https, e com a imagem pela tag do commit que passou na homologação. Nunca roda pela tag `main`, e liberar ou voltar uma versão é trocar a tag. Em produção, o servidor MUST NOT subir com variável de teste:
- `LEITURA_SIMULADA`;
- `GOOGLE_DRIVE_SO_LEITURA=sim`;
- `RELACIONAMENTO_SIMULADO` com valor diferente de `nao`.

Na recusa, a mensagem diz qual variável sobrou.

#### Scenario: P9.1 · O app copiado da homologação
- **Dado** `AMBIENTE=producao` com `GOOGLE_DRIVE_SO_LEITURA=sim`
- **Quando** o servidor sobe
- **Então** a largada para com a mensagem de que a variável é de teste

#### Scenario: P9.1 · Liberar uma versão
- **Dado** a versão que o /saude da homologação mostra
- **Quando** o Mateus põe essa tag no app da produção e faz o deploy
- **Então** o /saude da produção mostra a mesma versão

### Requirement: P9.2 · O banco da produção é o PrevGGVLucas, sem dado de teste
O banco da produção SHALL ser o PrevGGVLucas (São Paulo). A homologação MUST voltar ao "Portal Operacional", de Oregon, antes de a produção subir, para os dois apps nunca gravarem no mesmo. A produção só sobe depois do aceite do Lucas em todas as histórias. O PrevGGVLucas SHALL ficar limpo do teste antes da produção: os esquemas do portal saem, a largada roda todas as migrações de novo, e o depósito de arquivos fica vazio. Os modelos do Word sobem de novo, porque o registro deles sai com o banco. Quem roda a limpeza é o Mateus.

#### Scenario: P9.2 · A produção sobe vazia
- **Dado** o PrevGGVLucas limpo e a homologação em outro banco
- **Quando** a produção sobe
- **Então** as migrações rodam do zero, e não há usuário, caso nem documento de teste

### Requirement: P9.3 · O backup do banco, a restauração testada e a chave do cofre guardada
O backup diário do Supabase do banco da produção SHALL estar ligado e conferido. A restauração MUST ter sido testada num projeto temporário, com as migrações e as contagens conferidas. A `COFRE_CHAVE` da produção SHALL ser nova e ter uma cópia fora do servidor, no cofre de senhas do Mateus. O valor nunca passa pelo chat nem pelo repositório.

#### Scenario: P9.3 · A restauração
- **Dado** o backup mais novo do banco da produção
- **Quando** ele é restaurado num projeto temporário
- **Então** as migrações e as contagens batem com as da produção, e o Mateus apaga o temporário depois

### Requirement: P9.4 · Os arquivos com cópia no Drive, e o aviso quando ela atrasa
A cópia dos arquivos do portal SHALL ser a do Drive do escritório. Quando um documento pronto para o Drive passa de 2 dias sem cópia, o suporte MUST receber um aviso por dia, pelo canal e pelo Jira do alarme. O aviso diz quantos estão assim e quantos esperam a conferência, e nunca leva o nome do cliente nem o do arquivo. Com o Drive desligado ou só leitura, não há aviso.

#### Scenario: P9.4 · O Drive parou de receber
- **Dado** três documentos prontos para o Drive, sem cópia há 3 dias
- **Quando** a rodada do Drive roda duas vezes no mesmo dia
- **Então** o suporte recebe um aviso só, com a contagem e sem nome

### Requirement: P9.5 · O monitor do /saude avisa quando a produção cai e quando volta
O monitor SHALL olhar o `/saude` da produção a cada minuto, de um container à parte. Duas falhas seguidas MUST avisar o suporte de que o portal caiu, com o motivo: sem resposta em 10 segundos, resposta diferente de 200 ou `ok` diferente de `true`. A primeira resposta boa depois SHALL avisar que voltou, com quanto tempo ficou fora. O aviso vai pelo canal e pelo Jira do alarme da vigília.

#### Scenario: P9.5 · Uma falha só, no deploy
- **Dado** o /saude falhou uma vez e respondeu bem no minuto seguinte
- **Então** nenhum aviso sai

#### Scenario: P9.5 · A produção caiu e voltou
- **Dado** o /saude falhou duas vezes seguidas e voltou cinco minutos depois
- **Então** o suporte recebe "O portal caiu", com o motivo, e depois "O portal voltou", com o tempo fora
