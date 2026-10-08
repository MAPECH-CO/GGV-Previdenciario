GGVP-2 · Fundação técnica · histórias: GGVP-118, GGVP-119, GGVP-117, GGVP-96, GGVP-129, GGVP-126, GGVP-105 (GGVP-108 ainda não refinada).

## Por quê

Nenhuma outra história vira código sem base: repositório com a stack decidida, banco modelado no mínimo, CI que barra PR quebrado, ambiente de homologação, login e perfis. O front do Pedro (GGVP-120, PR #8) já está na `main` em `apps/web`; esta change cria o resto em volta dele.

## Histórias na ordem

1. **GGVP-118** · Base de código: stack (ADR-001), monorepo, banco de dados e CI · perfil: time de desenvolvimento.
2. **GGVP-119** · Ambiente: homologação no Coolify com deploy a cada merge e Postgres de dev por pessoa · perfil: time de desenvolvimento.
3. **GGVP-117** · Entrar no portal com e-mail e senha · perfil: todos. (Refinada; no Jira, no épico GGVP-2 desde 07/10.)
4. **GGVP-96** · Perfis e permissões · perfil: todos. (Refinada; no Jira, no épico GGVP-2 desde 07/10.)
5. **GGVP-129** · Modelo de dados do portal: tabelas de todos os épicos, RLS, travas no banco e LGPD · perfil: time de desenvolvimento. (Criada na revisão de 07/10 para dar história ao modelo feito em 05/10; no Jira, em "Tarefas pendentes".)
6. **GGVP-126** · Homologação com usuários e dados de teste · perfil: o Lucas testando, e todos. Do CA1 ao CA5; o CA6 espera a lista das pessoas do escritório (abaixo).
9. **GGVP-105** · Motor de fluxo: fases, perícia como subprocesso, junções, laços e esperas externas · perfil: Sistema (time de desenvolvimento). (Refinada pelo Lucas em 07/10. O registro do resultado da perícia e o subfluxo do laudo novo esperam as rotas da Perícia e do laudo.)

## Travadas

- **GGVP-108** · Identificadores do caso: CPF, NB, protocolo e CNJ: ainda em "Tarefas pendentes"; revisa o Fernando.
- **GGVP-126 CA6** · O login de cada pessoa do escritório: espera a lista com nome, e-mail e perfis, pedida ao Lucas em 07/10.

## Fora do escopo

- **GGVP-107** · Integração com o Google Drive: fica fora até 09/10 (o Drive guarda só documento do cliente).
- Produção, domínio final e backup automático.

## Portões envolvidos

Nenhum portão de G1 a G22 nasce aqui. A base prepara o lugar onde eles serão validados no servidor (`apps/api`, GGVP-109) e a tabela de evento de auditoria que registra quem fez o quê.
