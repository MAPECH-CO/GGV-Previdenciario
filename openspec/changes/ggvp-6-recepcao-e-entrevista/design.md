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

## GGVP-32 · Preparar a conversa lendo a ficha

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/advogada` | Central de trabalho · Advogada `59:449` | A fila da advogada: busca, "Pergunte ou peça" com os atalhos dela, abas e "O que você tem que fazer", com as tarefas do Jurídico que o portal cria e as de exemplo do Figma (só com as pessoas da semente) |
| `/entrevista/:agendamentoId/preparar` | step_D1.06 `14:2` | Chips, "nome · Preparar entrevista", "A IA sugere · você confere" com o resumo da IA, os pontos de atenção, a senha do gov.br (só a situação e a última vez que funcionou), a renovação, a anotação do primeiro contato, o que ficou em branco, a ficha completa e a segunda ficha; "Analisar a ficha" e "Iniciar entrevista (Transcrição)"; no lado, "Antes de concluir" |

A Central da Advogada não tem cartão próprio: entra aqui porque o CA1 pede "minha fila", e o Figma conta como validado. A troca de perfil no topo continua indisponível (GGVP-78); a Central abre por `/advogada`.

### Contrato (Zod, vai para `packages/contratos/entrevista.ts`)

```ts
// O que a preparação lê da ficha. A análise, a segunda ficha e a renovação nascem na GGVP-28 e na GGVP-36.
export const AnaliseDaFicha = z.object({ acidentario: z.boolean(), quem: z.string(), quando: z.string() })
export const Renovacao = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('renovou'), quem: z.string(), quando: z.string() }),
  z.object({ resultado: z.literal('nao-conseguiu'), motivo: z.string(), quem: z.string(), quando: z.string() }),
])
export const PontoDeAtencao = z.object({ tipo: z.enum(['acidentario', 'senha', 'beneficio', 'em-branco']), texto: z.string(), alerta: z.boolean() })
export const Preparacao = z.object({
  ficha: Ficha, agendamento: Agendamento,
  resumo: z.string(),                       // a leitura da IA, para conferir (CA3)
  pontos: z.array(PontoDeAtencao),          // CA1, CA2
  primeiroContato: Contato.optional(),      // CA5
})
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/entrevistas/:id/preparacao` | `id` | `Preparacao` | `obterPreparacao` |
| `GET /api/central/advogada` | — | `Tarefa[]` | `tarefasDaAdvogada` |

### Decisões da história

1. **Pontos de atenção** (CA1, CA2, CA4): regra em `regras/preparacao.ts`: o acidentário (benefício citado acidentário, ou a decisão da análise e a segunda ficha), a senha do gov.br pela situação (sem senha, o escritório tem mas não está no cofre, no cofre com a última vez que funcionou) e se o Atendimento já tentou renovar, o benefício que o cliente procura e o que ficou em branco. A tarefa "Preparar entrevista" da fila traz esses pontos no detalhe.
2. **Resumo da IA** (CA3): simulado em `dados/preparacao.ts` a partir da ficha de atendimento, marcado "A IA sugere · você confere", com os links para a ficha completa e para a segunda ficha quando houver.
3. **Primeiro contato** (CA5): a anotação mais antiga de "Últimos contatos". A preparação abre pela tarefa da fila e pelo "Preparar entrevista" do detalhe do compromisso na agenda.
4. **"Iniciar entrevista (Transcrição)"**: visual do Figma; só libera com a ficha analisada e, no acidentário, a segunda ficha preenchida (GGVP-28, CA3). A tela da entrevista vem no grupo 3 (GGVP-40); até lá o botão leva à rota dela, que cai em "ainda não construída".
5. **Topo das telas da advogada**: o "Início" leva a `/advogada`; o contexto à direita é "Você · Advogada responsável", como no Figma.
6. **Dado de saúde**: a preparação é tela do Jurídico e mostra a seção médica da segunda ficha; a ficha do cliente (Atendimento) não.

## GGVP-28 · Segunda ficha para auxílio acidentário

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/entrevista/:agendamentoId/analisar` | step_D1.07 `14:36` | "nome · Analisar ficha": "Pode ser auxílio acidentário?" com "Sim — abrir 2ª ficha" e "Não", a situação da senha do gov.br, o aviso do G9 e "Confirmar" |
| `/clientes/:fichaId/segunda-ficha` | Segunda ficha: auxílio acidentário `1815:422` | "nome · Preencher segunda ficha": a ficha em papel no scanner simulado, as 6 seções do modelo (o cartão manda; o Figma tem só campos de exemplo), a senha do Meu INSS pelo cofre e "Enviar segunda ficha" |
| `/clientes/:fichaId/segunda-ficha?modo=tablet` | a mesma, uma seção por tela | O cliente no tablet, com letra grande |

