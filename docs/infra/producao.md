# Produção no Coolify (GGVP-158, parte 9)

A produção roda a mesma imagem da homologação, pela tag do commit que passou nela, e nunca pela tag `main`. O banco é o Supabase "PrevGGVLucas", em São Paulo, que até a parte 9 foi o da homologação (decisão do Mateus, 14/10). Antes da produção, a homologação muda de banco e o PrevGGVLucas é limpo.

Os valores (senhas, chaves, tokens, endereços de banco) nunca vão para o repositório, o Jira ou o chat: só o Mateus os põe no Coolify e no cofre de senhas dele. Apagar dado (banco, depósito, projeto temporário) também é com ele.

## 1. A ordem

1. A homologação muda de banco (seção 2). Os dois apps nunca gravam no mesmo banco.
2. O backup do PrevGGVLucas é conferido, e a restauração e a limpeza são ensaiadas num projeto temporário (seção 3).
3. O PrevGGVLucas é limpo (seção 4).
4. O app da produção sobe (seção 5).
5. O monitor do /saude sobe e é testado (seção 7).

## 2. A homologação muda de banco

A escolha é do Mateus, na hora:

| Opção | A favor | Contra |
| --- | --- | --- |
| Projeto novo no Supabase, em São Paulo | Igual ao de hoje, com o depósito de arquivos | Custo de mais um projeto |
| "Portal Operacional" (Oregon), que ainda existe | Já tem o banco e o depósito | De 150 a 180 ms por consulta (o motivo da troca de 13/10). Adia o apagar (tarefa 2.16) |
| Postgres no Coolify, no mesmo servidor | Sem custo novo, e rápido | Precisa da imagem com pgvector (`pgvector/pgvector:pg17`) e de um volume. Os arquivos vão para uma pasta do servidor: sem `SUPABASE_URL`, o portal usa a pasta local |

Depois da escolha, no app da homologação:

