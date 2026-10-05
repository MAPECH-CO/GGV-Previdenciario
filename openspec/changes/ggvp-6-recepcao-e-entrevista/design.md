# Design

## Context

- Base das telas: GGVP-120 (`feat/GGVP-120-base-do-front`, "Em análise"). React 19, Vite 8, TypeScript 6, Vitest 5 com jsdom, Playwright e oxlint em `apps/web`, que roda sozinho com `npm`. Reaproveito `Topbar`, `AbaSuporte`, `NaoConstruida`, os tokens e a classe `so-leitor`. Esta branch nasce dela, porque ela ainda não entrou na `main`.
- Banco (Supabase) e implantação (Coolify) são do Mateus e ainda não existem aqui. Nada de servidor, tabela ou API nesta change: as telas rodam sobre um **servidor de exemplo** dentro do `apps/web`, com dados marcados como exemplo.
- Serviço de fora (Google Drive, Chatwoot, OpenAI, n8n, scanner, ViaCEP) é simulado na tela.
- `packages/contratos` ainda não existe (GGVP-118). O schema Zod de cada história fica escrito aqui; no código, o tipo TypeScript espelho fica em `apps/web/src/dados/tipos.ts`.

## Goals / Non-Goals

**Goals:**
- Cada tela fiel ao frame do Figma: blocos, textos e estados (claro, escuro, fonte grande).
- Os mesmos clientes de exemplo em todas as telas, para seguir uma pessoa do balcão até o benefício definido no `localhost`.
- Regra (busca, duplicidade, pasta, idade, data) em função pura com teste, que o servidor de verdade vai reusar.

**Non-Goals:**
- Servidor, banco, login. Roteador de verdade (GGVP-86).

## Decisions (valem para o épico)

1. **Servidor de exemplo.** `src/dados/servidor.ts` expõe funções assíncronas com a forma dos endpoints (abaixo). Lê a semente de `src/dados/exemplo.ts` e grava no `sessionStorage` (`ggv.exemplo.v2`: a versão sobe quando a forma do dado muda), porque os links recarregam a página e o que se cria no balcão precisa chegar à ficha. Aba nova e cada teste do Playwright começam da semente. Armazenamento bloqueado cai na memória, sem erro. **Ligar no servidor** troca o corpo dessas funções por `fetch`, sobre o mesmo contrato, e apaga a semente.
2. **Regras em `src/regras/`.** Funções puras, testadas com Vitest, sem React. O servidor de exemplo e, depois, o de verdade usam as mesmas.
3. **`campos` pelo `src/campos.ts`.** Reexporta `kit/campos/src/index.ts`; o `vite.config.ts` libera essa pasta no `server.fs.allow`. Quando o GGVP-108 mover a biblioteca para `packages/campos`, muda só esse arquivo. Sem dependência nova.
4. **Catálogos únicos** em `src/dados/catalogos.ts`, marcados como exemplo: benefícios (com "Não sei ainda", LOAS Idoso e LOAS Deficiente separados), fontes de "Como chegou" e setores. Ficha, agenda, cadastro e sugestão de benefício usam os mesmos. Trocar pelas listas do Airtable ao ligar no servidor.
5. **Quem fez.** Sem login, o histórico grava "Você (Atendimento)". O relógio é o `agora()` do servidor de exemplo, para o teste fixar a hora.
6. **Botão de outra história.** Fica com o visual do Figma e `aria-disabled="true"` (padrão do GGVP-120), ou é um link para a rota da história, que cai em "Esta tela ainda não foi construída" até ela existir.
7. **Rotas** em `App.tsx`, com `if` e expressão regular, como na base.

## GGVP-16 · Reconhecer quem chegou e para quê

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/balcao` | step_D1.01 `10:3` | Busca, "O que o cliente veio fazer?", setor, "Encaminhar", painel "Antes de concluir" |
| `/clientes/novo` | Atendimento · Novo cliente `73:371` | Ficha nova com o mínimo, aviso de duplicidade, pasta do Drive |
| `/clientes/:id` | Cliente · dados (Atendimento) `73:199` | Ficha inteira na visão do Atendimento, edição, "Últimos contatos" e "Histórico" |

A linha "Balcão · Receber quem chegou" da Central passa a abrir `/balcao` (campo novo `href` na `Tarefa`). Tarefa encaminhada à Documentação aparece na Central do Atendimento.

### Contrato (Zod, vai para `packages/contratos/fichas.ts`)

```ts
import { z } from 'zod'
import { normalizarCpf, validarCpf, normalizarTelefone, validarTelefone, normalizarNome, validarNome,
  validarEmail, normalizarCep, validarCep, dataParaIso } from '@ggv/campos'
import { BENEFICIOS, FONTES, SETORES } from './catalogos'

const cpf = z.string().transform(normalizarCpf).refine(validarCpf, 'CPF inválido')
const telefone = z.string().transform(normalizarTelefone).refine(validarTelefone, 'Telefone com DDD')
const nome = z.string().transform(normalizarNome).refine(validarNome, 'Nome só com letras')
const dataPassada = z.string().transform(dataParaIso).refine((iso) => iso !== null && iso <= hojeIso(), 'Data inválida ou futura')

export const Setor = z.enum(SETORES)                      // 'Jurídico' | 'Documentação · ADM' | 'Financeiro'
export const Situacao = z.enum(['lead', 'cliente'])

export const NovoCliente = z.object({
  nome, telefone,
  idade: z.number().int().min(0).max(130),
  pretende: z.string().trim().min(3).max(500),            // vai para "Últimos contatos" (CA13)
  cpf: cpf.optional(),
  email: z.string().trim().refine(validarEmail, 'E-mail inválido').optional(),
  cidadeUf: z.string().trim().max(80).optional(),
  beneficioInteresse: z.enum(BENEFICIOS).default('nao-sei'),
  comoChegou: z.enum(FONTES).optional(),
  indicadoPor: nome.optional(),                            // obrigatório quando comoChegou = 'indicacao' (CA12)
  observacao: z.string().trim().max(1000).optional(),
  outraPessoa: z.boolean().default(false),                 // "É outra pessoa" (CA9)
}).refine((d) => d.comoChegou !== 'indicacao' || d.indicadoPor, { path: ['indicadoPor'] })