### Contrato (Zod, vai para `packages/contratos/fichas.ts`)

```ts
const SimNao = z.enum(['sim', 'nao', 'nao-sei'])
const Data = z.string().transform(normalizarData).refine((d) => d === '' || (dataParaIso(d) !== null && dataParaIso(d)! <= hojeIso()))
export const RespostasDaSegundaFicha = z.object({
  // (1) atendimento e dados pessoais: vêm da ficha única, sem repetir
  empresa: z.string().max(120), funcao: z.string().max(120), vinculo: z.string().max(80),            // (2) profissionais
  afastamentoEm: Data, acidenteEm: Data, acidenteLocal: z.string().max(200),
  nb: z.string().refine((v) => v === '' || validarNb(v)), der: Data,                                  // (3) INSS; a senha vai ao cofre
  cat: SimNao, catEm: Data, boletim: SimNao, boletimEm: Data, deTrabalho: SimNao,                      // (4) acidente
  parteDoCorpo: z.string().max(120), lado: z.enum(['', 'direito', 'esquerdo', 'os dois']),
  doencas: z.string().max(300), cid: z.string().max(40), tratamento: z.string().max(300),              // (5) médicos: só o Jurídico
  cirurgia: SimNao, medico: z.string().max(120), laudos: z.string().max(300),
  historico: z.string().trim().min(3).max(2000),                                                       // (6) obrigatório (Figma)
})
export const SegundaFicha = z.object({ data: z.string(), origem: z.enum(['papel', 'tablet']), respostas: RespostasDaSegundaFicha })
export const DecisaoDaAnalise = z.object({ acidentario: z.boolean() })
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/entrevistas/:id/analise` | `DecisaoDaAnalise` | `{ tarefas }` | `registrarAnalise` |
| `POST /api/fichas/:id/segunda-ficha/leitura` | aviso do n8n | `{ arquivo, respostas, senhaLida }` | `lerSegundaFichaEmPapel` |
| `PUT /api/fichas/:id/segunda-ficha` | `RespostasDaSegundaFicha` e a origem | `{ ficha }` | `salvarSegundaFicha` |

### Campos e a função de cada um

| Campo | Funções |
|---|---|
| Datas (afastamento, acidente, DER, CAT, boletim) | `normalizarData`, `dataParaIso`, não futura |
| Número do benefício | `normalizarNb`, `validarNb`, `formatarNb` |
| Houve CAT, boletim, acidente de trabalho, cirurgia | escolha: Sim, Não, Não sei |
| Lado | escolha: direito, esquerdo, os dois |
| Os outros | texto com tamanho |
| Senha do Meu INSS | só o componente do cofre (a mesma conta do gov.br) |

### Decisões da história

1. **Analisar a ficha** (CA1, CA4): a decisão fica na ficha, com a autora e o horário, e no histórico. "Sim" abre a pendência do Atendimento "Preencher segunda ficha" (D1.07), em papel até o tablet chegar. A tela fica no caminho da preparação: "Analisar a ficha" na preparação leva a ela. A tarefa da advogada continua sendo uma por entrevista, "Preparar entrevista"; "Analisar ficha" é o título da tela do passo.
2. **A entrevista espera a segunda ficha** (CA3): `entrevistaLiberada` em `regras/segundaFicha.ts`, com teste; a preparação mostra o motivo no "Iniciar entrevista".
3. **As 6 seções** (CA5): a primeira mostra os dados pessoais da ficha única, sem repetir; o resto é a lista do contrato. O que ficou em branco é guardado, como na ficha de atendimento.
4. **Papel e IA** (CA6, CA7): como na GGVP-24, com a imagem "Ficha de atendimento AUXILIO ACIDENTE" em Documentos pessoais e a senha do Meu INSS no cofre para conferir.
5. **Dado médico só para o Jurídico** (CA8): na conferência do Atendimento, a seção 5 não aparece ("a IA leu e guardou só para o Jurídico"); no tablet, o próprio cliente preenche; a ficha do cliente mostra só "Segunda ficha preenchida em dd/mm"; a preparação da advogada mostra tudo. O histórico nunca leva o conteúdo médico.
6. **As duas fichas juntas** (CA2): a preparação mostra a ficha de atendimento e a segunda ficha lado a lado.