1. Troque o `DATABASE_URL` pelo do banco novo. Com o Supabase, troque também `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, e crie o depósito `documentos` como na homologação (`docs/infra/homologacao.md`, "O depósito de arquivos").
2. **Redeploy.** As migrações rodam no banco novo antes de a API subir. Confira no `/saude` da homologação: `"banco":"ligado"`.
3. No terminal do app (Coolify → Terminal): `cd /app && pnpm --filter @ggv/api homologacao:preparar`. As senhas dos usuários de exemplo aparecem uma vez; o Mateus entrega ao Lucas fora do chat, do Jira e do repositório.
4. Os modelos do Word sobem de novo para a homologação com o `modelos:subir` (`docs/guias/kit-de-verdade.md`).

Só depois disso nenhum app usa o PrevGGVLucas. Confira no Coolify o `DATABASE_URL` de cada app (só o endereço do banco, sem a senha).

## 3. O backup e o ensaio

1. **O backup diário.** No painel do Supabase do PrevGGVLucas: **Database → Backups**. Confira se o backup diário está ligado e quantos dias o plano guarda. Anote no cartão, sem nada além do número de dias e do plano.
2. **A restauração num projeto temporário.** Restaure o backup mais novo num projeto novo do Supabase. Use a opção do painel, se o plano tiver, ou baixe o backup e use o `pg_restore` (Docker `postgres:17`, como na troca de 13/10).
3. **A conferência no temporário:**
   - `select count(*) from drizzle.__drizzle_migrations;` dá o mesmo número que no PrevGGVLucas;
   - as contagens de `pessoa`, `caso`, `documento` e `usuario` são as mesmas.
4. **O ensaio da limpeza.** Rode no temporário a limpeza da seção 4. Depois rode as migrações no terminal da sua máquina, com o `DATABASE_URL` do temporário só nessa sessão, sem gravar em arquivo: `pnpm --filter @ggv/api db:migrar`. As 36 migrações (de 0000 a 0035) rodam sem erro.
5. O Mateus apaga o projeto temporário.

**A chave do cofre.** A `COFRE_CHAVE` da produção é nova, e a da homologação não serve. Gere na sua máquina:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Guarde no seu cofre de senhas como "GGV Prev · COFRE_CHAVE · produção" antes de pôr no Coolify. Sem ela, um banco restaurado não abre as senhas do gov.br, e trocar depois deixa ilegíveis as senhas já guardadas.

## 4. A limpeza do PrevGGVLucas (quem roda é o Mateus)

Faça só depois da seção 2 (nenhum app usa o banco) e do ensaio da seção 3.

1. No **SQL Editor** do PrevGGVLucas:

   ```sql
   drop schema if exists drizzle cascade;
   drop schema public cascade;
   create schema public;
   grant usage on schema public to anon, authenticated, service_role;
   grant all on schema public to postgres, service_role;
   ```

   Os esquemas do portal saem inteiros. Na largada da produção, as migrações rodam do zero e põem de volta o que é delas, como o catálogo dos benefícios. A largada põe os feriados, os padrões do protocolo e o modelo da ida ao banco.
2. No **Storage**, esvazie o depósito `documentos`: todos os arquivos dele são de teste.
3. Conferir (só nomes e contagens): `select count(*) from information_schema.tables where table_schema = 'public';` dá 0.

Os modelos do Word sobem de novo depois da seção 5, pelo `modelos:subir`, com o login de uma Sênior da produção. O registro deles fica no banco (tabela `modelo`) e saiu com a limpeza.

## 5. O app da produção

Crie do zero, sem copiar o da homologação. Se copiar, a largada recusa as variáveis de teste e diz qual sobrou (P9.1).

1. **Domínio com https.** No DNS do domínio escolhido, um registro **A** com o IP do servidor do Coolify (o mesmo da homologação).
2. **+ New → Docker Image.** Image Name: `ghcr.io/mapech-co/ggv-previdenciario:<commit>`, com o commit que o `/saude` da homologação mostra em `versao`. O servidor já entra no GHCR (homologação, passo 2).
3. **Ports Exposes:** `3000`. **Domains:** `https://<domínio da produção>`. **Healthcheck:** desligado, porque vale o da imagem.
4. **Environment Variables**, só de execução (a lista inteira está em `docs/infra/homologacao.md`, seção 8). As diferenças da homologação:
   - `AMBIENTE=producao`;
   - `COFRE_CHAVE`, a nova (seção 3);
   - `DATABASE_URL`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, do PrevGGVLucas;
   - o Chatwoot do escritório (`CHATWOOT_URL`, `CHATWOOT_CONTA`, `CHATWOOT_CAIXA`, `CHATWOOT_TOKEN` e `CHATWOOT_WEBHOOK_SEGREDO`), sem `CHATWOOT_PERMITIDOS`: em produção, o portal fala com qualquer telefone;
   - o Drive do escritório (`GOOGLE_DRIVE_CREDENCIAIS`, `GOOGLE_DRIVE_PASTA_CLIENTES` e `GOOGLE_DRIVE_PASTA_REVISAR`), sem `GOOGLE_DRIVE_SO_LEITURA`;
   - a IA (`OPENAI_API_KEY`, `MISTRAL_API_KEY` e `IA_PERMITE_DADO_DE_SAUDE=sim`, autorizada pelo Lucas em 07/10);
   - `GOTENBERG_URL`;
   - a vigília: `FONTES_PUBLICACAO=aasp,djen`, `DJEN_OABS` e `AASP_CHAVES`, quando o Lucas mandar;
   - o alarme: `ALARME_CANAL_URL`, `ALARME_JIRA_URL`, `ALARME_JIRA_EMAIL`, `ALARME_JIRA_TOKEN` e `ALARME_JIRA_PROJETO`;
   - nunca `LEITURA_SIMULADA`, `GOOGLE_DRIVE_SO_LEITURA=sim` nem `RELACIONAMENTO_SIMULADO` (só `nao` é aceito): a largada recusa.
