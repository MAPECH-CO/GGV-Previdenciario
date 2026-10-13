# Design · GGVP-2 Fundação técnica

## GGVP-118 · Base de código

### Monorepo

pnpm workspaces na raiz (`pnpm-workspace.yaml`): `apps/*` e `packages/*`. Um `pnpm-lock.yaml` na raiz trava as versões. Scripts da raiz chamam o script de mesmo nome em cada pacote: `dev`, `typecheck`, `lint`, `test`.

| Pacote | O que é |
|---|---|
| `apps/web` (`@ggv/web`) | O front do PR #8. Não muda nesta história, só entra no workspace. |
| `apps/api` (`@ggv/api`) | Fastify. Sobe sem banco: a URL do banco só é exigida para migrar e para rotas que leem o banco. |
| `packages/campos` (`@ggv/campos`) | Movido de `kit/campos` com `git mv`, sem mudar funções nem testes. |
| `packages/contratos` (`@ggv/contratos`) | Schemas Zod que a tela e o servidor compartilham. |

TypeScript roda direto no Node (tirar os tipos, Node 22.6 ou mais novo); imports com extensão `.ts`, como em `apps/web`. Sem `tsx` nem build da API.

### Contratos (`packages/contratos`)

- `Saude`: resposta de `GET /saude` (`{ ok: true, servico: 'api' }`). É o que a homologação (GGVP-119) consulta para saber se a API subiu.
- `Pessoa`: `{ id, nome, cpf? }`; `nome` passa por `validarNome` e `cpf` por `validarCpf`, ambos de `@ggv/campos`. É o exemplo do jeito certo: o servidor valida com a mesma função da tela.

### Campos de formulário

Nenhum formulário nesta história. A regra fica de pé assim: `@ggv/campos` é dependência de `@ggv/contratos` e de `@ggv/web`, e a revisão automática do PR já trata validação solta como atenção.

### Banco

Drizzle ORM com PostgreSQL. Esquema em `apps/api/src/banco/esquema.ts`; migrações versionadas, geradas pelo `drizzle-kit` em `apps/api/drizzle/`. Tabelas mínimas:

| Tabela | Colunas |
|---|---|
| `pessoa` | `id` uuid, `nome`, `cpf` (único, pode faltar), `criado_em` |
| `caso` | `id` uuid, `pessoa_id` → pessoa, `beneficio`, `criado_em` |
| `tarefa` | `id` uuid, `caso_id` → caso, `titulo`, `prazo` (date, pode faltar), `criado_em`, `concluida_em` |
| `evento_auditoria` | `id` uuid, `quem`, `acao`, `alvo`, `quando`, `detalhe` jsonb |

`evento_auditoria` não guarda dado de saúde: `detalhe` leva ids e nomes de campo, nunca o valor.

`pnpm --filter @ggv/api db:migrar` aplica as migrações no banco do `DATABASE_URL` (do `.env`, que a GGVP-119 configura).

### Dependências novas e por quê

- `fastify`, `zod`, `drizzle-orm`, `pg`, `drizzle-kit`, `vitest`, `typescript`, `oxlint`: a stack do ADR-001.
- `@electric-sql/pglite` (só nos testes): Postgres em memória, para o teste das migrações rodar no CI e na máquina sem Docker.

### CI

