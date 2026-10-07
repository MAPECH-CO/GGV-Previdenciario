# Spec Delta · ggvp-129

## Purpose

Modelo de dados do portal: as tabelas de todos os épicos num modelo só, com as travas no próprio banco e as regras da LGPD. Feito em 05/10 (commit `a94d62f`, migrações `0003_modelo_de_dados` e `0004_historico_so_cresce`), com cartão criado na revisão geral de 07/10. Testes em `apps/api/src/banco/migracoes.test.ts`.

## ADDED Requirements

### Requirement: CA1 · As tabelas de todos os épicos
As migrações SHALL criar as tabelas da base e as do modelo de todos os épicos (acesso, pessoas, caso, fluxo, documentos, INSS, Justiça, financeiro, jurimetria, mensagens e configuração).

#### Scenario: CA1 · Migrar o banco vazio
- **Dado** o banco vazio
- **Quando** as migrações rodam
- **Então** existem as tabelas da base e as do modelo de todos os épicos

### Requirement: CA2 · RLS em todas as tabelas
Toda tabela SHALL ter o RLS ligado; no Supabase, a chave pública MUST NOT ler nada.

#### Scenario: CA2 · Conferir a segurança
- **Dado** qualquer tabela
- **Quando** se confere a segurança
- **Então** o RLS está ligado

### Requirement: CA3 · O histórico só cresce
O banco MUST recusar alteração e exclusão no evento de auditoria e no acesso a dado sensível.

#### Scenario: CA3 · Tentar apagar o histórico
- **Dado** uma linha do histórico
- **Quando** alguém tenta alterá-la ou apagá-la
- **Então** o banco recusa

### Requirement: CA4 · Estado fora da lista
O banco MUST recusar um estado fora da lista em caso, tarefa e etapa.

#### Scenario: CA4 · Gravar um estado inventado
- **Dado** um estado que não está na lista
- **Quando** se grava
- **Então** o banco recusa

### Requirement: CA5 · CPF único
O banco MUST recusar uma segunda pessoa com o mesmo CPF.

#### Scenario: CA5 · CPF repetido
- **Dado** um CPF que já existe
- **Quando** se cria outra pessoa com ele
- **Então** o banco recusa

### Requirement: CA6 · Número de processo único
O banco MUST recusar o mesmo número de processo em dois casos.

#### Scenario: CA6 · Processo em dois casos
- **Dado** um número de processo ligado a um caso
- **Quando** se liga a outro caso
- **Então** o banco recusa

### Requirement: CA7 · Prestação de contas com duas pessoas (G8)
O banco MUST recusar que a mesma pessoa dê o OK na prestação e registre o recebimento, e MUST recusar o aviso ao cliente antes do OK.

#### Scenario: CA7 · Mesma pessoa no OK e no recebimento
- **Dado** uma prestação de contas
- **Quando** a mesma pessoa tenta dar o OK e registrar o recebimento, ou o aviso vem antes do OK
- **Então** o banco recusa

### Requirement: CA8 · Dado de saúde em tabela própria
O dado de saúde SHALL ficar em tabelas próprias, com a tabela de acessos sensíveis para registrar cada leitura. A gravação do registro nasce com a rota de documentos (GGVP-96 CA13, PR #18).

#### Scenario: CA8 · Ler dado de saúde
- **Dado** um dado de saúde
- **Quando** é lido
- **Então** vem de tabela própria, e a leitura pode ser registrada na tabela de acessos sensíveis

### Requirement: CA9 · Arquivo fora do banco
O banco SHALL guardar do arquivo do cliente só a chave e o hash; o arquivo fica fora do banco, e a senha do gov.br, cifrada pela API.

#### Scenario: CA9 · Guardar um arquivo
- **Dado** um arquivo do cliente
- **Quando** é guardado
- **Então** o banco tem só a chave e o hash