export const FichaResumo = z.object({ id: z.string(), nome: z.string(), situacao: Situacao, etapa: z.string(), telefone: z.string() })
export const PastaDrive = z.object({ id: z.string(), nome: z.string(), caminho: z.string(), cpf: z.string().optional() })

export const RespostaNovoCliente = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('criada'), id: z.string(), pastas: z.array(PastaDrive) }), // pastas que podem ser dela (CA14)
  z.object({ resultado: z.literal('ja-existe'), id: z.string() }),                 // CPF repetido (CA6)
  z.object({ resultado: z.literal('parecidas'), fichas: z.array(FichaResumo) }),    // telefone ou nome igual (CA9)
])

// Depois de criada a ficha: liga a pasta achada, a escolhida entre várias, ou cria uma ('nova').
export const LigarPasta = z.object({ fichaId: z.string(), pasta: z.union([z.literal('nova'), z.string()]) })
export const PastaLigada = PastaDrive.extend({ nova: z.boolean() })

export const ResultadoBusca = FichaResumo.omit({ telefone: true }).extend({
  casos: z.array(z.object({ beneficio: z.string(), etapa: z.string() })),   // caso e etapa (CA1)
  beneficioInteresse: z.string().optional(),
  agendamentoHoje: z.object({ hora: z.string(), oQue: z.string(), com: z.string().optional() }).optional(),
  fichaAtendimentoPreenchida: z.boolean(),                 // CA2
})

export const Encaminhamento = z.object({
  fichaId: z.string(),
  motivo: z.enum(['entrevista', 'outra-etapa']),
  setor: Setor,                                            // obrigatório (CA7); na entrevista é o Jurídico
})

export const EdicaoFicha = z.object({
  nome, telefone, cpf: cpf.optional(), nascimento: dataPassada.optional(), email: z.string().refine(validarEmail).optional(),
  cep: z.string().transform(normalizarCep).refine(validarCep).optional(),
  estadoCivil: z.string().max(40).optional(), endereco: z.string().max(200).optional(), cidadeUf: z.string().max(80).optional(),
  profissao: z.string().max(200).optional(), comoChegou: z.enum(FONTES).optional(), contatoPreferido: z.string().max(80).optional(),
  contatoApoio: z.string().max(200).optional(), observacoes: z.string().max(1000).optional(),
})
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/balcao/busca?termo=` | `termo` | `ResultadoBusca[]` | `buscarNoBalcao` |
| `POST /api/fichas` | `NovoCliente` | `RespostaNovoCliente` | `criarFicha` |
| `POST /api/fichas/:id/pasta` | `LigarPasta` | `PastaLigada` | `ligarPasta` |
| `GET /api/fichas/:id` | `id` | ficha na visão do Atendimento | `obterFicha` |
| `PATCH /api/fichas/:id` | `EdicaoFicha` | ficha | `salvarFicha` |
| `POST /api/fichas/:id/encaminhamentos` | `Encaminhamento` | `{ tarefa, evento }` | `encaminhar` |

A visão do Atendimento nunca traz petição, estratégia, valores nem o conteúdo de laudo: a semente nem tem esses campos.

### Campos e a função de `campos` de cada um

| Tela | Campo | Funções |
|---|---|---|
| Balcão | Buscar por nome, CPF ou telefone | `somenteDigitos` para CPF e telefone; nome sem acento em `regras/busca.ts` |
| Novo cliente e ficha | Nome completo *, Quem indicou | `normalizarNome`, `validarNome` |
| Novo cliente e ficha | CPF | `normalizarCpf`, `validarCpf`, `formatarCpf` (só números no dado) |
| Novo cliente | Idade * | `somenteDigitos`, `normalizarInteiro` e a faixa de 0 a 130 em `regras/formularios.ts` |
| Novo cliente e ficha | Telefone / WhatsApp * | `normalizarTelefone`, `validarTelefone`, `formatarTelefone` |
| Novo cliente e ficha | E-mail | `validarEmail` |
| Ficha | Data de nascimento | `normalizarData`, `analisarData`, `dataParaIso`, `isoParaData`, e "não futura" em `regras/formularios.ts` |
| Ficha | CEP | `normalizarCep`, `validarCep`, `formatarCep`. `buscarCep` não é chamado: o ViaCEP é serviço de fora |
| Novo cliente | O que a pessoa pretende *, Cidade / UF, Observação | texto, só obrigatório e tamanho |
| Ficha | Estado civil, Endereço, Cidade / UF, Profissão, Contato preferido, Contato de apoio, Observações | texto, só tamanho |

A tela normaliza ao digitar (letra não entra em CPF, telefone e idade), valida ao sair do campo e de novo ao salvar, com a mensagem embaixo do campo. O servidor de exemplo valida de novo com as mesmas funções.

### Decisões da história

1. **Busca** (CA1, CA2, CA5, CA10): com dígitos, compara com CPF e telefone; com letras, cada pedaço do termo tem de estar no nome, sem acento e sem diferença de maiúscula. A partir de 2 letras ou 3 dígitos.
2. **"O que o cliente veio fazer?"**: as três opções do Figma ("Entregar documento", "Entrevista agendada", "Outra etapa") e, para quem já é cliente, "Nova demanda" (CA17).
   - "Entregar documento" encaminha à Documentação, que recebe a tarefa "Receber documento" e abre a tela de receber documento (GGVP-17, CA1).
   - "Entrevista agendada" encaminha ao Jurídico, a advogada da agenda, com a ficha e o agendamento. Sem entrevista hoje, "Encaminhar" não habilita e a tela oferece marcar a entrevista (GGVP-123).
   - "Outra etapa" pede o setor (CA7) e encaminha (CA4).
   - "Nova demanda" leva à abertura do processo novo na mesma ficha (GGVP-124).
3. **Painel "Antes de concluir"**: as respostas das decisões ("Já é cliente?", "O lead já está cadastrado?") saem da busca e aparecem acesas; não são botões.
4. **"O que a pessoa pretende" e "Observação"**: o cartão pede os dois (CA3 e CA11); o Figma desenha só "Observação". Vale o cartão: "O que a pessoa pretende *" entra nos dados mínimos.
5. **Pasta do Drive** (CA14): salva a ficha e, logo depois, a pasta, como na integração de verdade (o Drive é chamado depois de gravar). `regras/pasta.ts` acha a pasta pelo CPF, ou pelo nome sem acento. Uma: liga. Mais de uma: pergunta qual, com "Nenhuma: criar uma nova". Nenhuma: cria, com "criando a pasta…" na tela. A semente tem pastas de exemplo, inclusive duas com o mesmo nome.
6. **Duplicidade** (CA6, CA9): CPF repetido nunca grava, abre a ficha existente. Telefone ou nome igual mostra o aviso no bloco "Já existe?" com a ficha parecida; "Salvar" só grava depois de "É outra pessoa".
7. **Clique duplo** (CA16): o botão vira "salvando…" e fica desabilitado no mesmo clique, com trava por `ref`, antes de o React redesenhar.
8. **Histórico** (CA8): a ficha ganha o bloco "Histórico" embaixo de "Últimos contatos", com quem, data e hora e o quê. Não está desenhado no Figma; o cartão pede.
9. **Ficha na visão do Atendimento** (`73:199`): tudo o que o frame mostra. "Trocar foto", "Registrar contato", "▶ Transcrições", o arrastar documentos e "Marcar e iniciar reunião" são de outras histórias e ficam indisponíveis ou levam à rota delas. "Salvar alterações" grava com as mesmas validações e escreve no histórico o que mudou.

## GGVP-17 · Receber documento entregue no balcão

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/balcao/documento/:tarefaId` | step_D1.02 `10:440` | Papel ou digital, scanner, resultado do lote, conferências e "Registrar" |
| janela sobre a ficha, a tela do passo e o chat | Overlay · Subir documento `2224:2` | "Conferir e enviar": arquivos, tipo dito pela IA, envio para a pasta |
| `/clientes/:id` (muda) | Cliente · dados (Atendimento) `73:199` | Área de soltar ligada, pastas dos processos, "Laudo novo", "completar telefone" |
| `/` (muda) | chat "atualizar laudo" `2052:2` | Anexar o laudo no chat e confirmar no card |

