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

Decisão do Mateus em 05/10: o banco nasce inteiro agora, desenhado a partir das histórias de todos os épicos, para o back-end e as telas de cada épico crescerem sobre a mesma base. Fonte: cartões do Jira (campos de cada tela, critérios e respostas do PO), `perfis.md`, `portoes-governanca.md` e o roteiro de laudos. O banco de homologação é o Supabase, projeto "Portal Operacional".

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