## GGVP-36 · Renovar a senha do gov.br antes da entrevista

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/entrevista/:agendamentoId/renovar-senha` | step_D1.08 `10:89` | "nome · Renovar senha do gov.br": "O que você deve fazer" com o código de verificação no celular do cliente, a frase da tarefa, a nova senha direto no cofre (mascarada), "Conferi que o Meu INSS abre e que o CNIS aparece", o motivo e o aviso no "Não", o aviso do G9 e "Guardar no cofre"; no lado, "Conseguiu renovar?" |

### Contrato (Zod, vai para `packages/contratos/fichas.ts`)

```ts
export const RegistroDaRenovacao = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('renovou'), senha: z.string().min(1).max(100), conferiMeuInss: z.literal(true) }),   // a senha vai ao cofre e não volta
  z.object({ resultado: z.literal('nao-conseguiu'), motivo: z.string().trim().min(3).max(300), aviseiOCliente: z.literal(true) }),
])
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/entrevistas/:id/renovacao` | `RegistroDaRenovacao` | `{ senhaGov, renovacao }` | `registrarRenovacao` |

### Decisões da história

1. **Quando nasce** (CA1, CA4): ao confirmar a análise da ficha (GGVP-28) de quem está sem senha no cofre, o Atendimento recebe "Renovar senha do gov.br" (D1.08), com prazo no horário da entrevista.
2. **"Sim"** (CA2, CA5, CA9, CA11): a senha é digitada numa caixa mascarada que vai direto ao cofre, sem ficar em nenhum outro lugar; "Guardar no cofre" só habilita com a senha e "Conferi que o Meu INSS abre e que o CNIS aparece", e o cofre grava essa data como a última vez em que a senha funcionou.
3. **"Não"** (CA3, CA6): o motivo é obrigatório e "Avisei o cliente" também; o aviso fica em "Últimos contatos" e a entrevista segue.
4. **Trilha** (CA8): toda gravação no cofre registra quem, quando e a ação, sem o valor.
5. **Código de verificação** (CA10): a tela lembra que o código chega no celular ou no e-mail do próprio cliente.
6. **A advogada vê** (CA7): o resultado aparece na preparação da conversa (GGVP-32).

## GGVP-40 · Entrevistar com gravação

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/entrevista/:agendamentoId` | step_D1.09 `14:65` | "nome · Fazer entrevista": chips, "entrevista inicial · gravada", a frase do passo, o aviso do G10, "Iniciar entrevista (Transcrição)" e o bloco "Áudio gravado fora do portal" (CA9); no lado, "Antes de concluir" |
| `/entrevista/:agendamentoId/gravacao` | Atendimento · Reunião com transcrição `73:560`, com o roteiro do Overlay · Entrevista `1581:348` | "Entrevista com nome": "Gravar" lembra o aviso (G10) e só grava depois de "Avisei o cliente"; "● Gravando · 00:07:42 · aviso de gravação feito às 10:31 (G10)", "Pausar"/"Retomar", "Abrir o cofre", "Encerrar e gerar resumo"; "Transcrição ao vivo"; "Ficha preenchida pela IA · você confere"; "Roteiro da entrevista (a IA marca o que for respondido)"; "Pendências que a IA apontou"; "Ao encerrar"; "Definir o benefício (D1.12)" só depois de encerrar |

`?simular=falha-do-microfone` e `?simular=falha-da-transcricao` simulam as falhas (CA8 e GGVP-46, CA3), como o "scanner simulado" da GGVP-17.

### Contrato (Zod, vai para `packages/contratos/entrevista.ts`)