O "Entregar documento" do balcão deixa de navegar: encaminha, e a Documentação recebe a tarefa na Central do Atendimento, que abre a tela do passo.

### Contrato (Zod, vai para `packages/contratos/documentos.ts`)

```ts
import { z } from 'zod'
import { TIPOS_DE_DOCUMENTO } from './catalogos'

export const TAMANHO_MAXIMO = 20 * 1024 * 1024        // 20 MB por arquivo (CA12)

// Onde o arquivo fica na pasta do cliente: Documentos pessoais ou a subpasta de um processo (CA14).
export const LocalNaPasta = z.union([z.literal('pessoais'), z.string()])   // 'pessoais' ou o id do processo

export const Arquivo = z.object({
  nome: z.string().max(255),                          // "(2)" quando o nome já existe (CA13)
  tipo: z.enum(TIPOS_DE_DOCUMENTO),
  local: LocalNaPasta,
  data: z.string(),                                   // aaaa-mm-dd
  origem: z.enum(['scanner', 'card', 'chat']),
  repetido: z.boolean(),                              // o mesmo arquivo já estava na pasta (CA13)
  aguardaLeitura: z.boolean(),                        // segue para a leitura da GGVP-81 (CA2)
})

// Encaminhamento (GGVP-16) ganha o motivo 'documento', sempre para a Documentação · ADM (CA1).
export const Encaminhamento = EncaminhamentoGgvp16.extend({ motivo: z.enum(['entrevista', 'outra-etapa', 'documento']) })

// O que o n8n manda ao portal quando um lote termina (CA2, CA4, CA10, CA15). Hoje simulado.
export const LoteDigitalizado = z.object({
  loteId: z.string(),
  status: z.enum(['arquivado', 'pasta-criada', 'revisao', 'falhou']),   // coluna Status do "Painel da digitalização"
  motivo: z.string().max(300),                        // o texto da planilha: "nome igual", "não existe pasta parecida, mas o CPF..."
  fichaId: z.string().optional(),                     // ausente na revisão: lote em revisão não mexe no portal
  conferirPapel: z.boolean(),                         // página em branco: aviso "CONFERIR O PAPEL" (CA10)
  arquivos: z.array(z.object({ nome: z.string(), tipo: z.enum(TIPOS_DE_DOCUMENTO), paginas: z.number().int().positive() })),
})

// "Conferir e enviar" (CA12, CA13, CA6, CA7).
export const EnvioDeArquivos = z.object({
  origem: z.enum(['card', 'chat']),
  arquivos: z.array(z.object({
    nome: z.string().min(1).max(255),
    formato: z.enum(['pdf', 'jpg', 'png']),           // foto entra como foto, sem virar PDF
    tamanho: z.number().int().positive().max(TAMANHO_MAXIMO),
    tipo: z.enum(TIPOS_DE_DOCUMENTO),                 // o que a pessoa conferiu, não o que a IA disse
    hash: z.string().length(64),                      // SHA-256 do conteúdo, para marcar repetido
  })).min(1).max(20),
})
export const RespostaEnvio = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('enviado'), arquivos: z.array(Arquivo), laudoNovo: z.boolean() }),
  z.object({ resultado: z.literal('sem-pasta') }),    // sem pasta achada e sem CPF: pasta nova só com CPF (CA11)
])

// "Registrar" na tela do passo (CA5, CA10).
export const RegistroRecebimento = z.object({
  forma: z.enum(['papel', 'digital']),
  conferiTipos: z.literal(true),
  conferiPapel: z.boolean(),                          // obrigatório quando o lote veio com "CONFERIR O PAPEL"
})
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/fichas/:id/encaminhamentos` (muda) | `Encaminhamento` | `{ tarefa, evento }` | `encaminhar` |
| `GET /api/tarefas/:id` | `id` | tarefa com ficha e caso | `obterTarefa` |
| `POST /api/digitalizacao/lotes` (chamado pelo n8n) | `LoteDigitalizado` | `{ tarefa }` | `receberLote` (lê `lotesDeExemplo`) |
| `POST /api/fichas/:id/arquivos` | `EnvioDeArquivos` | `RespostaEnvio` | `enviarArquivos` |
| `POST /api/tarefas/:id/registro` | `RegistroRecebimento` | `{ evento }` | `registrarRecebimento` |
| `GET /api/processos/:id/pasta` | `id` | pessoais e a subpasta do processo | `pastaDoProcesso` |

