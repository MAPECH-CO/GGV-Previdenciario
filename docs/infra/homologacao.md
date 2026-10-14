# Homologação no Coolify (GGVP-119)

O GitHub monta a imagem (o `Dockerfile` da raiz) e publica no GHCR; o Coolify só baixa e roda. O banco é o Supabase, projeto "PrevGGVLucas", em São Paulo (sa-east-1), na mesma região da VPS. A API serve a tela montada na mesma URL.

**O PrevGGVLucas vai para a produção** (GGVP-158, parte 9, decisão do Mateus em 14/10), depois do aceite do Lucas em todas as histórias. Antes, a homologação volta ao "Portal Operacional", de Oregon, que por isso não é apagado. Os passos estão em `docs/infra/producao.md`, seção 2.

**Troca de 13/10 (Oregon → São Paulo).** Até 13/10, o banco era o projeto "Portal Operacional", em Oregon (us-west-2). Cada consulta levava menos de 1 ms no banco, mas a ida e volta entre a VPS e Oregon levava de 150 a 180 ms, e uma tela faz dezenas de consultas em sequência. O PrevGGVLucas guardava o portal antigo: o app dele foi parado (não apagado) e o banco dele foi limpo, sem backup, por decisão do Mateus. Os schemas `public` e `drizzle` foram copiados com `pg_dump`/`pg_restore` (Docker `postgres:17`), e os 5 modelos do depósito `documentos`, pela API do Storage, nos mesmos caminhos.

**Medição depois da troca (13/10, 22h, Chrome do Mateus, perfil Sênior; tempo de cada chamada à API):**

| Tela | Chamadas à API (ms) |
|---|---|
| Início | sessão 91 · recepção 77 · documentação médica 29 · perícias 22 · tarefas da perícia 55 · peritos 29 · tarefas 173 · setor/minhas 104 · setor 95 |
| Processos | sessão 684 · recepção 291 · documentação médica 111 · perícias 32 · tarefas da perícia 79 · peritos 32 · processos 75 |
| Prazos | sessão 181 · recepção 102 · documentação médica 546 · perícias 87 · tarefas da perícia 119 · peritos 46 |
| Agenda | sessão 880 · recepção 108 · documentação médica 46 |
| Resultados | sessão 140 |

Nenhuma chamada passou de 1 segundo (CA8). A página em si chega em 22 ms (primeiro byte) e fica pronta em cerca de 400 ms. A `/api/sessao` variou de 91 a 880 ms entre as telas: fica de olho; se passar de 1 s, vira tarefa.

**Como voltar:** enquanto o "Portal Operacional" existir, devolva no Coolify o `DATABASE_URL` (Session pooler de lá), o `SUPABASE_URL` e a `SUPABASE_SERVICE_ROLE_KEY` dele e faça o Redeploy. O que foi gravado em São Paulo depois da troca fica lá.

Caminho de cada merge na `main`: a CI passa → o workflow **Imagem** publica `ghcr.io/mapech-co/ggv-previdenciario:main` (e a tag do commit) → chama o webhook do Coolify → o Coolify baixa a imagem e troca o container. A cada start, as migrações rodam no Supabase antes de a API subir; se falharem, o container não sobe e o Coolify mantém a versão anterior.

Na máquina do dev não muda nada: `pnpm dev` sem `.env` usa o banco de exemplo na memória.

Nenhum valor desta página vai para o chat, o Jira ou o repositório.

## 1. Antes de começar