```ts
export const Papel = z.enum(['advogada', 'cliente', 'atendimento'])
export const Trecho = z.object({ aos: z.number().int().min(0), quem: z.string(), papel: Papel, texto: z.string(), prova: z.boolean().optional() })
export const InformacaoExtraida = z.object({
  id: z.string(), rotulo: z.string(), valor: z.string(),
  destino: z.enum(['ficha', 'documentacao', 'cofre', 'processo']),
  campo: z.enum(['telefone', 'estadoCivil', 'profissao', 'contatoApoio']).optional(),   // quando o destino é a ficha
  conferidaEm: z.string().optional(),                                                  // antes disso, a ficha não muda (GGVP-46, CA6)
})
export const AcaoNaGravacao = z.object({
  acao: z.enum(['avisou', 'gravou', 'pausou', 'retomou', 'abriu-cofre', 'guardou-senha', 'falhou', 'encerrou', 'sem-audio', 'subiu-arquivo', 'enviou-audio']),
  quando: z.string(), aos: z.number().int().min(0),
})
export const Audio = z.object({ nome: z.string(), formato: z.string(), tamanho: z.number().int().min(0), partes: z.number().int().min(1) })
export const Gravacao = z.object({
  id: z.string(), fichaId: z.string(), agendamentoId: z.string().optional(),
  data: z.string(), titulo: z.string(), canal: z.string(), participantes: z.array(z.string()),
  duracao: z.number().int().min(0),                          // segundos
  origem: z.enum(['portal', 'arquivo', 'registro']),
  avisoEm: z.string().optional(),                            // G10
  estado: z.enum(['gravando', 'pausada', 'falhou', 'encerrada']),
  acoes: z.array(AcaoNaGravacao),
  audio: Audio.optional(),                                   // guardado para sempre (CA13)
  transcricao: z.enum(['aguardando-internet', 'transcrevendo', 'falhou', 'pronta', 'sem-audio']),
  motivoDaFalha: z.string().optional(),
  trechos: z.array(Trecho), resumo: z.string().optional(), extraidas: z.array(InformacaoExtraida),
  documentos: z.array(z.string()), documentosConferidosEm: z.string().optional(),
  registro: z.string().max(4000).optional(),                 // conversa sem áudio
  soJuridico: z.boolean(),                                   // entrevista com a advogada: dado de saúde
  marcas: z.array(z.string()),                               // "ficha atualizada", "benefício definido"
})
export const InicioDaGravacao = z.object({ avisei: z.literal(true) })                   // CA4
export const AudioDeFora = z.object({ nome: z.string().min(1), tipo: z.string(), tamanho: z.number().int().min(1) })  // CA9, CA10
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/entrevistas/:id` | `id` | `{ ficha, agendamento, gravacao? }` | `obterEntrevista` |
| `POST /api/entrevistas/:id/gravacoes` | `InicioDaGravacao` | `Gravacao` | `iniciarGravacao` |
| `POST /api/gravacoes/:id/acoes` | `{ acao, aos }` | `Gravacao` | `registrarAcao` |
| `POST /api/gravacoes/:id/encerrar` | `{ aos, online }` | `{ gravacao, tarefa }` | `encerrarGravacao` |
| `POST /api/gravacoes/:id/audio` | o áudio guardado no computador | `Gravacao` | `enviarAudioGuardado` |
| `POST /api/gravacoes/:id/sem-audio` | `{ notas }` | `{ gravacao, tarefa }` | `registrarSemAudio` |
| `POST /api/entrevistas/:id/audio` | `AudioDeFora` e o arquivo | `{ gravacao, tarefa }` | `subirAudio` |
| `POST /api/gravacoes/:id/transcricao` | — | `Gravacao` | `transcrever` |

### Decisões da história