O resumo da IA do laudo fica guardado à parte, só para o Jurídico: nunca entra na ficha da visão do Atendimento (CA9).

### Campos e a função de cada um

| Tela | Campo | Funções |
|---|---|---|
| Conferir e enviar | Arquivos (soltar ou escolher) | `regras/arquivos.ts`: formato PDF, JPG ou PNG e até 20 MB; a biblioteca `campos` não tem campo de arquivo |
| Conferir e enviar | Tipo de cada arquivo | lista `TIPOS_DE_DOCUMENTO`, com o tipo que a IA sugeriu já marcado |
| Tela do passo | "Conferi o tipo de cada documento", "Conferi o papel" | caixas de marcar, sem texto |
| Ficha | Telefone / WhatsApp ("completar telefone") | `normalizarTelefone`, `validarTelefone`, `formatarTelefone`, como no GGVP-16 |
| Chat | Mensagem e anexo | texto livre; o anexo passa pelas mesmas regras da janela |

O servidor de exemplo valida de novo formato, tamanho e tipo com as mesmas funções.

### Decisões da história

1. **Tarefa da Documentação** (CA1, CA3): "Entregar documento" no balcão encaminha (`motivo: 'documento'`) e cria a tarefa "Receber documento" com o nome do cliente, ligada ao caso em andamento (o primeiro processo aberto, com benefício e etapa no detalhe). Ela aparece na Central do Atendimento, como as outras da Documentação, e abre a tela do passo. "Registrar" conclui a tarefa e ela sai da Central.
2. **Scanner simulado** (CA2, CA4, CA10): o portal não decide a pasta do papel; quem decide é o código da automação (n8n), que manda o resultado do lote. Na tela, "Digitalizar (scanner simulado)" faz o papel do n8n e lê o lote da semente (`lotesDeExemplo`): quem tem pasta sai "arquivado", com o nome "Tipo - Nome - data"; Antônio vem com página em branco ("CONFERIR O PAPEL"); Natália, sem pasta e sem CPF, vai para "A REVISAR" com o motivo da planilha. Revisão mostra o motivo e diz que a Documentação arrasta o arquivo no Drive; lote em revisão não mexe na ficha.
3. **Conferir e enviar** (CA12, CA13): janela com `<dialog>` do navegador. A "IA" que diz o tipo é simulada pelo nome do arquivo (`laudo` → Laudo médico, `rg` → Documento pessoal (RG)...; sem pista, "Outro documento"), e a pessoa troca o tipo antes de enviar. Formato e tamanho fora da regra ficam marcados e não seguem. Nome que já existe entra como "(2)", "(3)"; conteúdo igual (SHA-256 pelo `crypto.subtle` do navegador) fica "repetido". Nada é apagado.
4. **Onde o arquivo fica** (CA14): RG, CPF, comprovante de residência, certidão, CTPS e CNIS vão para Documentos pessoais; o resto vai para a subpasta do caso em andamento, ou para Documentos pessoais se ainda não há processo. A ficha mostra Documentos pessoais (as miniaturas do Figma) e um cartão novo "Pastas dos processos", uma subpasta por processo.
5. **Laudo novo** (CA6, CA7, CA9): enviar um arquivo do tipo laudo marca "Laudo novo" na ficha e no processo, guarda o resumo simulado da IA à parte e cria a tarefa "Analisar laudo novo" para o Jurídico. A ficha do Atendimento mostra só "enviado ao Jurídico: aguarda a análise".
6. **Chat** (CA8): na Central, "Anexar arquivo" e a sugestão "Subir laudo novo" passam a funcionar. O cliente é identificado pela mensagem e pelo nome do arquivo, com a mesma regra da busca do balcão; só um cliente bate → resposta e card "Ação para confirmar" com os três passos e "Confirmar e enviar ao Jurídico". Nada é feito antes de "Confirmar". Ninguém ou mais de um → pede o nome completo. A conversa livre continua da GGVP-82.
7. **Uma pasta só** (CA11): `regras/pasta.ts` ganha o terceiro passo, nome com uma letra de diferença (sem acento), só quando uma pasta fica tão perto. No envio pelo card, a ficha sem pasta procura por essa regra; sem pasta achada, cria só se a ficha tem CPF; sem CPF, a janela pede para completar o CPF. O cadastro do novo cliente (GGVP-16) segue criando a pasta, porque ali não há papel.
8. **Ficha do scanner sem telefone** (CA15): a ficha ganha `origem: 'scanner'` e aceita telefone vazio só com essa origem. A semente marca Marta Exemplo assim (pessoa que já existe). A ficha mostra o selo "completar telefone" e a Central do Atendimento ganha a tarefa "Completar telefone"; salvar a ficha continua pedindo telefone com DDD.

## GGVP-123 · Marcar a entrevista e a agenda

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/agenda/marcar/:fichaId` | Atendimento · Marcar reunião `73:459` | Tipo, dia, horário, com quem, duração, opções, aviso de horário ocupado, "Marcar e enviar convite", próximas reuniões e prévia do convite |
| `/agenda/marcar/:fichaId?remarcar=:id` | a mesma | "Remarcar a entrevista", com o motivo obrigatório |
| `/agenda` | Agenda · Semana `1941:2`, Mês `1941:198`, Lista `1941:401` | Abas, "‹ Hoje ›", filtros por categoria com a contagem, "+ Novo evento" |
| janela sobre a agenda | detalhe do compromisso `2164:280` e `2164:95` | Quando, cliente, detalhe, passo do BPMN; "Abrir a tarefa", "Marcar como realizado", "Faltou", "Remarcar", "Enviar convite" |
| janela sobre a marcação e o detalhe | não desenhada | Chatwoot simulado: a conversa do cliente com a mensagem pronta para conferir e enviar |

O "Marcar reunião" da ficha passa a se chamar "Marcar entrevista", como no cartão (CA1). O balcão, o novo cliente e a ficha já levam a `/agenda/marcar/:fichaId`.

### Contrato (Zod, vai para `packages/contratos/agenda.ts`)

```ts
import { z } from 'zod'
import { dataParaIso } from '@ggv/campos'

