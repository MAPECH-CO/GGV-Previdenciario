# Spec Delta · ggvp-119

## Purpose

Ambiente de homologação no Coolify, publicado a cada merge na `main`, e um ambiente de banco de desenvolvimento isolado por pessoa no Supabase, para que o Lucas teste no mesmo dia e ninguém precise de Docker na máquina.

## ADDED Requirements

### Requirement: CA1 · Merge na main publica em homologação
Um merge na `main` SHALL publicar `apps/api` e `apps/web` em homologação em até 10 minutos, com as migrações rodadas antes de a nova versão atender.

#### Scenario: CA1 · Merge na main
- **Dado** um merge na `main`
- **Quando** o GitHub avisa o Coolify
- **Então** `apps/api` e `apps/web` são publicados em homologação em até 10 minutos, com as migrações rodadas

### Requirement: CA2 · O Lucas vê o portal no ar
A URL de homologação SHALL abrir o portal.

#### Scenario: CA2 · Abrir a homologação
- **Dado** a URL de homologação
- **Quando** o Lucas abre
- **Então** vê o portal no ar

### Requirement: CA3 · Um banco por pessoa, sem senha no repositório
O PostgreSQL no Supabase SHALL separar a homologação e o desenvolvimento de Pedro e Mateus, com acessos próprios. A documentação MUST indicar a configuração de conexão sem senha, token ou URL privada versionados. `prev_homolog`, `prev_pedro` e `prev_mateus` são identificadores dos ambientes; esta spec não afirma que o provisionamento foi conferido.

#### Scenario: CA3 · Listar os bancos
- **Dado** o PostgreSQL no Supabase
- **Quando** a infraestrutura confere o isolamento dos ambientes
- **Então** homologação, Pedro e Mateus têm acessos separados, sem credenciais ou endereços privados no repositório

### Requirement: CA4 · O portal local usa o banco do dev
Com o `.env` apontando para o banco do dev, `pnpm dev` SHALL usar esse banco, sem Docker; `GET /saude` MUST dizer se o banco está ligado, ausente ou fora do ar.

#### Scenario: CA4 · Rodar com o banco do dev
- **Dado** um dev com o `.env` apontando para o banco dele
- **Quando** roda `pnpm dev`
- **Então** o portal local usa esse banco, sem Docker

### Requirement: CA5 · Deploy que falha não derruba a versão no ar
Um deploy que falha (migração com erro, ou `/saude` sem responder 200) MUST deixar a versão anterior no ar, com o erro no log do Coolify.

#### Scenario: CA5 · Deploy falha
- **Dado** o deploy
- **Quando** falha
- **Então** a versão anterior continua no ar e o erro aparece no log do Coolify

### Requirement: CA6 · Segredos só no Coolify
Os segredos de homologação MUST ficar só no Coolify, nunca no repositório.

#### Scenario: CA6 · Configurar os segredos
- **Dado** os segredos de homologação
- **Quando** são configurados
- **Então** ficam só no Coolify; nunca no repositório

### Requirement: CA7 · Banco de homologação na mesma região do servidor
O banco de homologação SHALL ficar no Supabase em São Paulo (sa-east-1), projeto "PrevGGVLucas", na mesma região da VPS do Coolify. A troca MUST preservar todos os dados e arquivos da homologação. O que existia no projeto de destino é apagado sem backup, por decisão do Mateus em 13/10 (os dados do portal antigo estão guardados em outro lugar).

#### Scenario: CA7 · Antes de limpar o destino
- **Dado** o PrevGGVLucas com o portal antigo
- **Quando** a limpeza vai começar
- **Então** a senha do banco foi trocada e não há conexão nem escrita do portal antigo

#### Scenario: CA7 · Depois da troca
- **Dado** a homologação apontando para o PrevGGVLucas
- **Quando** a troca é conferida
- **Então** a contagem de linhas de cada tabela e os 5 arquivos do depósito `documentos` batem com o "Portal Operacional", o login de teste entra e `GET /saude` diz `ligado`

#### Scenario: CA7 · Se der errado
- **Dado** um problema depois da troca
- **Quando** o `DATABASE_URL`, o `SUPABASE_URL` e a chave do Coolify voltam para o "Portal Operacional", intacto até o ok final
- **Então** a homologação volta a funcionar como antes da troca

### Requirement: CA8 · Telas medidas depois da troca
Com o banco em São Paulo, o tempo de resposta das rotas das telas principais da homologação MUST ser medido e registrado em `docs/infra/homologacao.md`. A rota acima de 1 segundo MUST virar tarefa própria, com teste.

#### Scenario: CA8 · Medir as telas
- **Dado** a homologação com o banco em São Paulo
- **Quando** as rotas das telas principais são medidas
- **Então** o tempo de cada uma fica registrado, e a que passa de 1 segundo vira tarefa nova
