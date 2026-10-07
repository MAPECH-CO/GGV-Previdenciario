# GGVP-129 · Modelo de dados do portal: tabelas de todos os épicos, RLS, travas no banco e LGPD

> Candidata a história, épico **GGVP-2 Fundação técnica**. Cartão no Jira: [GGVP-129](https://mapech.atlassian.net/browse/GGVP-129). O modelo foi feito em 05/10 (commit `a94d62f`, PR #13) e o cartão nasceu na revisão geral de 07/10. Spec: `openspec/changes/ggvp-2-fundacao-tecnica/specs/ggvp-129/spec.md`.

**Como** time de desenvolvimento\
**quero** o banco com as tabelas de todos os épicos, as travas no próprio banco e as regras da LGPD\
**para** que cada épico grave no mesmo modelo, sem tabela inventada por épico, e que o banco recuse o que nenhuma tela pode deixar passar.\
**Perfil:** time de desenvolvimento

## Critérios de aceite
1. **Dado** o banco vazio, **quando** as migrações rodam, **então** existem as tabelas da base e as do modelo de todos os épicos (acesso, pessoas, caso, fluxo, documentos, INSS, Justiça, financeiro, jurimetria, mensagens e configuração).
2. **Dado** qualquer tabela, **quando** se confere a segurança, **então** o RLS está ligado; no Supabase, a chave pública não lê nada.
3. **Dado** o histórico (evento de auditoria e acesso a dado sensível), **quando** alguém tenta alterar ou apagar uma linha, **então** o banco recusa: o histórico só cresce.
4. **Dado** um estado fora da lista (caso, tarefa, etapa), **quando** se grava, **então** o banco recusa.
5. **Dado** um CPF que já existe, **quando** se cria outra pessoa com ele, **então** o banco recusa.
6. **Dado** um número de processo já ligado a um caso, **quando** se liga a outro caso, **então** o banco recusa.
7. **Dado** uma prestação de contas, **quando** a mesma pessoa tenta dar o OK e registrar o recebimento, ou o aviso ao cliente vem antes do OK, **então** o banco recusa (G8).
8. **Dado** um dado de saúde, **quando** é lido, **então** ele vem de tabela própria e a leitura fica registrada (a gravação do registro entra com as rotas que devolvem dado de saúde, GGVP-96 CA13).
9. **Dado** um arquivo do cliente, **quando** é guardado, **então** o banco guarda só a chave e o hash; o arquivo fica fora do banco, e a senha do gov.br, cifrada pela API.

## Dados e permissões
- Dado de saúde em tabelas próprias, com acesso registrado; consentimento por finalidade; anonimização no fim da guarda.

## Dúvidas abertas
- Nenhuma.