export const TipoDeEntrevista = z.enum(['video', 'presencial', 'telefone'])
export const EstadoDoCompromisso = z.enum(['marcado', 'realizado', 'faltou', 'remarcado'])
export const HORARIOS = ['09:00', '10:30', '14:00', '16:00'] as const   // os do Figma; parâmetro

// Agendamento (GGVP-16) ganha os campos da marcação.
export const Agendamento = AgendamentoGgvp16.extend({
  tipo: TipoDeEntrevista.optional(),
  duracao: z.number().int().min(15).max(240).default(45),          // minutos
  estado: EstadoDoCompromisso.default('marcado'),
  remarcacoes: z.number().int().min(0).default(0),                  // G15: até 2 (Pedro, 05/10)
  conviteEnviadoEm: z.string().optional(),
  gravar: z.boolean().default(true),                                // aviso de gravação no início (G10)
  levar: z.boolean().default(true),                                 // o que trazer vai no convite
  pedirFicha: z.boolean().default(true),                            // a ficha em papel vai no convite (Pedro, 05/10)
})

// "Marcar e enviar convite" (CA1, CA3). Remarcar exige o motivo (CA7).
export const Marcacao = z.object({
  tipo: TipoDeEntrevista,
  data: z.string().transform(dataParaIso).refine((iso) => iso !== null && iso >= hojeIso(), 'Data inválida ou passada'),
  hora: z.enum(HORARIOS),
  duracao: z.number().int().min(15).max(240),
  com: z.string(),                                                  // id da EQUIPE: nunca captador (CA2)
  gravar: z.boolean(),
  levar: z.boolean(),
  pedirFicha: z.boolean(),
  confirmarHorarioOcupado: z.boolean().default(false),              // CA3
  remarcar: z.object({ agendamentoId: z.string(), motivo: z.string().trim().min(3).max(300) }).optional(),
})
export const RespostaMarcacao = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('marcado'), agendamento: Agendamento }),
  z.object({ resultado: z.literal('ocupado'), conflitos: z.array(EventoDaAgenda) }),   // avisa e deixa confirmar
  z.object({ resultado: z.literal('limite') }),                     // já são 2 remarcações: sobe para a sênior (G15)
])

// O que a agenda mostra: entrevistas e retiradas das fichas e os compromissos internos (CA5).
export const EventoDaAgenda = z.object({
  id: z.string(), data: z.string(), hora: z.string(), duracao: z.number(),
  titulo: z.string(),                         // nome do cliente, ou o título do interno
  oQue: z.string(),                           // "Fazer entrevista", "Entregar cópia do contrato"...
  categoria: z.enum(['visitas', 'pericias', 'audiencias', 'protocolos', 'prazos', 'bancos', 'retornos']),
  tipo: TipoDeEntrevista.optional(), responsavel: z.string().optional(),
  passo: z.string().optional(),               // "D1.09 · Atender e entrevistar"
  estado: z.enum(['agendado', 'realizado', 'faltou', 'confirmar']),   // 'confirmar': passou sem registro (CA8)
  fichaId: z.string().optional(),
})

export const CompromissoInterno = z.object({
  titulo: z.string().trim().min(3).max(80),
  data: z.string().transform(dataParaIso).refine((iso) => iso !== null && iso >= hojeIso()),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duracao: z.number().int().min(15).max(480),
  responsavel: z.string(),
})

export const Resultado = z.object({ resultado: z.enum(['realizado', 'faltou']) })   // CA6, CA8, CA9
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/agenda?de=&ate=` | datas | `EventoDaAgenda[]` | `eventosDaAgenda` |
| `POST /api/fichas/:id/agendamentos` | `Marcacao` | `RespostaMarcacao` | `marcarEntrevista` |
| `POST /api/agendamentos/:id/resultado` | `Resultado` | `{ evento }` | `registrarResultado` |
| `GET /api/agendamentos/:id/convite` | `id` | `{ nome, telefone, mensagem }` | `prepararConvite` |
| `POST /api/agendamentos/:id/convite` | `{ mensagem }` | `{ evento }` (fica em "Últimos contatos") | `registrarConvite` |
| `POST /api/agenda/internos` | `CompromissoInterno` | `EventoDaAgenda` | `criarCompromissoInterno` |

### Campos e a função de cada um

| Tela | Campo | Funções |
|---|---|---|
| Marcar | Tipo, dia, horário | escolhas da tela; o dia e o horário vêm de `regras/agenda.ts` (próximos 5 dias úteis, `HORARIOS`) |
| Marcar | Com quem | lista `EQUIPE` sem captador (`regras/agenda.ts`), advogada primeiro |
| Marcar | Duração | 30, 45, 60 ou 90 minutos |
| Remarcar | Motivo * | texto, obrigatório e com tamanho |
| Novo evento | Título * | texto, obrigatório e com tamanho |
| Novo evento | Data * | `normalizarData`, `dataParaIso` e "não passada" em `regras/formularios.ts` |
| Novo evento | Hora * | `<input type="time">` do navegador; a biblioteca `campos` não tem hora |

O servidor de exemplo valida de novo com as mesmas funções.

### Decisões da história

1. **Uma agenda só** (CA5): `eventosDaAgenda` junta as entrevistas e retiradas das fichas (os agendamentos que já existem) e os compromissos internos, que ficam à parte porque não têm cliente. Categoria pelo que é: entrevista, retirada e interno são "Visitas e reuniões"; as outras categorias do Figma aparecem nos filtros com zero até as histórias delas trazerem eventos.
2. **Dia e horário** (CA1, CA3): os 5 próximos dias úteis, cada um com "livre" ou "cheio" (cheio quando todos os horários do dia já têm compromisso), e os horários do Figma. Horário ocupado é qualquer compromisso que se cruze com o novo, pela duração; o portal mostra quem está lá e "Marcar mesmo assim".
3. **Convite** (CA4): `regras/agenda.ts` monta a mensagem com o nome, o dia por extenso, a hora, o tipo (no vídeo, o link do Meet simulado), o pedido para preencher a ficha de atendimento em papel no balcão antes da conversa (Pedro, 05/10: papel até o tablet; o "link da ficha" do cartão vale quando o tablet chegar) e, com "Pedir ao cliente que traga", o que trazer. "Marcar e enviar convite" marca e abre a janela do Chatwoot simulado com a conversa do cliente e a mensagem para conferir; "Enviar" ali registra o convite em "Últimos contatos". O modelo de verdade e o registro da mensagem são da GGVP-102.
4. **Realizado, faltou e o que passou** (CA6, CA8, CA9): o estado mora no agendamento. Data antes de hoje sem registro vira "confirmar se aconteceu", em cinza, nas três visões e no topo da lista. "Realizado" conclui a tarefa da entrevista na Central e, no lead, abre a tarefa seguinte do Jurídico, "Cadastrar lead" (GGVP-43). "Faltou" grava a falta e abre o remarcar.
5. **Remarcar** (CA7): o agendamento antigo fica "remarcado", o novo nasce com a conta de remarcações, e o motivo entra em "Últimos contatos" com o canal "Remarcação". Limite de remarcações (G15): 2 (Pedro, 05/10), `LIMITE_DE_REMARCACOES` em `regras/agenda.ts`; na terceira, a tela avisa que o caso sobe para a advogada sênior e não remarca (o laço e o escalonamento são da GGVP-94).
6. **Com quem** (CA2): catálogo `EQUIPE` de exemplo, só com quem já está na semente (a Dra. Paula, advogada); o captador nunca entra, e a regra que filtra tem teste com um captador de mentira.
7. **Fora desta história, com visual do Figma e indisponível**: "Iniciar entrevista (Transcrição)" (GGVP-40) e a aba "Protocolos" da agenda.
8. **Semente**: os agendamentos da semente ganham tipo e duração, e a Natália ganha uma entrevista de ontem, sem registro, para mostrar o "confirmar se aconteceu". Nenhuma pessoa nova.

## GGVP-21 · Confirmar o agendamento do lead

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/agenda/confirmar/:agendamentoId` | step_D1.04 `10:33` | Chips, "nome · Confirmar agendamento", telefone · lead, "O que você deve fazer" com o que levar do benefício, a frase da tarefa, "Contato do cliente" com a entrevista, a ficha, "Ligar" e "Chatwoot", "Confirmar entrevista"; no lado, "Antes de concluir" com as duas decisões e "Tentativa n de 2" |
| janela sobre a tela | não desenhada | Chatwoot simulado com a mensagem de confirmação pronta (a mesma janela do convite) |

