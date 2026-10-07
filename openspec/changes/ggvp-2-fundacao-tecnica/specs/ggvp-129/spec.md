# Spec Delta · ggvp-129

## Purpose

Modelo de dados do portal: as tabelas de todos os épicos nascem juntas (decisão de 05/10), com RLS, travas no próprio banco e as regras da LGPD, para que cada épico grave no mesmo modelo. Testes em `apps/api/src/banco/migracoes.test.ts`.

## ADDED Requirements

### Requirement: CA1 · As migrações criam as tabelas de todos os épicos
As migrações SHALL criar as tabelas da base e as do modelo de todos os épicos (acesso, pessoas, caso, fluxo, documentos, INSS, Justiça, financeiro, jurimetria, mensagens e configuração), listadas em `design.md`.

#### Scenario: CA1 · Banco vazio
- **Dado** o banco vazio
- **Quando** as migrações rodam
- **Então** existem as 43 tabelas

### Requirement: CA2 · RLS ligado em toda tabela
Toda tabela MUST ter RLS ligado e sem política: no Supabase, a chave pública não lê nada.

#### Scenario: CA2 · Conferir a segurança
- **Dado** qualquer tabela
- **Quando** se confere a segurança
- **Então** o RLS está ligado

### Requirement: CA3 · O histórico só cresce
O banco MUST recusar `update` e `delete` em `evento_auditoria` e `acesso_dado_sensivel`.

#### Scenario: CA3 · Alterar ou apagar uma linha do histórico
- **Dado** o histórico ou o registro de acesso a dado de saúde
- **Quando** alguém tenta alterar ou apagar uma linha
- **Então** o banco recusa

### Requirement: CA4 · Estado fora da lista é recusado
Os estados SHALL ter `check` no banco, além do Zod.

#### Scenario: CA4 · Gravar estado inventado
- **Dado** um estado fora da lista
- **Quando** se grava
- **Então** o banco recusa

### Requirement: CA5 · CPF não se repete
O banco MUST recusar outra pessoa com um CPF que já existe.

#### Scenario: CA5 · CPF repetido
- **Dado** um CPF que já existe
- **Quando** se cria outra pessoa com ele
- **Então** o banco recusa

### Requirement: CA6 · Número de processo em um caso só
O banco MUST recusar ligar a outro caso um número de processo já ligado.

#### Scenario: CA6 · Mesmo número em dois casos
- **Dado** um número de processo já ligado a um caso
- **Quando** se liga a outro caso
- **Então** o banco recusa

### Requirement: CA7 · Prestação de contas com duas pessoas e aviso depois do OK (G8)
O banco MUST recusar a mesma pessoa no OK e no recebimento, e o aviso ao cliente antes do OK.

#### Scenario: CA7 · Mesma pessoa ou aviso antes do OK
- **Dado** uma prestação de contas
- **Quando** a mesma pessoa dá o OK e registra o recebimento, ou o aviso vem antes do OK
- **Então** o banco recusa

### Requirement: CA8 · Dado de saúde em tabela própria, com leitura registrada
Dado de saúde SHALL ficar em `documento_medico`, `parecer_medico` e `pericia`. A gravação de cada leitura em `acesso_dado_sensivel` entra com as rotas que devolvem esse dado (GGVP-96 CA13): a conferência da Sênior (PR #14) e a de documentos (PR #16).

#### Scenario: CA8 · Ler dado de saúde
- **Dado** um dado de saúde
- **Quando** é lido
- **Então** vem de tabela própria e a leitura fica registrada

### Requirement: CA9 · Arquivo fora do banco e senha cifrada
O banco SHALL guardar do arquivo só a chave, o tipo, o tamanho e o hash; a senha do gov.br, só cifrada pela API. Verificado pelo esquema (`documento`, `credencial_govbr`), sem teste próprio nesta change.

#### Scenario: CA9 · Guardar um arquivo
- **Dado** um arquivo do cliente
- **Quando** é guardado
- **Então** o banco guarda só a chave e o hash