1. **O aviso antes de gravar** (CA1, CA4, G10): "Gravar" abre o lembrete com a frase do aviso; a gravação só começa com "Avisei o cliente · começar a gravar", que grava a hora do aviso. O servidor recusa iniciar sem `avisei`.
2. **Gravação simulada.** Sem microfone de verdade: o relógio corre, a transcrição ao vivo mostra a conversa de exemplo (`conversaDeExemplo` em `exemplo.ts`, montada com a ficha) e a IA marca o roteiro e as informações. O áudio é um arquivo simulado `entrevista-<ficha>-<data>.webm`.
3. **Cada ação registrada** (CA5): avisou, gravou, pausou, retomou, abriu o cofre, guardou a senha, falhou, encerrou, com a hora e o ponto do áudio. Ao encerrar: o compromisso vira "realizado", o "Preparar entrevista" sai da fila, o áudio vai para a transcrição (D1.11) e a advogada recebe "nome · Cadastrar lead" (D1.10). A página que recarrega no meio volta com a gravação pausada no último ponto.
4. **Cofre durante a entrevista** (CA6, G9): "Abrir o cofre" pausa a gravação e mostra o `CampoCofre`; guardada a senha, a gravação retoma sozinha. O trecho pausado não entra no áudio nem na transcrição.
5. **Senha dita mesmo assim** (CA3, CA7, G9): `tirarSenhas` em `regras/entrevista.ts` troca por "[senha retirada: vai ao cofre]" o que parece senha perto da palavra "senha" (na mesma fala ou na resposta à pergunta), com teste de várias senhas de teste faladas. A transcrição guardada já sai limpa.
6. **Falha** (CA8): o aviso aparece na hora, o que foi gravado fica guardado, e a advogada escolhe "Tentar gravar de novo" ou "Registrar como sem áudio" (com as anotações dela).
7. **Áudio de fora** (CA9, CA10): aceita qualquer `audio/*` ou extensão de áudio (mp3, ogg, opus, m4a, wav, webm, aac, amr, wma, flac), sem limite de tamanho; `partesDoAudio` divide em partes de até 24 MB para a transcrição e `juntarPartes` junta o texto na ordem, com o tempo corrido.
8. **Sem internet** (CA12): com `navigator.onLine` falso, a tela avisa e continua gravando; ao encerrar, a transcrição fica "aguardando a internet" e o áudio é enviado uma vez quando a conexão volta (o servidor ignora o segundo envio).
9. **Guardado para sempre** (CA13): não há função que apague áudio ou gravação; a tela diz "guardado no caso".
10. **"Definir o benefício (D1.12)"** só vira link depois de encerrar; leva à tela da GGVP-51 (grupo 2), que até lá cai em "ainda não construída".

## GGVP-43 · Cadastrar o lead depois da entrevista

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| `/clientes/:fichaId/cadastro` | step_D1.10 `14:89` | "nome · Cadastrar lead", "Após a entrevista": "Preencher" com nome completo, CPF, RG, nascimento e idade, estado civil, profissão, telefone, CEP, rua e número, bairro, cidade e UF, e o representante legal; a origem de cada valor e as divergências; "Salvar cadastro"; no lado, "Antes de concluir" com os campos, as travas e o kit |

### Contrato (Zod, vai para `packages/contratos/fichas.ts`)

```ts
export const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'] as const
export const Representante = z.object({
  nome: z.string().refine(validarNome), cpf: z.string().refine(validarCpf), rg: Rg,
  parentesco: z.enum(['Mãe', 'Pai', 'Tutor(a)', 'Curador(a)', 'Outro']),
  estadoCivil: z.enum(ESTADOS_CIVIS), profissao: z.string().min(2).max(80),
})
export const Cadastro = z.object({
  nome: z.string().refine(validarNome), cpf: z.string().refine(validarCpf), rg: Rg,             // Rg: 5 a 14 letras e números
  nascimento: z.string().transform(normalizarData).refine(naoFutura),
  estadoCivil: z.enum(ESTADOS_CIVIS), profissao: z.string().min(2).max(80),                   // da lista PROFISSOES
  telefone: z.string().refine(validarTelefone),
  cep: z.string().refine(validarCep), rua: z.string().min(3).max(150), bairro: z.string().min(2).max(80),
  cidade: z.string().min(2).max(80), uf: z.string().length(2),
  representante: Representante.optional(),
})
export const PedidoDeCadastro = z.object({ base: Cadastro.partial(), valores: Cadastro })   // base: o que a tela abriu (CA11)
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/fichas/:id/cadastro` | `id` | `{ ficha, extraidas }` | `obterCadastro` |
| `PUT /api/fichas/:id/cadastro` | `PedidoDeCadastro` | `{ resultado: 'salvo', ficha } \| { resultado: 'cpf-de-outra-ficha', id, nome } \| { resultado: 'conflito', campos }` | `salvarCadastro` |
| `GET /api/fichas/:id/kit` | `id` | `{ pode, falta }` | `podeGerarKit` |

### Campos e a função de cada um

| Campo | Funções |
|---|---|
| Nome completo | `normalizarNome`, `validarNome` |
| CPF (e o do representante) | `normalizarCpf`, `validarCpf` (dígitos verificadores, CA5), `formatarCpf` |
| Nascimento | `normalizarData`, `dataParaIso`, não futura; a idade por `idadeEm` (CA10) |
| Telefone | `normalizarTelefone`, `validarTelefone`, `formatarTelefone` |
| CEP | `normalizarCep`, `validarCep`, `formatarCep`, `buscarCep` com o ViaCEP simulado (CA10) |
| RG | letras e números, de 5 a 14 (regra em `regras/cadastro.ts`) |
| Estado civil, profissão, parentesco | escolha numa lista (`ESTADOS_CIVIS`, `PROFISSOES`) |