1. **Domínio com https.** No DNS de um domínio do escritório, crie um registro **A** `prev-homolog` com o IP da VPS do Coolify. O cookie da sessão só vale em https, e o endereço `sslip.io` que o Coolify gera fica em http: nele, o login não funciona.
2. **Banco.** No Supabase, projeto "PrevGGVLucas" (São Paulo): **Project Settings → Database → Reset database password**. Depois, em **Connect → Session pooler**, copie a URL com a senha nova. O endereço direto só funciona em rede com IPv6.
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
   acesso de um agente da conta). Sem as quatro, nada sai: a mensagem fica no histórico do cliente como não enviada, com o
   motivo "simulado, não saiu" (GGVP-158), e o convite, a confirmação e a cobrança param nela. Em homologação, só uma conta e
   uma caixa de teste: a conta do escritório tem contatos reais, e a mensagem sai no WhatsApp deles.
   **Trava da homologação:** fora de produção (`AMBIENTE` diferente de `producao`, inclusive sem a variável), o portal só
   fala com o Chatwoot para os telefones de `CHATWOOT_PERMITIDOS`, separados por vírgula, em qualquer formato
   (`+55 11 91234-5678, 21987654321`). Para os outros, não consulta nem envia: a mensagem fica no histórico do cliente como
   não enviada ("o telefone está fora da lista de teste da homologação") e a tela diz isso. Sem a lista, nenhum telefone
   recebe. Só o app de produção leva `AMBIENTE=producao`, e lá não há lista.
   Opcional, para o kit do contrato (GGVP-136): `GOTENBERG_URL` (o endereço interno do serviço Gotenberg, que converte o Word do
   kit em PDF; sem ela o kit sai em Word). O ZapSign está fora do escopo (GGVP-158): a assinatura é em papel. O Gotenberg é
   outro serviço no mesmo projeto, sem domínio público. Os passos estão em `docs/guias/kit-de-verdade.md`.
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
- Envio de arquivo com erro 500 "sem mensagem": confira o depósito `documentos` do Supabase Storage (abaixo).
- O servidor não baixa a imagem ("denied" ou "unauthorized"): refaça o passo 2.

### O depósito de arquivos (Supabase Storage)

Com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, os arquivos vão para o depósito privado `documentos`. Ele foi criado à mão no painel do Supabase, sem migração, então a produção precisa de um igual.

- **Privado:** nunca público.
- **Limite:** 25 MB por arquivo.
- **Tipos aceitos:**
  - PDF;
  - JPEG, PNG, HEIC e WebP;
  - áudio MPEG, MP4, OGG, WebM e WAV;
  - texto;
  - Word (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`). Ficou de fora até 12/10, e o modelo do kit não subia: o Supabase recusa o tipo, e o portal responde 500 (GGVP-158).

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
| `CHATWOOT_WEBHOOK_SEGREDO` | O segredo do endereço que o webhook do Chatwoot chama, `/api/chatwoot/entrada/<segredo>` (ADR-019). Segredo: só no Coolify e no webhook do Chatwoot. Sem ela, a rota responde 404 e nada entra. |
| `RELACIONAMENTO_SIMULADO` | Sem o Chatwoot, `nao` tira até o contato simulado da tela. `entrega` finge a entrega e é só dos testes de tela (`playwright.config.ts`): na homologação e na produção, nunca. |
| `GOTENBERG_URL` | O conversor do kit do contrato para PDF. Sem ela, o kit sai em Word. |
| `LEITURA_SIMULADA` | `sim` troca a leitura da IA pela leitura de exemplo, pelo nome do arquivo. É só dos testes de tela (`playwright.config.ts`): com `AMBIENTE` igual a `homologacao` ou `producao`, o servidor não sobe com ela. |
| `FONTES_PUBLICACAO` | As fontes da vigília do diário (`aasp`, `djen`). Fora de produção, o padrão é o exemplo. |
| `DJEN_OABS` | As OABs que o DJEN procura, como `123456/SP`. |
| `AASP_CHAVES` | As chaves da AASP. |
| `VIGILIA_TRIBUNAIS` | Os tribunais da vigília. Padrão: TRF3 e TJSP. |
| `ALARME_CANAL_URL` | O webhook do canal da equipe (Google Chat ou Slack) que recebe o alarme da vigília (ADR-018). Só `https`. Sem ela, o alarme fica no portal e no log. |
| `ALARME_JIRA_URL` | O site do Jira onde o alarme abre chamado, como `https://<conta>.atlassian.net`. Só `https`. |
| `ALARME_JIRA_EMAIL` | O e-mail do usuário de serviço que abre o chamado no Jira. |
| `ALARME_JIRA_TOKEN` | O token de API desse usuário. Segredo: só no Coolify. |
| `ALARME_JIRA_PROJETO` | A chave do projeto do chamado, como `GGVP`. Sem uma das quatro do Jira, não abre chamado. |
| `PORTAL_URL` | Só para o comando `modelos:subir`: o endereço do portal. |
| `SENIOR_EMAIL` | Só para o `modelos:subir`: o login da Sênior que sobe os modelos. |
| `SENIOR_SENHA` | Só para o `modelos:subir`: a senha dela, digitada no terminal de quem roda. |
