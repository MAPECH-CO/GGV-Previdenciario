# Homologação e bancos de dev (GGVP-119)

Uma imagem só (o `Dockerfile` da raiz): a API serve a tela montada na mesma URL. A cada start, as migrações rodam antes; se falharem, ou se `/saude` não responder 200, o Coolify não troca a versão no ar.

## 1. Bancos no Postgres do Coolify

No Coolify, abra o Postgres do projeto e rode no terminal dele (`psql -U postgres`), trocando cada senha por uma gerada na hora (`openssl rand -base64 24`):

```sql
CREATE ROLE prev_homolog LOGIN PASSWORD '<senha>';
CREATE DATABASE prev_homolog OWNER prev_homolog;
CREATE ROLE prev_pedro LOGIN PASSWORD '<senha>';
CREATE DATABASE prev_pedro OWNER prev_pedro;
CREATE ROLE prev_mateus LOGIN PASSWORD '<senha>';
CREATE DATABASE prev_mateus OWNER prev_mateus;
```

Cada pessoa recebe só a própria senha, por mensagem direta, e guarda no próprio `.env`. Senha nenhuma vai para o repositório, o Jira ou o chat do time.

Conferir: `\l` lista os três bancos.

## 2. O Postgres não abre para a internet

A porta 5432 fica fechada no firewall da VPS e o Postgres não ganha "porta pública" no Coolify. O dev chega no banco dele por túnel SSH:

```
ssh -N -L 5433:localhost:5432 <usuario>@<ip-da-vps>
```

Com o túnel aberto, o `.env` (copiado do `.env.example`) aponta para `localhost:5433`. Conferir: com `pnpm dev` no ar, `http://127.0.0.1:3000/saude` responde `"banco":"ligado"`.

Se o Postgres roda num container do Coolify sem a porta 5432 publicada no host, troque `localhost:5432` do túnel pelo IP interno do container (aparece na página do Postgres no Coolify).

## 3. App de homologação no Coolify

1. Novo recurso → repositório `femezher/GGV-Previdenciario` pela GitHub App do Coolify, branch `main`.
2. Build pack: **Dockerfile** (o da raiz). Porta: **3000**.
3. Variáveis de ambiente, marcadas como segredo: `DATABASE_URL=postgres://prev_homolog:<senha>@<host-interno-do-postgres>:5432/prev_homolog`. Mais nada.
4. **Auto deploy** ligado: todo merge na `main` publica.
5. Health check: caminho `/saude`, porta 3000 (o `Dockerfile` também traz um `HEALTHCHECK`).
6. Domínio: o que o Coolify gerar, por enquanto. O domínio final fica para depois de 09/10.

Conferir: depois de um merge, o deploy termina em até 10 minutos, o log mostra "Migrações aplicadas." e a URL abre o portal.

## 4. Deploy que falha

Migração com erro: o container sai antes de subir a API, o Coolify marca o deploy como falho e mantém a versão anterior. O erro fica no log do deploy. Banco fora do ar: `/saude` responde 503 e o health check reprova a versão nova do mesmo jeito.

## 5. Só dado de exemplo em homologação

Homologação recebe só dado inventado. Dado real de cliente nunca entra lá, porque inclui dado de saúde.