Entradas: a Central do Atendimento ("nome · Confirmar agendamento", uma por entrevista de lead ainda não confirmada) e "Abrir a tarefa" no detalhe do compromisso da agenda.

### Contrato (Zod, vai para `packages/contratos/agenda.ts`)

```ts
export const CanalDoContato = z.enum(['mensagem', 'ligacao'])
export const Tentativa = z.object({
  quando: z.string(), quem: z.string(), canal: CanalDoContato,
  resultado: z.enum(['confirmou', 'sem-resposta']),
})

// Agendamento (GGVP-123) ganha a confirmação.
export const Agendamento = AgendamentoGgvp123.extend({
  confirmacao: z.object({
    tentativas: z.array(Tentativa),
    proximaEm: z.string().optional(),            // aaaa-mm-dd: 3 dias depois da tentativa sem resposta (CA6)
    naSenior: z.boolean().default(false),        // 2 sem resposta: a advogada sênior resolve (CA6)
  }).optional(),
})

export const RegistroDaConfirmacao = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('confirmou'), canal: CanalDoContato, jaPreencheuFicha: z.boolean() }),
  z.object({ resultado: z.literal('sem-resposta'), canal: CanalDoContato }),
])
export const RespostaDaConfirmacao = z.object({
  tentativa: z.number().int().min(1),             // o número desta tentativa (CA6)
  proximaEm: z.string().optional(),
  naSenior: z.boolean(),
  tarefa: Tarefa.optional(),                      // Preparar entrevista, Preencher ficha ou a da sênior
})
// Setor ganha 'Atendimento': a pendência "Preencher ficha" é do próprio Atendimento.
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/agendamentos/:id/confirmacao` | `id` | `{ ficha, agendamento, tentativa, mensagem }` | `obterConfirmacao` |
| `POST /api/agendamentos/:id/confirmacao/mensagem` | `{ mensagem }` | `{ evento }` (fica em "Últimos contatos") | `registrarMensagemDeConfirmacao` |
| `POST /api/agendamentos/:id/confirmacao` | `RegistroDaConfirmacao` | `RespostaDaConfirmacao` | `registrarConfirmacao` |
| parte de `GET /api/central/atendimento` | — | `Tarefa[]` | `tarefasDeConfirmarAgendamento` |

### Campos e a função de cada um

Só a mensagem no Chatwoot simulado: texto obrigatório, até 1000 caracteres. As decisões são escolhas da tela.

### Decisões da história

1. **Quem entra** (CA1, CA4): entrevista de lead marcada de hoje em diante, sem confirmação e fora da sênior. A tarefa nasce da agenda: a linha fixa da Josefa (D1.04) em `atendimento.ts` sai.
2. **Canal** (CA1, CA5): "Ligar" (ligação simulada: a tela mostra o número e conta como ligação) ou "Chatwoot" (mensagem conferida e enviada, que fica em "Últimos contatos"). Vale o canal do último contato feito na tela; "Confirmar entrevista" só habilita com um contato feito e as decisões respondidas.
3. **Decisões no painel** "Antes de concluir", como no Figma: "Resultado do contato de hoje" e, com "Confirmou a entrevista", "Já preencheu a ficha de atendimento?". Com "Sem resposta", o botão vira "Registrar tentativa".
4. **Tentativas** (CA6): `regras/confirmacao.ts`, `TENTATIVAS_DE_CONFIRMACAO = 2` e `DIAS_ENTRE_TENTATIVAS = 3` (Lucas, 05/10). A primeira sem resposta marca a próxima para 3 dias depois, e a tarefa fica na Central com esse prazo; a segunda passa a tarefa para a advogada sênior (Jurídico) e ela sai da Central do Atendimento.
5. **Depois de confirmar** (CA2, CA3, CA7): com ficha, o Jurídico recebe "Preparar entrevista" (D1.06, GGVP-32), que leva a `/entrevista/:agendamentoId/preparar` (tela do grupo 2; até lá, "ainda não construída"). Sem ficha, o Atendimento recebe a pendência "Preencher ficha" (D1.05), com prazo no horário da entrevista, que leva à ficha de atendimento (GGVP-24).
6. **Mensagem** (CA8): regra em `regras/confirmacao.ts`, com o dia e a hora, o pedido da ficha em papel quando falta, o que levar do benefício (LOAS Idoso e LOAS Deficiente com o texto do BPC/LOAS do cartão; os outros, "RG, CPF e os laudos", até a GGVP-104 trazer a lista de cada um) e os quatro documentos que mais travam.
7. **Registro** (CA5): cada tentativa grava quando, quem e o canal no agendamento, no histórico e em "Últimos contatos".
8. **Catálogo de benefícios**: troca pela lista do cartão "Checklist de documentos obrigatórios do benefício" (GGVP-91), os nomes do Airtable normalizados em 05/10, com "Não sei ainda" no começo. Os ids que a semente já usa ficam.