### Decisões da história

1. **A mesma ficha** (CA9): o cadastro completa a ficha do primeiro contato; nunca cria outra. Ela continua lead até "Fechou com o escritório? Sim" (D1.14, GGVP-60), que só muda a situação.
2. **Preenchido das fontes** (CA1, CA8): `preencherCadastro` junta a ficha e o que a IA tirou da entrevista; cada campo mostra de onde veio ("da ficha", "da entrevista"), e o que as duas dizem diferente aparece destacado, com "Usar o da ficha" e "Usar o da entrevista".
3. **Obrigatórios** (CA3): os do modelo do contrato: nome completo, CPF, RG, estado civil, profissão, endereço (CEP, rua e número, bairro, cidade, UF) e telefone; com representante, os dele. "Salvar cadastro" mostra o que falta.
4. **CPF de outra ficha** (CA2): o servidor não grava e devolve a ficha dona; a tela mostra "Este CPF já é do cadastro de nome" com o link.
5. **Histórico com o valor anterior** (CA7): cada campo alterado vira "Alterou o estado civil: «Solteiro(a)» → «Casado(a)»", com quem e quando.
6. **Representante** (CA6): "Tem representante legal" mostra os campos do representante. O catálogo do GGVP-91 não tem "LOAS representado (genitor)"; a caixa vem marcada quando a ficha já tem representante.
7. **Kit** (CA4): `faltaParaOKit` em `regras/cadastro.ts`, com teste; o lado da tela diz se o kit pode ser gerado ou o que falta. O botão do kit é da história do D1.15 e usa a mesma regra (`podeGerarKit`).
8. **Duas pessoas** (CA11): o aviso "está editando" passa entre as abas abertas pelo `BroadcastChannel` (a presença do Supabase, ao ligar no servidor); salvar manda o que a tela abriu (`base`) e `mesclar` guarda o que o outro salvou nos campos que eu não mexi; campo mexido pelos dois volta como conflito para escolher.
9. **Profissão numa lista** (CA10): `PROFISSOES` de exemplo em `catalogos.ts`, trocar pela do Airtable; valor antigo fora da lista aparece como dica para escolher.

## GGVP-46 · Transcrever a entrevista

### Telas e rotas

| Rota | Figma | O que faz |
|---|---|---|
| janela "Transcrições" na ficha do cliente e na entrevista encerrada | Overlay · Transcrições do processo `1626:2` | "▶ Transcrições do caso", "N gravações · M registro sem áudio", "Registrar nova conversa"; à esquerda "Gravações e registros" (data, duração, título, participantes, situação); à direita o título, "Abrir áudio", "Exportar PDF", "Resumo · Informações extraídas · Transcrição", o resumo pela IA, as informações extraídas com o destino e "Conferir e levar", os documentos para o checklist, a busca, os trechos marcados como prova, o player e a transcrição com quem fala |

### Contrato (Zod, vai para `packages/contratos/entrevista.ts`)

```ts
export const ConferenciaDasInformacoes = z.object({ ids: z.array(z.string()).min(1) })
export const ConferenciaDosDocumentos = z.object({ documentos: z.array(z.string().min(2).max(120)).min(1) })
export const ConversaSemAudio = z.object({
  data: z.string().transform(normalizarData).refine(naoFutura), canal: z.enum(['WhatsApp', 'Telefone', 'Presencial', 'Vídeo']),
  titulo: z.string().trim().min(3).max(120), participantes: z.string().trim().min(3).max(120), texto: z.string().trim().min(3).max(4000),
})
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/fichas/:id/gravacoes` | `id` | `Gravacao[]` | `obterGravacoes` |
| `POST /api/gravacoes/:id/transcricao` | — (tentar de novo) | `Gravacao` | `transcrever` |
| `POST /api/gravacoes/:id/conferencias` | `ConferenciaDasInformacoes` | `{ gravacao, ficha }` | `conferirInformacoes` |
| `POST /api/gravacoes/:id/documentos` | `ConferenciaDosDocumentos` | `Gravacao` | `conferirDocumentos` |
| `PATCH /api/gravacoes/:id/trechos/:aos` | `{ prova }` | `Gravacao` | `marcarProva` |
| `POST /api/fichas/:id/conversas` | `ConversaSemAudio` | `Gravacao` | `registrarConversa` |

