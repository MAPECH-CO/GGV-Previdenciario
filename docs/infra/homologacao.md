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
   **Trava da homologação:** fora de produção (`AMBIENTE` diferente de `producao`, inclusive sem a variável), o portal só
   fala com o Chatwoot para os telefones de `CHATWOOT_PERMITIDOS`, separados por vírgula, em qualquer formato
   (`+55 11 91234-5678, 21987654321`). Para os outros, não consulta nem envia: a mensagem fica no histórico do cliente como
   não enviada ("o telefone está fora da lista de teste da homologação") e a tela diz isso. Sem a lista, nenhum telefone
   recebe. Só o app de produção leva `AMBIENTE=producao`, e lá não há lista.
   Opcional, para o kit do contrato (GGVP-136): `GOTENBERG_URL` (o endereço interno do serviço Gotenberg, que converte o Word do
   kit em PDF; sem ela o kit sai em Word) e `ZAPSIGN_API_TOKEN` (diz que o ZapSign está contratado; sem ela só há papel). O
   Gotenberg é outro serviço no mesmo projeto, sem domínio público. Os passos estão em `docs/guias/kit-de-verdade.md`.
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
- Sem `DATABASE_URL` em produção: a API para na largada e diz que falta o banco, em vez de abrir o banco de exemplo (GGVP-158).
- O servidor não baixa a imagem ("denied" ou "unauthorized"): refaça o passo 2.

## 7. Só dado de exemplo em homologação

Homologação recebe só dado inventado. Dado real de cliente nunca entra lá, porque inclui dado de saúde.

## 8. Variáveis do servidor

A lista de tudo o que o servidor lê do ambiente (GGVP-158). Os nomes, sem valor, estão também no `.env.example` da raiz.
Um teste (`apps/api/src/variaveis.test.ts`) confere as duas listas contra o código: variável nova entra aqui e lá.
Nenhum valor vai para o repositório, o Jira ou o chat.

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | O Postgres (Supabase). Sem ela, o banco de exemplo na memória; em produção, sem ela, a API não sobe. |
| `BANCO_LOCAL` | `pasta` guarda o banco de exemplo em `apps/api/.banco-local`. Só na máquina do dev. |
| `NODE_ENV` | `production` na imagem: cookie só por HTTPS, HSTS, cofre e banco obrigatórios. |
| `PORTA` | A porta da API. A imagem usa 3000. |
| `HOST` | Onde a API escuta. A imagem usa 0.0.0.0. |
| `VERSAO` | O commit do build, que o `/saude` mostra. A imagem grava; não se põe à mão. |
| `AMBIENTE` | `homologacao` ou `producao`. Só a produção fala com qualquer telefone no Chatwoot; o `homologacao:preparar` só roda com `homologacao`. |
| `COFRE_CHAVE` | A chave do cofre das senhas do gov.br (32 bytes em base64). Trocar deixa ilegíveis as senhas já guardadas. |
| `SUPABASE_URL` | O Supabase Storage, onde ficam os arquivos. Sem ela, a pasta local. |
| `SUPABASE_SERVICE_ROLE_KEY` | A chave de serviço do Storage. |
| `OPENAI_API_KEY` | A IA (texto, transcrição, acervo). Sem ela, a IA fica desligada. |
| `OPENAI_MODELO` | O modelo de texto da IA. Tem padrão. |
| `OPENAI_MODELO_AO_VIVO` | O modelo do texto ao vivo da entrevista. Tem padrão. |
| `OPENAI_MODELO_TRANSCRICAO` | O modelo da transcrição do áudio. Tem padrão. |
| `OPENAI_MODELO_VETOR` | O modelo dos vetores do acervo. Tem padrão. |
| `MISTRAL_API_KEY` | A leitura de documento (OCR). |
| `MISTRAL_MODELO_OCR` | O modelo do OCR. Tem padrão. |
| `IA_PERMITE_DADO_DE_SAUDE` | `sim` deixa a IA receber dado de saúde (autorização do Lucas, 07/10). |
| `GOOGLE_DRIVE_CREDENCIAIS` | A conta de serviço do Drive do escritório (JSON em base64). |
| `GOOGLE_DRIVE_PASTA_CLIENTES` | A pasta dos clientes no Drive. |
| `GOOGLE_DRIVE_PASTA_REVISAR` | A pasta "a classificar" no Drive. |
| `GOOGLE_DRIVE_SO_LEITURA` | `sim` só lê o Drive, sem gravar (homologação). |
| `CHATWOOT_URL` | O endereço do Chatwoot, sem barra no fim. |
| `CHATWOOT_CONTA` | O número da conta no Chatwoot. |
| `CHATWOOT_CAIXA` | O número da caixa de entrada. |
| `CHATWOOT_TOKEN` | O token de acesso de um agente da conta. |
| `CHATWOOT_PERMITIDOS` | Fora de produção, os únicos telefones com que o Chatwoot fala, separados por vírgula. |
| `RELACIONAMENTO_SIMULADO` | Sem o Chatwoot, `nao` tira até o contato simulado da tela. |
| `GOTENBERG_URL` | O conversor do kit do contrato para PDF. Sem ela, o kit sai em Word. |
| `ZAPSIGN_API_TOKEN` | Diz que o ZapSign está contratado. Sem ela, só papel. |
| `FONTES_PUBLICACAO` | As fontes da vigília do diário (`aasp`, `djen`). Fora de produção, o padrão é o exemplo. |
| `DJEN_OABS` | As OABs que o DJEN procura, como `123456/SP`. |
| `AASP_CHAVES` | As chaves da AASP. |
| `VIGILIA_TRIBUNAIS` | Os tribunais da vigília. Padrão: TRF3 e TJSP. |
| `PORTAL_URL` | Só para o comando `modelos:subir`: o endereço do portal. |
| `SENIOR_EMAIL` | Só para o `modelos:subir`: o login da Sênior que sobe os modelos. |
| `SENIOR_SENHA` | Só para o `modelos:subir`: a senha dela, digitada no terminal de quem roda. |
