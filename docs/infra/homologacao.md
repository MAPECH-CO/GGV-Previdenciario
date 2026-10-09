# Homologação no Coolify (GGVP-119)

O GitHub monta a imagem (o `Dockerfile` da raiz) e publica no GHCR; o Coolify só baixa e roda. O banco é o Supabase, projeto "Portal Operacional". A API serve a tela montada na mesma URL.

Caminho de cada merge na `main`: a CI passa → o workflow **Imagem** publica `ghcr.io/mapech-co/ggv-previdenciario:main` (e a tag do commit) → chama o webhook do Coolify → o Coolify baixa a imagem e troca o container. A cada start, as migrações rodam no Supabase antes de a API subir; se falharem, o container não sobe e o Coolify mantém a versão anterior.

Na máquina do dev não muda nada: `pnpm dev` sem `.env` usa o banco de exemplo na memória.

Nenhum valor desta página vai para o chat, o Jira ou o repositório.

## 1. Antes de começar

1. **Domínio com https.** No DNS de um domínio do escritório, crie um registro **A** `prev-homolog` com o IP da VPS do Coolify. O cookie da sessão só vale em https, e o endereço `sslip.io` que o Coolify gera fica em http: nele, o login não funciona.
2. **Banco.** No Supabase, projeto "Portal Operacional": **Project Settings → Database → Reset database password**. Depois, em **Connect → Session pooler**, copie a URL com a senha nova. O endereço direto só funciona em rede com IPv6.
3. **Chave do cofre do gov.br.** Gere na sua máquina e guarde num gerenciador de senhas (trocar depois deixa ilegíveis as senhas já guardadas no cofre):

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

## 2. O servidor entra no GHCR (uma vez)

A imagem é privada, como o repositório. No GitHub: **Settings → Developer settings → Personal access tokens → Tokens (classic)**, um token só com `read:packages`. No servidor do Coolify (SSH, ou **Servers → Terminal** no Coolify), com o usuário que o Coolify usa:

```bash
docker login ghcr.io --username <seu-usuario-do-github>
```

Cole o token quando pedir a senha. Conferir: `Login Succeeded`.

## 3. App no Coolify

1. No projeto: **+ New → Docker Image**. Image Name: `ghcr.io/mapech-co/ggv-previdenciario:main`.
2. **General → Ports Exposes:** `3000`. **Domains:** `https://prev-homolog.<dominio>` (com `https://`, o Coolify pede o certificado sozinho).
3. **Environment Variables**, só de execução (não de build): `DATABASE_URL` com a URL do passo 1.2 e `COFRE_CHAVE` com a chave do passo 1.3.
   Opcional, para as mensagens ao cliente saírem pelo Chatwoot de verdade (GGVP-146): `CHATWOOT_URL` (sem barra no fim),
   `CHATWOOT_CONTA` (o número da conta), `CHATWOOT_CAIXA` (o número da caixa de entrada) e `CHATWOOT_TOKEN` (o token de
   acesso de um agente da conta). Sem as quatro, as mensagens seguem simuladas. Em homologação, só uma conta e uma caixa de
   teste: a conta do escritório tem contatos reais, e a mensagem sai no WhatsApp deles.
4. **Healthcheck:** deixe desligado. A imagem traz o dela, que chama `/saude` pelo Node.
5. **Webhooks:** copie a **Deploy webhook URL**.

## 4. O GitHub avisa o Coolify

1. Coolify: **Settings → Advanced → API access: Enabled**.
2. Coolify: **Keys & Tokens → API Tokens**, permissão **Deploy**. Copie o token.
3. No PowerShell, na raiz do clone, um segredo de cada vez:

   ```powershell
   $t = (Read-Host "valor").Trim() -replace '\s',''
   gh secret set COOLIFY_WEBHOOK --repo MAPECH-CO/GGV-Previdenciario --body $t
   ```

   e o mesmo para `COOLIFY_TOKEN`. Nunca pelo prompt "Paste your secret".

## 5. Primeiro deploy

A cada merge na `main`, com a CI verde, o workflow **Imagem** roda sozinho. Para rodar à mão: **Actions → Imagem → Run workflow**, na `main`.

Conferir:

- No GitHub, o workflow **Imagem** termina verde e o pacote `ggv-previdenciario` aparece na organização `MAPECH-CO`.
- No Coolify, o deploy termina e o container fica *healthy*.
- `https://prev-homolog.<dominio>/saude` responde `"banco":"ligado"` e a tela de login abre.

No Supabase só entram os usuários criados com `pnpm --filter @ggv/api usuario:criar` (com o `.env` apontando para ele); os usuários e casos de exemplo da máquina não vão para lá.

## 6. Deploy que falha

- CI vermelha na `main`: o workflow **Imagem** nem roda.
- Migração com erro: o container sai antes de subir a API. Banco fora do ar: `/saude` responde 503. Nos dois casos o Coolify mantém a versão anterior e o erro fica no log do deploy.
- Sem `COFRE_CHAVE`: a API para na largada e o log mostra "Falta COFRE_CHAVE".
- O servidor não baixa a imagem ("denied" ou "unauthorized"): refaça o passo 2.

## 7. Só dado de exemplo em homologação

Homologação recebe só dado inventado. Dado real de cliente nunca entra lá, porque inclui dado de saúde.