### Decisões da história

1. **Transcrição simulada** (CA1, CA8): a OpenAI fica simulada; `transcrever` monta os trechos da conversa de exemplo, separa quem fala (advogada, cliente, Atendimento), tira a senha (GGVP-40, CA3) e junta as partes. Aparece na janela com a data da entrevista.
2. **Busca** (CA2): `buscarTrechos` em `regras/transcricao.ts`, sem acento e sem maiúscula, mostra só os trechos com a palavra, marcada.
3. **Falha** (CA3): a gravação mostra "A transcrição falhou" com o motivo e "Tentar de novo".
4. **Lista** (CA4): cada gravação com a data, os participantes, a duração e a situação ("transcrita · ficha atualizada", "transcrevendo…", "falhou", "só registro").
5. **Nada se apaga** (CA5): sem botão nem função de apagar; o rodapé diz que fica guardado no caso.
6. **Conferir antes da ficha** (CA6, G14): cada informação tem o destino. "Conferir e levar" leva à ficha só as marcadas, com o valor antigo no histórico; "Documentação" vira a pendência "Pedir documento" da Documentação; "cofre" só diz que a senha foi ao cofre, sem valor; "processo" fica no caso para a definição do benefício. Também: marcar trecho como prova, "Abrir áudio" (player simulado), "Exportar PDF" (impressão do navegador, só a janela) e "Registrar nova conversa" sem áudio.
7. **Documentos para o checklist** (CA7): a IA lista o que o cliente precisa trazer; "Conferi · enviar ao checklist" grava na ficha a lista conferida para o checklist do benefício (GGVP-91).
8. **Quem vê**: o Jurídico vê tudo. Na ficha do cliente (Atendimento), a entrevista com a advogada mostra só a data, quem participou e a duração: o resumo, a transcrição e o áudio têm dado de saúde (o áudio só para o Jurídico, proposta do cartão da GGVP-40). As conversas do próprio Atendimento aparecem inteiras.

## Risks / Trade-offs

- [Fontes de "Como chegou" não são as do Airtable] → lista de exemplo, num arquivo só; trocar ao ligar no servidor. Os benefícios já são os do Airtable, normalizados no cartão GGVP-91 (desde a GGVP-21).
- [A semente só tem um CPF, o de teste, que é do Antônio] → o teste que salva a ficha de atendimento usa a ficha dele; a da Josefa mostra a trava sem CPF. Nenhum CPF inventado.
- [O que levar de cada benefício só está escrito para o LOAS] → os outros usam "RG, CPF e os laudos" até a GGVP-104 trazer as listas.
- [A Central da Advogada não tem cartão próprio] → entra com a GGVP-32, porque o CA1 pede "minha fila"; as tarefas de exemplo do Figma ficam só com as pessoas da semente. Levar ao Lucas.
- [O cartão da GGVP-28 lista a tarefa "Analisar ficha", e a advogada já tem "Preparar entrevista" da mesma entrevista] → uma tarefa por entrevista; "Analisar ficha" é a tela do passo, aberta pela preparação. Levar ao Lucas.
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
- [Gravar de verdade pede o microfone e a OpenAI] → gravação e transcrição simuladas com a conversa de exemplo; o microfone (MediaRecorder) e a OpenAI entram ao ligar no servidor. As falhas abrem por `?simular=`.
- [Achar senha falada no texto é aproximado] → a proteção principal é pausar no cofre (CA6); `tirarSenhas` pega o que parece senha perto de "senha", com teste. Senha soletrada em palavras ("um dois três") pode escapar: levar ao Lucas.
- [Aviso "está editando" entre pessoas pede servidor] → entre abas do mesmo navegador pelo `BroadcastChannel`; o "salvar não apaga o do outro" fica no servidor de exemplo, com teste. Cada aba tem a sua semente, então a mescla não aparece entre abas.
- [O catálogo do GGVP-91 não tem "LOAS representado (genitor)"] → caixa "Tem representante legal". Levar ao cartão.
- [Quem vê a transcrição não está decidido] → Jurídico vê tudo; Atendimento vê a entrevista com a advogada só pela data, participantes e duração. Levar ao Lucas.
- [A lista de profissões do Airtable não está aqui] → `PROFISSOES` de exemplo, num lugar só.

## Migration Plan

Nada a migrar: dado de exemplo no navegador. Desfazer é reverter o PR.