## GGVP-24 · Preencher a ficha de atendimento

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/clientes/:fichaId/ficha-de-atendimento` | step_D1.05 `10:54` | Atendimento: "Ficha em papel" com o scanner simulado e a leitura da IA; "Preencher" com os campos (os lidos pela IA marcados para conferir) e a data da ficha; a senha do gov.br pelo cofre ou "Não sei a senha"; "Salvar ficha"; no lado, "Antes de concluir" com Campos, Travas e Como segue |
| `/clientes/:fichaId/ficha-de-atendimento?modo=tablet` | o mesmo frame, uma pergunta por vez (cartão, CA1) | O cliente no tablet: letra grande, "Voltar" e "Próxima", o cofre na pergunta da senha e "Salvar ficha" no fim |

Entradas: a pendência "Preencher ficha" da Central (GGVP-21), "Preencher a ficha" no balcão (pessoa sem ficha) e o cartão "Ficha de atendimento" da ficha do cliente.

### Contrato (Zod, vai para `packages/contratos/fichas.ts`)

```ts
import { dataParaIso, normalizarCpf, normalizarData, normalizarTelefone, validarCpf, validarNome, validarTelefone } from '@ggv/campos'

// Ficha (GGVP-16): senhaGovNoCofre (boolean) vira senhaGov. O valor da senha nunca está aqui.
export const SenhaGov = z.object({
  situacao: z.enum(['sem-senha', 'escritorio-tem', 'no-cofre']),   // as três que a GGVP-32 mostra
  naoSabe: z.boolean().default(false),           // CA3
  conferir: z.boolean().default(false),          // lida da ficha em papel: o Atendimento confere (CA15)
  atualizadaEm: z.string().optional(), por: z.string().optional(),
  funcionouEm: z.string().optional(),            // a última vez que entrou na conta (GGVP-36)
})

// A triagem fica na ficha única da pessoa; os dados pessoais vão para a própria ficha.
export const FichaDeAtendimento = z.object({
  data: z.string(),                                // o dia de hoje, sozinho e sem edição (CA12)
  origem: z.enum(['papel', 'tablet']),
  modelo: z.enum(['GGV', 'APA']).optional(),       // a ficha em papel
  pessoasNaCasa: z.number().int().min(1).max(30).optional(),
  ultimaAtividade: z.string().max(200).optional(),
  semTrabalharDesde: z.string().max(40).optional(),
  pedidosAoInss: z.string().max(300).optional(),
  emBranco: z.array(z.string()),                   // o que o Jurídico vê que ficou em branco (CA6)
})

export const EnvioDaFicha = z.object({             // sem campo de senha (CA8)
  nome: z.string().refine(validarNome),
  cpf: z.string().transform(normalizarCpf).refine(validarCpf),
  nascimento: z.string().transform((v) => dataParaIso(normalizarData(v))).refine((iso) => iso !== null && iso <= hojeIso()),
  telefone: z.string().transform(normalizarTelefone).refine(validarTelefone),
  endereco: z.string().max(200).optional(),
  pessoasNaCasa: z.number().int().min(1).max(30).optional(),
  beneficioInteresse: z.string(),                  // do catálogo, com "Não sei ainda" (CA7)
  ultimaAtividade: z.string().max(200).optional(),
  semTrabalharDesde: z.string().max(40).optional(),
  pedidosAoInss: z.string().max(300).optional(),
  origem: z.enum(['papel', 'tablet']), modelo: z.enum(['GGV', 'APA']).optional(),
})

export const LeituraDaFicha = z.object({           // o que a automação do scanner e a IA devolvem (CA14)
  modelo: z.enum(['GGV', 'APA']), arquivo: Arquivo,
  campos: EnvioDaFicha.partial(), naoLidos: z.array(z.string()), senhaLida: z.boolean(),
})

