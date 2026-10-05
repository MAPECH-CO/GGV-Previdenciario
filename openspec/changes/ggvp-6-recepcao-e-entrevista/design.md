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

1. **Servidor de exemplo.** `src/dados/servidor.ts` expõe funções assíncronas com a forma dos endpoints (abaixo). Lê a semente de `src/dados/exemplo.ts` e grava no `sessionStorage` (`ggv.exemplo.v1`), porque os links recarregam a página e o que se cria no balcão precisa chegar à ficha. Aba nova e cada teste do Playwright começam da semente. Armazenamento bloqueado cai na memória, sem erro. **Ligar no servidor** troca o corpo dessas funções por `fetch`, sobre o mesmo contrato, e apaga a semente.
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
   - "Entregar documento" leva à tela de receber documento (GGVP-17).
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

## Risks / Trade-offs

- [Catálogo de benefícios e fontes de "Como chegou" não são os do Airtable] → listas de exemplo, num arquivo só; trocar ao ligar no servidor.
- [Regra do scanner para achar a pasta não está escrita em lugar nenhum] → CPF, senão nome sem acento; parâmetro de `regras/pasta.ts`, ajusta com a GGVP-81.
- [Ficha do cliente não tinha história própria] → ela está entre as telas desta história; a GGVP-86 constrói sobre ela.
- [O Vitest estoura o tempo do worker no OneDrive] → rodar de novo e colar as duas saídas.

## Migration Plan

Nada a migrar: dado de exemplo no navegador. Desfazer é reverter o PR.
