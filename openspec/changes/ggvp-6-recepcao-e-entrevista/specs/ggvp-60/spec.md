# Spec Delta · ggvp-60 · Registrar por que não virou cliente e recontatar

## Purpose

O Atendimento registra se o lead fechou com o escritório e, se não fechou, o motivo de todo lead que não fechou e, se valer, uma data para recontatar, para voltar ao lead na hora certa e aprender por que perdemos. Telas do Figma: step_D1.14 `10:112` (decisões "Fechou com o escritório?" e "Vale recontatar numa data prevista?", motivo obrigatório, data do recontato), Atendimento · Novo cliente `73:371` ("Se não virar cliente, o motivo fica registrado (G16)") e Agenda · Semana · Atendimento `1941:2` (compromisso "Recontatar lead"). Passo D1.14 do Miro. Portão G16.

Contrato (Zod, vai para `packages/contratos/fichas.ts`; espelho em `apps/web/src/dados/tipos.ts`):

```ts
import { normalizarData, dataParaIso } from '@ggv/campos'
import { MOTIVOS_DE_NAO_FECHAR } from './catalogos'

export const PapelNoFechamento = z.enum(['atendimento', 'atendimento-senior', 'advogada-atendimento'])   // CA11
export const EsperaDoRecontato = z.enum(['pensar', 'esperar'])                                         // 15 e 30 dias (CA12)
const DataDoRecontato = z.string().transform((v) => dataParaIso(normalizarData(v))).refine((iso) => iso !== null && iso >= hojeIso())

export const Fechamento = z.object({
  situacao: z.enum(['fechou', 'recontatar', 'arquivado', 'recalcular']),   // recalcular: o recontato voltou ao cálculo (D1.13)
  motivo: z.enum(MOTIVOS_DE_NAO_FECHAR).optional(), detalhe: z.string().trim().max(500).optional(),
  espera: EsperaDoRecontato.optional(), recontatarEm: z.string().optional(), recontatoId: z.string().optional(),
  papel: PapelNoFechamento, quem: z.string(), quando: z.string(),
})
export const EnvioDoFechamento = z.discriminatedUnion('fechou', [
  z.object({ fechou: z.literal(true) }),                                            // segue para o kit (D1.15)
  z.object({ fechou: z.literal(false), motivo: z.enum(MOTIVOS_DE_NAO_FECHAR), detalhe: z.string().trim().max(500).optional(),
    papel: PapelNoFechamento,                                                       // "recusado" só com atendimento-senior ou advogada-atendimento
    recontatar: z.object({ data: DataDoRecontato, espera: EsperaDoRecontato.optional() }).nullable() }),   // nulo: arquivar (CA7)
])
export const ResultadoDoRecontato = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('calculo') }),
  z.object({ resultado: z.literal('nova-data'), data: DataDoRecontato, espera: EsperaDoRecontato.optional() }),
  z.object({ resultado: z.literal('arquivar'), motivo: z.enum(MOTIVOS_DE_NAO_FECHAR), detalhe: z.string().max(500).optional(), papel: PapelNoFechamento }),
])
// Ficha ganha fechamento?: Fechamento.
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `GET /api/fichas/:id/fechamento` | `id` | `{ ficha, entrevista? }` | `obterFechamento` |
| `POST /api/fichas/:id/fechamento` | `EnvioDoFechamento` | `{ ficha }` | `registrarFechamento` |
| `POST /api/fichas/:id/recontato` | `ResultadoDoRecontato` | `{ ficha }` | `registrarRecontato` |
| `POST /api/fichas/:id/processos` (o cliente fechou) | `{ beneficio }` | `{ ficha }` | `clienteFechou` (na junção, o `fecharContrato` do contrato) |
| parte de `GET /api/central/atendimento` | — | `Tarefa[]` | `tarefasDeFechamento` |

Campos e a função de cada um:

| Campo | Funções |
|---|---|
| Motivo * | lista `MOTIVOS_DE_NAO_FECHAR` (`catalogos.ts`) |
| Quem registra a recusa * (só com "Recusado pelo escritório") | lista: Atendimento sênior, Advogada do atendimento |
| Detalhe do motivo | texto, até 500 |
| Recontatar em * | `normalizarData`, `dataParaIso`, de hoje em diante (`erroDataDoCompromisso`); as pílulas "Ficou de pensar · 15 dias" e "Pediu para esperar · 30 dias" preenchem com `dataSugeridaDeRecontato` |

O servidor de exemplo valida de novo com as mesmas funções.

Decisões:

1. A tarefa "nome · Registrar fechamento" nasce para o lead com a entrevista realizada e sem fechamento registrado (`precisaRegistrarFechamento`, `regras/fechamento.ts`), e de novo quando o recontato volta ao cálculo. Na junção com o grupo benefício, o gatilho pode passar a ser o cálculo de tempo e pontos concluído (D1.13).
2. "Sim, fechou" usa o benefício da ficha (o que a advogada definiu no D1.12); sem ele, a tela pede a definição. Chama `clienteFechou(fichaId, beneficio)` (`dados/fechamento.ts`): por enquanto só marca a ficha como cliente e registra no histórico; na junção, o orquestrador troca o corpo pelo `fecharContrato` do contrato (GGVP-7), que cria o processo e o kit.
3. Os prazos são regra em `regras/fechamento.ts`: `DIAS_PARA_PENSAR = 15` e `DIAS_PARA_ESPERAR = 30` (Lucas, 05/10).
4. "Recusado pelo escritório" pede "Quem registra a recusa": Atendimento sênior ou advogada do atendimento (Lucas, 05/10). Sem login ainda, o papel escolhido vai para o histórico ("Você (Atendimento sênior)"); o perfil de verdade entra com a GGVP-78.
5. Vale recontatar: o compromisso "Recontatar lead" entra na agenda às 09:00, como "Retornos a leads" (passo D1.14), e a tarefa "nome · Recontatar lead" aparece na Central no dia, com o motivo, o último cálculo e o telefone; passou do dia, continua aberta, "atrasado desde dd/mm". O último cálculo vem da GGVP-57 (grupo benefício): até a junção, "nenhum registrado".
6. Não vale: o lead é arquivado com o motivo; as tarefas abertas dele se encerram (sai das filas ativas). Continua pesquisável: a busca do balcão mostra "Lead arquivado · motivo · data", e a ficha ganha o cartão "Fechamento".
7. O recontato (`/clientes/:id/recontato`, sem tela no Figma, no desenho das telas de passo) registra o resultado: voltar ao cálculo (D1.13), nova data ou arquivar com o motivo. Para quem "Ainda não tem direito", a tela já diz que o caso volta ao cálculo e leva à tela do cálculo (`/entrevista/:id/calculo`, do grupo benefício; até lá, "ainda não construída").

## ADDED Requirements

### Requirement: CA1 · O motivo é obrigatório (G16)
Para o lead que não fechou, ao encerrar, o portal SHALL exigir o motivo.

#### Scenario: CA1 · Encerrar sem fechar
- **Dado** um lead que não fechou
- **Quando** tento encerrar
- **Então** o portal exige o motivo (G16)

### Requirement: CA2 · A data do recontato avisa quem liga
Com "vale recontatar", ao informar a data, a régua SHALL avisar quem liga naquela data.

#### Scenario: CA2 · Informar a data
- **Dado** "vale recontatar"
- **Quando** informo a data
- **Então** a régua avisa quem liga naquela data

### Requirement: CA3 · Quem ainda não podia se aposentar volta ao cálculo
No recontato de alguém que ainda não podia se aposentar, ao abrir a tarefa, o caso SHALL voltar para o cálculo de tempo e pontos.

#### Scenario: CA3 · Abrir o recontato
- **Dado** o recontato de alguém que ainda não podia se aposentar
- **Quando** abro a tarefa
- **Então** o caso volta para o cálculo de tempo e pontos

### Requirement: CA4 · O lead arquivado mostra o motivo e a data
Ao consultar um lead arquivado, SHALL aparecer o motivo e a data.

#### Scenario: CA4 · Consultar
- **Dado** um lead arquivado
- **Quando** consulto
- **Então** vejo o motivo e a data

### Requirement: CA5 · "Fechou com o escritório?" é obrigatória
No fim da etapa depois da entrevista, a decisão "Fechou com o escritório?" SHALL ser obrigatória, e "Sim, fechou" MUST seguir para o kit do benefício (D1.15).

#### Scenario: CA5 · Encerrar a etapa
- **Dado** o fim da etapa depois da entrevista
- **Quando** tento encerrar
- **Então** a decisão é obrigatória, e "Sim, fechou" segue para o kit do benefício

### Requirement: CA6 · O motivo numa lista
Com "Não fechou", o motivo SHALL ser escolhido numa lista (Preço, Desistiu, Ainda não tem direito, Foi a outro escritório, Sem retorno, Contato inválido, Fez o processo sozinho, Falecido, Recusado pelo escritório, Outro), com o detalhe em texto opcional.

#### Scenario: CA6 · Registrar "Não fechou"
- **Dado** "Não fechou"
- **Quando** registro
- **Então** escolho o motivo numa lista e posso detalhar em texto

### Requirement: CA7 · Sem recontato, o lead é arquivado
Com "Vale recontatar: Não", o lead SHALL ser arquivado com o motivo, sair das filas ativas e continuar pesquisável, com o motivo e o histórico.

#### Scenario: CA7 · Confirmar sem recontato
- **Dado** "Vale recontatar: Não"
- **Quando** confirmo
- **Então** o lead é arquivado com o motivo, sai das filas ativas e continua pesquisável

### Requirement: CA8 · A tarefa "Recontatar lead" na data
Quando a data de recontato chega, a tarefa "Recontatar lead" SHALL aparecer na Central do Atendimento com o motivo registrado, o último cálculo e o contato do lead.

#### Scenario: CA8 · A data chega
- **Dado** a data de recontato
- **Quando** ela chega
- **Então** a tarefa aparece na Central com o motivo, o último cálculo e o contato

### Requirement: CA9 · O recontato não feito fica atrasado
Com o recontato não feito na data, passada a data, a tarefa SHALL continuar aberta e aparecer como atrasada.

#### Scenario: CA9 · A data passa
- **Dado** um recontato não feito na data
- **Quando** a data passa
- **Então** a tarefa continua aberta e aparece como atrasada

### Requirement: CA10 · O resultado do recontato
Com o recontato concluído, ao registrar o resultado, o caso SHALL voltar ao cálculo refeito (D1.13), ou ganhar uma nova data, ou ser arquivado com o motivo.

#### Scenario: CA10 · Registrar o resultado
- **Dado** o recontato concluído
- **Quando** registro o resultado
- **Então** o caso volta ao cálculo refeito, ou ganha uma nova data, ou é arquivado com o motivo

### Requirement: CA11 · Quem registra a recusa do escritório
O motivo "Recusado pelo escritório" SHALL ser registrado pelo Atendimento sênior ou pelo advogado do setor de atendimento.

#### Scenario: CA11 · Registrar a recusa
- **Dado** o motivo "Recusado pelo escritório"
- **Quando** é registrado
- **Então** quem registra é o Atendimento sênior ou o advogado do setor de atendimento

### Requirement: CA12 · A data sugerida: 15 ou 30 dias
Com "Vale recontatar: Sim", a data sugerida SHALL ser 15 dias depois para quem ficou de pensar e 30 dias depois para quem pediu para esperar; os dois prazos são regra em código com teste.

#### Scenario: CA12 · Escolher a data
- **Dado** "Vale recontatar: Sim"
- **Quando** a data é escolhida
- **Então** a sugerida é 15 dias depois para quem ficou de pensar e 30 para quem pediu para esperar