// O cofre: a senha vai e não volta; nunca em ficha, histórico, log nem sessionStorage (CA9).
export const GuardarSenha = z.object({ senha: z.string().min(1).max(100), origem: z.enum(['ficha', 'renovacao']) })
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/fichas/:id/ficha-de-atendimento/leitura` | aviso do n8n | `LeituraDaFicha` | `lerFichaEmPapel` |
| `PUT /api/fichas/:id/ficha-de-atendimento` | `EnvioDaFicha` | `{ ficha }` ou `{ erro: 'cpf-de-outra-ficha', nome }` | `salvarFichaDeAtendimento` |
| `GET /api/telefones/:numero/conferencia` | número | `{ valido, tipo }` | `conferirTelefone` (ferramenta gratuita, simulada) |
| `POST /api/fichas/:id/cofre/gov` | `GuardarSenha` | `{ senhaGov }` | `guardarSenhaNoCofre` |
| `POST /api/fichas/:id/cofre/gov/nao-sabe` | — | `{ senhaGov }` | `naoSabeASenha` |
| `POST /api/fichas/:id/cofre/gov/conferida` | — | `{ senhaGov }` | `conferirSenhaLida` |

### Campos e a função de cada um

| Campo | Funções |
|---|---|
| Nome completo * | `validarNome`, `normalizarNome` |
| CPF * | `normalizarCpf`, `validarCpf`, `formatarCpf`; CPF de outra ficha não grava |
| Data de nascimento * | `normalizarData`, `dataParaIso`, não futura (`erroData`) e a idade ao lado (`idadeEm`) |
| Telefone / WhatsApp * | `normalizarTelefone`, `validarTelefone`, `formatarTelefone` e a conferência simulada |
| Endereço | texto até 200 |
| Quantas pessoas moram na casa | `normalizarInteiro`, de 1 a 30 |
| Benefício procurado | lista `BENEFICIOS`, com "Não sei ainda" |
| Última atividade, Desde quando está sem trabalhar, O que já pediu ao INSS | texto com tamanho |
| Data da ficha | hoje, só leitura |
| Senha do gov.br | só o componente do cofre (`CampoCofre`), fora do formulário da ficha, ou "Não sei a senha" |

O servidor de exemplo valida de novo com as mesmas funções.

### Decisões da história

1. **Hoje é papel** (CA14): "Digitalizar a ficha em papel (scanner simulado)" guarda a imagem em Documentos pessoais e devolve a leitura de exemplo (`leituraDeExemplo` em `exemplo.ts`: o que a ficha já tem e os exemplos do Figma; CPF e data de nascimento ficam "não lidos", porque a semente não inventa CPF). Os campos lidos chegam marcados "lido pela IA · confira"; o Atendimento confere e salva.
2. **Tablet** (CA1): o mesmo formulário, uma pergunta por tela, com letra grande, e "Salvar ficha" no fim. Fica pronto para quando o tablet chegar.
3. **Senha** (CA2, CA3, CA8, CA9, CA15): o componente do cofre fica fora do formulário da ficha, manda a senha direto ao cofre (simulado: o servidor de exemplo descarta o valor e grava só quem, quando e de onde) e mostra "senha no cofre · atualizada em dd/mm por fulano". Lida da ficha em papel, a senha vai ao cofre marcada para conferir, e o Atendimento marca "Conferi a senha do cofre com o papel". "Não sei a senha" aceita a ficha e deixa o alerta para a GGVP-36. O teste procura uma senha de teste na tela, no `sessionStorage` e no histórico.
4. **"Salvar ficha"** (CA5, CA6): só com nome, CPF, nascimento e telefone; o resto pode ficar em branco e vai para `emBranco`, que a preparação da conversa (GGVP-32) mostra ao Jurídico.
5. **Uma ficha só**: os dados pessoais vão para a ficha da pessoa e as respostas da triagem para `fichaAtendimento`. Salvar conclui a pendência "Preencher ficha" e, com a entrevista já confirmada, abre o "Preparar entrevista" do Jurídico (GGVP-21, CA3).
6. **Histórico** (CA10): a primeira vez grava "Salvou a ficha de atendimento (papel GGV)"; depois, "Alterou na ficha de atendimento: telefone e endereço". Nunca o valor da senha.
7. **Telefone** (CA12): a ferramenta gratuita de validação é serviço de fora, simulada sobre `validarTelefone`; a tela mostra "conferido".
8. **O Jurídico vê a ficha antes** (CA4): o cartão "Ficha de atendimento" na ficha do cliente mostra as respostas, o que ficou em branco e a situação da senha; a preparação da conversa (GGVP-32, grupo 2) usa os mesmos dados.
9. **A IA completa pela transcrição** (CA13): entra com a transcrição (GGVP-46, grupo 3), sobre o mesmo "lido pela IA · confira".

## Risks / Trade-offs

- [Fontes de "Como chegou" não são as do Airtable] → lista de exemplo, num arquivo só; trocar ao ligar no servidor. Os benefícios já são os do Airtable, normalizados no cartão GGVP-91 (desde a GGVP-21).
- [A semente só tem um CPF, o de teste, que é do Antônio] → o teste que salva a ficha de atendimento usa a ficha dele; a da Josefa mostra a trava sem CPF. Nenhum CPF inventado.
- [O que levar de cada benefício só está escrito para o LOAS] → os outros usam "RG, CPF e os laudos" até a GGVP-104 trazer as listas.
- [O cofre de verdade é da GGVP-103] → aqui só o componente que guarda e mostra a situação, simulado, sem guardar o valor; "Revelar" fica na GGVP-103.
- [Regra do scanner para achar a pasta não está escrita em lugar nenhum] → CPF, senão nome sem acento; parâmetro de `regras/pasta.ts`, ajusta com a GGVP-81.
- [Ficha do cliente não tinha história própria] → ela está entre as telas desta história; a GGVP-86 constrói sobre ela.
- [O Vitest estoura o tempo do worker no OneDrive] → rodar de novo e colar as duas saídas.
- [O formato do aviso do n8n para o portal ainda não foi combinado com o Mateus] → o lote simulado segue as colunas do "Painel da digitalização" (status e motivo); ajustar ao ligar no servidor.
- [A página do processo não existe ainda (GGVP-86, Fernando)] → o que é do processo nos CA6, CA12 e CA14 fica pronto no servidor de exemplo, com teste (`pastaDoProcesso`, "Laudo novo" no processo); a tela entra com a GGVP-86.
- [O chat é da GGVP-82 (Fernando)] → aqui entra só o fluxo "Subir laudo novo", sem modelo de linguagem; avisar o Fernando para ele construir em cima.
- [Que tipo vai para Documentos pessoais e qual vai para o processo não está escrito no cartão] → lista em `regras/arquivos.ts`, um lugar só; ajusta com a GGVP-81.
- [Limite de remarcações (G15) não está no cartão] → 2, decisão do Pedro em 05/10, num lugar só (`regras/agenda.ts`); o laço e o escalonamento são da GGVP-94. Levar ao cartão.
- [O cartão fala em "link da ficha", e a ficha é em papel até o tablet chegar (Lucas e Pedro, 05/10)] → o convite pede a ficha em papel; quando o tablet chegar, troca o texto. Levar ao cartão.
- [Google Meet e Chatwoot de verdade são serviços de fora] → link do Meet e conversa do Chatwoot simulados; ligar com a GGVP-102.

## Migration Plan

Nada a migrar: dado de exemplo no navegador. Desfazer é reverter o PR.