`.github/workflows/ci.yml`, em todo PR e push na `main`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test` e varredura de segredos com `gitleaks`. Qualquer passo falhando, o job falha. O Playwright entra no CI quando houver tela que dependa do servidor; até lá roda na máquina do dev.

## Modelo de dados do portal (base de todos os épicos, 05/10)

Decisão do Mateus em 05/10: o banco nasce inteiro agora, desenhado a partir das histórias de todos os épicos, para o back-end e as telas de cada épico crescerem sobre a mesma base. Fonte: cartões do Jira (campos de cada tela, critérios e respostas do PO), `perfis.md`, `portoes-governanca.md` e o roteiro de laudos. O banco de homologação é o Supabase, projeto "Portal Operacional" (desde 13/10: "PrevGGVLucas", em São Paulo; ver "GGVP-119 · Banco de homologação em São Paulo").

### Regras que valem para toda tabela

- **RLS ligado e sem política** (`.enableRLS()`): a chave pública do Supabase não lê nada; só a API acessa, como dona do banco. Teste falha se uma tabela nascer sem RLS.
- **Id `uuid`**, `criado_em` e, onde a linha muda, `atualizado_em`. Exclusão é lógica (`excluido_em`) onde o dado precisa de trilha.
- **Estados com `check`** no banco (lista fechada), além do Zod em `packages/contratos`: o banco recusa estado inventado mesmo se a API errar.
- **Quem fez e quando** em toda decisão de pessoa (`decidido_por`, `decidido_em`); o que a IA sugeriu fica separado do que a pessoa decidiu (portões G2 a G6, G17).
- **Números do processo normalizados** (só dígitos) e únicos por tipo.

### LGPD

| Medida | Onde |
|---|---|
| Dado de saúde (CID, laudo, parecer, resultado de perícia) só em tabelas próprias, marcadas como sensíveis; a API filtra pela matriz de perfis e registra cada acesso (`acesso_dado_sensivel`) | `documento_medico`, `parecer_medico`, `pericia` |
| Arquivos fora do banco: Supabase Storage em bucket privado; no banco, só a chave, o tipo, o tamanho e o hash | `documento` |
| Senha do gov.br cifrada na API (AES-256-GCM, chave em variável de ambiente, nunca no banco nem no log); leitura por tempo limitado e registrada (G9) | `credencial_govbr` |
| Histórico só cresce: o banco recusa `update` e `delete` em `evento_auditoria` | gatilho |
| Base legal e consentimento por finalidade (atendimento, gravação, mensagens), com revogação | `consentimento` |
| Anonimização no fim da guarda: `anonimizado_em` na pessoa; o prazo de guarda é configuração | `pessoa`, `configuracao` |
| Minimização: título de tarefa, mensagem e histórico nunca levam CID, diagnóstico ou valor | contratos e revisão |

### Tabelas por área

Todas nascem da **GGVP-129** (modelo de dados, criada em 07/10 para o modelo de 05/10). A história de cada épico que grava ou lê a tabela está na tabela de origem (`apps/api/src/banco/esquema/*.ts`, comentário do topo); as que nenhuma história refinada usa ainda ficam prontas para o épico que as citar.

| Área | Tabelas |
|---|---|
| Acesso | `usuario` (perfis em lista, GGVP-96), `sessao` (perfil ativo), `evento_auditoria`, `acesso_dado_sensivel` |
| Pessoas | `pessoa` (lead ou cliente, CPF único, telefone, endereço, motivo de não virar cliente G16, anonimização), `pessoa_vinculo` (responsável legal, curador), `consentimento`, `credencial_govbr` |
| Caso | `caso` (benefício, fase, situação, advogada responsável, desfecho), `identificador_caso` (NB, protocolo do INSS, CNJ, com histórico), `atendimento` (entrevista, telefone, presencial; aviso de gravação G10), `ficha_atendimento`, `agendamento` |
| Fluxo | `etapa` (passo do BPMN em que o caso está, ramos de junção, subprocesso da perícia), `tarefa` (raia, responsável, prazos, tentativas, escalonamento G15), `tentativa`, `evento_externo` (chegada de fora, sem duplicar), `decisao` (OK, aprovação, despacho, dispensa: quem, quando, sugestão da IA à parte) |
| Documentos | `documento`, `documento_medico`, `parecer_medico` (G17, G18), `contrato` |
| INSS | `requerimento_inss` (protocolo, DER, comprovante), `exigencia` e `exigencia_item` (G21), `pericia` (médica ou social, origem, comparecimento, remarcação, resultado), `resultado_inss` (deferido ou indeferido, motivo do indeferimento) |
| Justiça | `publicacao` (casada pelo CNJ, sem duplicar), `rodada_vigilia` (G13), `prazo` (calculado por código, G12), `peticao` e `peticao_versao` (versão aprovada não muda, G6), `protocolo_judicial` |
| Financeiro | `prestacao_contas` (OK da advogada antes do aviso, G8; quem dá o OK não registra o recebimento) |
| Jurimetria e acervo | `perito`, `juizo`, `processo_acervo` (desfecho conferido por pessoa entra nas contas, GGVP-41 CA5) |
| Mensagens | `mensagem` (canal, modelo, quem enviou, aprovação quando exigida) |
| Configuração | `configuracao` (limites Q1, prazo de guarda), `roteiro_laudo` (versionado, GGVP-93), `kit_documento` (G1), `modelo` (contrato e mensagens), `feriado` (contagem de prazo) |

## GGVP-126 · Homologação com usuários e dados de teste

### Context

Com `DATABASE_URL`, o servidor não cria usuário nem caso: a semente (`semearExemplos`) só roda no banco embutido da máquina do dev. Na homologação já existe o usuário do Mateus, e a semente olhava "qualquer usuário" para não rodar duas vezes. Os casos de exemplo de cada passo entram na semente junto com o PR de cada épico.

### Decisions

1. **Comando** `pnpm --filter @ggv/api homologacao:preparar` (`apps/api/src/banco/homologacao.ts`), no mesmo padrão do `usuario:criar`: usa o banco do `DATABASE_URL` e recusa sem ele.
2. **Nunca em produção** (CA5): só roda com `AMBIENTE=homologacao`, variável que existe só no app de homologação do Coolify. Sem ela, para antes de gravar qualquer coisa.
3. **A mesma semente dos testes** (CA3): o comando chama `semearExemplos`. O que entra é o que está na `main` quando o comando roda.
   - Hoje entram só os usuários. Com a fila de PRs mesclada, entram os casos do INSS, da Justiça, da Garantia, do Desfecho e da Jurimetria.
   - As telas que ainda gravam no navegador ganham caso no banco com a GGVP-125 e a GGVP-132.
   - Por isso o comando roda depois de a fila entrar na `main`.
4. **Senha provisória** (CA1): na mesma transação da semente, cada usuário de exemplo ganha uma senha aleatória, com troca no primeiro acesso.
   - A senha pública dos exemplos nunca chega a valer na homologação.
   - A lista sai uma vez, no terminal de quem rodou, para entregar ao Lucas fora do repositório, do Jira e do chat.
5. **Não duplica** (CA4): a semente passa a olhar se os usuários de exemplo já estão no banco. Rodar de novo não grava nada e não troca senha.
6. **Configuração** (CA2): o comando grava `cobranca.limite` = 2 e `cobranca.intervalo_dias` = 3 se faltarem; o que existir fica. Sem configuração, o servidor usa `LIMITES_PADRAO` (2 e 3), que vem no PR #18 (Garantia), com teste lá.
7. **Mudança mínima na semente:** só a checagem do começo de `semearExemplos`. Os PRs da fila acrescentam casos no meio e no fim do arquivo, e assim não há conflito.

### Risks / Trade-offs

- **Rodar antes da fila:** o comando não duplica, então também não completa. Os casos dos épicos que entrarem depois ficam de fora. Rode depois dos merges; antes disso, só recriando o banco da homologação.
- **Senha no terminal:** a lista aparece uma vez, para quem rodou. Não vai para log, repositório, Jira nem chat.

## GGVP-119 · Banco de homologação em São Paulo (13/10)

### Context

A homologação demorava para carregar. Medição de 13/10:
- A VPS do Coolify fica em São Paulo (Hostinger); o banco, no Supabase "Portal Operacional", em Oregon (us-west-2).
- No banco, cada consulta leva menos de 1 ms (`pg_stat_statements`). O tempo vai na ida e volta pela rede, de 150 a 180 ms, e uma tela faz dezenas de consultas em sequência.
- A Supabase não muda a região de um projeto: o caminho é outro projeto na região certa e a cópia dos dados.
- O banco tem 62 MB, 5 arquivos no depósito `documentos` (4,7 MB) e nenhum usuário do Auth da Supabase (o portal tem login próprio).

### Decisions

1. **Destino: "PrevGGVLucas"** (sa-east-1), decisão do Mateus em 13/10, para não abrir projeto novo.
   - Hoje ele guarda o portal antigo (1,5 GB; back-end e automações ainda gravam). Segundo o Mateus, ninguém usa.
   - Antes de limpar: o back-end, o front e as automações antigas são desligados, a senha do banco é trocada (o que sobrar ligado perde o acesso) e um backup completo vai para fora da Supabase.
   - Levantamento de 13/10 (outra conversa, só leitura): o scanner do balcão chama o portal antigo uma vez, no fim, para cadastrar o cliente, e segue em frente se der erro; nenhum outro fluxo ligado do n8n usa o portal antigo; em 3 dias, uma visita à tela de login. O back-end antigo ainda lê a AASP a cada hora e o DJEN três vezes ao dia.
   - Três coisas não têm volta e vêm antes: a `FIELD_ENCRYPTION_KEY` do app antigo no cofre (919 senhas gov.br cifradas em `cofre_segredos`, chave fora do banco), os 21 GB de `acervo` copiados (fora do banco, servidor sem backup) e o ok do Lucas sobre as publicações. O app antigo é parado, não apagado.
   - Os 4 passos do portal saem do fluxo do scanner a partir da versão no ar, não do rascunho de 08/10, que troca o Mistral pelo Claude sem teste.
2. **Só `public` e `drizzle`.** O portal não usa outro schema; o `juridico` e os `zz_backup_*` de Oregon são sobras do portal antigo e ficam fora da cópia.
3. **Cópia com `pg_dump` e `pg_restore`** pelo Docker (`postgres:17`), sem dono e sem permissões antigas (`--no-owner --no-privileges`). As extensões `vector` e `pg_trgm` já existem no destino.
4. **Senha só no terminal do Mateus:** as URLs de origem e destino entram em variáveis da sessão do terminal, nunca em arquivo, no repositório ou no chat. O backup fica fora do repositório.
5. **App parado durante a cópia** (uns 15 minutos): a vigília grava a cada 5 minutos, e o que for gravado em Oregon durante a cópia se perderia.
6. **Arquivos pelo painel:** o depósito `documentos` é criado privado, com os mesmos tipos aceitos (`docs/infra/homologacao.md`), e os 5 arquivos vão nos mesmos caminhos.
7. **Troca no Coolify pelo Mateus:** `DATABASE_URL` (session pooler de São Paulo), `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
8. **Oregon fica intacto até o fim:** só depois de 2 dias sem problema, e com o ok do Mateus, um backup dele vai para fora da Supabase e o projeto é apagado. No plano pago não há pausa: a cobrança para quando o projeto é apagado.
9. **Código depois da medição (CA8):** primeiro a troca; depois, as telas principais são medidas no ar, e só a rota acima de 1 s vira tarefa, com teste.

### Risks / Trade-offs

- **Algo antigo ainda ligado:** sem a troca de senha, o back-end antigo gravaria no schema que o portal novo usa. A senha nova corta isso.
- **Voltar:** com Oregon intacto, devolver o `DATABASE_URL` (e o `SUPABASE_URL` e a chave) no Coolify restaura a homologação como estava, menos o que foi gravado em São Paulo depois da troca.
- **Limpar o PrevGGVLucas não tem volta** além do backup: a tarefa 2.10 só roda com o ok do Mateus na hora.

## GGVP-107 · Integração com o Google Drive

### Acesso

Conta de serviço do Google Cloud, como Gerente de conteúdo do Drive compartilhado "PREVIDENCIÁRIO - GGV" (decisão do
Mateus em 08/10: o mesmo Drive da automação do balcão). Variáveis, só no `.env.drive` local ou no Coolify, nunca no
repositório:

| Variável | O que é |
|---|---|
| `GOOGLE_DRIVE_CREDENCIAIS` | A chave JSON da conta de serviço, em base64, numa linha |
| `GOOGLE_DRIVE_PASTA_CLIENTES` | Id de "#5. CLIENTES" |
| `GOOGLE_DRIVE_PASTA_REVISAR` | Id de "A REVISAR" |

Faltando uma, o Drive fica desligado: nada é enviado e a trava do pacote não cobra o Drive. O `pnpm dev` não
lê o `.env.drive`, para os documentos de exemplo não irem para o Drive do escritório. Homologação aponta para pastas de
teste.

### Cliente (`apps/api/src/drive.ts`)

A API REST do Drive pelo `fetch` do Node. A conta de serviço assina um JWT com `node:crypto` e troca por um token de uma
hora. Sem a biblioteca `googleapis`: seis chamadas não pagam uma dependência. O cliente só sabe listar, achar pela marca,
criar pasta, enviar arquivo novo (envio retomável, porque o simples para em 5 MB) e dizer onde o arquivo está. Não há
função que mude, mova, apague ou compartilhe. É assim que o portal não toca no que o escritório já tem, nem deixa nada
público (CA4). Cada item criado leva a marca do portal (`appProperties.portal`, por exemplo `documento:<id>`).

### Envio (`apps/api/src/fluxo/arquivar.ts`)

`sincronizarDrive` roda a cada minuto (`principal.ts`), uma rodada por vez, e pega o que falta:

1. **Documento** com `drive_pendente` (CA1, CA2, CA7, CA8): a pasta do cliente sai de `pessoa.drive_pasta_id`; sem ela,
   pela regra do balcão (`pastasDoCliente` das telas, sobre o nome antes do primeiro " X " ou o CPF do título). Nenhuma:
   cria "<Nome> X A CLASSIFICAR" e guarda o id no cliente. Mais de uma: "A REVISAR", sem guardar. Nome "Tipo - Nome do
   Cliente - AAAA-MM-DD.ext" (data de Brasília) com `nomeSemSobrescrever` das telas. O pacote da petição não entra aqui.
2. **Pacote** da versão aprovada sem `pacote_drive_id` (CA6): pasta "Pacote de protocolo - AAAA-MM-DD" na do cliente,
   com cada arquivo do pacote. A marca leva o momento do pacote, então gerar de novo salva outra pasta.

O motivo de indeferimento (CA5) não vai para o Drive. É dado, não arquivo: fica no `resultado_inss` (o banco de
motivos da GGVP-52), ligado ao caso, e o acervo lê dali (GGVP-45). No escritório ninguém trabalha no Drive; ele guarda
imagem, PDF e a digitalização do balcão (decisão do Mateus em 08/10; o Lucas confirma na review).

Antes de criar, o envio procura a marca: o que já foi não vai de novo (CA3). Falhou: tarefa "Arquivo não foi para o Drive
(o portal tenta de novo sozinho)" da Documentação no caso, uma por caso, passo D1.18; fecha sozinha quando a rodada
envia tudo do caso.

Colunas novas: `pessoa.drive_pasta_id`, `documento.drive_arquivo_id`, `documento.drive_pendente` (padrão verdadeiro; a
migração põe falso no que já existia, para não mandar dado de exemplo nem documento antigo de uma vez) e
`peticao_versao.pacote_drive_id`. Documento de exemplo (`origem = 'exemplo'`) nunca vai.

### Trava "pacote completo" (G7)

`travaPacote` recebe se o pacote está no Drive. Com o Drive ligado e o pacote fora dele, a trava acusa "O pacote ainda
não está no Drive". Gerar o pacote de novo zera `pacote_drive_id`.

### Limites conhecidos

- O acesso dentro do Drive é o dos membros do Drive compartilhado. O Drive não tem os perfis do portal; dentro do
  portal, o arquivo só sai pela rota com perfil.
- Homônimo sem CPF no título cai na pasta de mesmo nome, como no balcão. A conferência pelo CPF dentro dos documentos
  da pasta fica para quando o escritório pedir.
- Cliente com mais de uma pasta (uma por benefício) manda para "A REVISAR".