5. **Sem webhook.** A produção não muda sozinha a cada merge.
6. **Deploy.** Conferir: o `/saude` responde `"banco":"ligado"` e a mesma `versao` da homologação, e a tela de login abre.
7. **Os usuários.** A produção sobe vazia. Os logins reais esperam a lista do Lucas (GGVP-126 CA6) e são criados no terminal do app, um por pessoa: `cd /app && pnpm --filter @ggv/api usuario:criar`.

## 6. Liberar e voltar uma versão

**Liberar:**
1. Confira a versão no `/saude` da homologação (`versao`) e o roteiro de teste que passou nela.
2. No app da produção, troque a tag da imagem por esse commit e faça o **Deploy**.
3. Confira o `/saude` da produção: a mesma `versao`, com `"banco":"ligado"`.

**Voltar:** ponha a tag anterior e faça o Deploy. O Coolify guarda a lista dos deploys, com a imagem de cada um.

As migrações só andam para a frente. Uma versão com migração nova, depois de subir, não volta só pela tag: a volta pede outra versão que conserte.

## 7. O monitor do /saude

O monitor olha o `/saude` da produção a cada minuto e avisa pelo canal e pelo Jira do alarme da vigília (ADR-018):
- "O portal caiu", depois de duas falhas seguidas, com o motivo;
- "O portal voltou", com quanto tempo ficou fora.

Uma falha só, como a do deploy, não avisa. Se o servidor inteiro cair, o monitor cai junto, e o aviso não sai.

No projeto do Coolify: **+ New → Docker Compose**, com as variáveis `ALARME_*` (os mesmos valores da produção) definidas no app:

```yaml
services:
  monitor:
    image: ghcr.io/mapech-co/ggv-previdenciario:<a mesma tag da produção>
    command: ["pnpm", "--filter", "@ggv/api", "monitor", "https://<domínio da produção>"]
    environment:
      - ALARME_CANAL_URL=${ALARME_CANAL_URL}
      - ALARME_JIRA_URL=${ALARME_JIRA_URL}
      - ALARME_JIRA_EMAIL=${ALARME_JIRA_EMAIL}
      - ALARME_JIRA_TOKEN=${ALARME_JIRA_TOKEN}
      - ALARME_JIRA_PROJETO=${ALARME_JIRA_PROJETO}
    # O healthcheck da imagem chama a API, que não roda neste container.
    healthcheck:
      disable: true
    restart: unless-stopped
```

O log do monitor mostra cada falha e o resultado de cada aviso, sem dado de cliente.

**O teste, com o Mateus, fora do horário do escritório:** pare o app da produção por 3 minutos. O canal e o Jira recebem "O portal caiu". Volte o app. Recebem "O portal voltou".

## 8. A cópia dos arquivos

O backup do Supabase não leva o depósito de arquivos. A cópia é a do Drive do escritório: todo documento vai para lá, menos o pacote da petição (que se gera de novo) e o dado de exemplo. O que chega pelo card ou pelo chat vai depois da conferência da Documentação.

Quando um documento pronto para o Drive passa de 2 dias sem cópia, o suporte recebe um aviso por dia, pelo canal e pelo Jira do alarme. O aviso diz quantos estão assim e quantos esperam a conferência, sem nome. Com o Drive desligado ou só leitura, não há aviso.

## 9. O que ainda espera

- **O Lucas:**
  - a lista de logins (GGVP-126 CA6);
  - as OABs do DJEN e a chave da AASP. Sem elas, a vigília avisa "sem fonte" uma vez por dia (P5.10).
- **O Pedro:** o modo exemplo da tela e os botões das rotas de teste (bloqueios 1 e 2 da auditoria de 14/10). Enquanto existirem, a produção não abre ao escritório.
