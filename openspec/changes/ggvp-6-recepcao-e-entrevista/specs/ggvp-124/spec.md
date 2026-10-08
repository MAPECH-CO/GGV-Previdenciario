# Spec Delta · ggvp-124 · Nova demanda de quem já é cliente

## Purpose

O Atendimento ou a advogada abre uma nova demanda para quem já é cliente, para que o caso novo nasça na mesma ficha, sem cadastro repetido. Passo BPMN ainda não desenhado no Miro: entra como terceira saída da pergunta "O que o cliente veio fazer?" do D1. Sem tela própria no Figma: o botão "Nova demanda" entra na ficha do cliente (Cliente · dados (Atendimento) `73:199`; Cliente · dados e processos (Jurídico) `73:2`) e no balcão (step_D1.01 `10:3`); a tela segue o desenho das telas de passo. Nenhum portão direto; o "Não fechou" da demanda segue o G16.

Contrato (Zod, vai para `packages/contratos/fichas.ts`; espelho em `apps/web/src/dados/tipos.ts`):

```ts
import { BENEFICIOS } from './catalogos'

export const TipoDeDemanda = z.enum(['outro-pedido', 'tentar-de-novo', 'recurso-ou-defesa'])   // recurso e defesa não abrem demanda (CA8)
export const Demanda = z.object({
  id: z.string(),
  pretende: z.string().trim().min(1).max(500),
  beneficio: z.enum(BENEFICIOS),                                  // com "Não sei ainda": a advogada define na entrevista (D1.12)
  tipo: TipoDeDemanda.exclude(['recurso-ou-defesa']),
  abertaPor: z.enum(['atendimento', 'advogada']),                 // advogada: o Atendimento liga para o cliente (CA9)
  data: z.string(), quem: z.string(),
  situacao: z.enum(['aberta', 'fechou', 'nao-fechou']),            // aberta até o "Fechou com o escritório?" (D1.14)
  motivo: z.enum(MOTIVOS_DE_NAO_FECHAR).optional(), detalhe: z.string().max(500).optional(),
})
export const EnvioDaDemanda = Demanda.pick({ pretende: true, beneficio: true, abertaPor: true }).extend({ tipo: TipoDeDemanda })
// Ficha ganha demandas?: Demanda[].
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/fichas/:id/demandas` | `EnvioDaDemanda` | `{ ficha, demanda }` | `abrirDemanda` |
| `POST /api/fichas/:id/fechamento` (o mesmo da GGVP-60) | `EnvioDoFechamento` | `{ ficha }` | `registrarFechamento` |
| `POST /api/fichas/:id/processos` (o cliente fechou) | `{ beneficio }` | `{ ficha }` | `clienteFechou` (na junção, o `fecharContrato` do contrato) |
| parte de `GET /api/central/atendimento` | — | `Tarefa[]` | `tarefasDeNovaDemanda` |

Campos e a função de cada um:

| Campo | Funções |
|---|---|
| O que a pessoa veio fazer? (decisão) | Outro pedido, Tentar de novo depois de perder, Recurso ou defesa (`motivoParadoDaDemanda`) |
| O que a pessoa quer * | texto, até 500 (`TAMANHO_DO_PEDIDO`) |
| Benefício de interesse * | lista `BENEFICIOS` (`catalogos.ts`) |
| Quem abre a demanda * | lista: Atendimento, Advogada |

O servidor de exemplo valida de novo com as mesmas funções.

Decisões:

1. A demanda nasce na mesma ficha (`abrirDemanda`, `dados/novaDemanda.ts`): o benefício dela passa a ser o de interesse da ficha, o que o "Fechou com o escritório?" usa; o histórico registra quem abriu, o pedido e o benefício.
2. Depois de aberta, a tela leva a "Marcar a entrevista" (`/agenda/marcar/:id`, GGVP-123) e mostra a entrevista marcada; com ela feita, a tarefa "Registrar fechamento" (GGVP-60) aparece para o cliente (`precisaRegistrarFechamento`). "Sim, fechou" chama o `clienteFechou(fichaId, beneficio)`; na junção, o corpo vira o `fecharContrato` (GGVP-7), que cria o processo novo, com número novo, e o kit novo (CA3, CA4).
3. "Não fechou" da demanda pede o motivo da lista (G16), sem recontato: a demanda se encerra e o cliente segue nos outros processos, sem arquivar a ficha.
4. Os documentos pessoais que já estão na pasta (as miniaturas da ficha e o que entrou em Documentos pessoais) não são pedidos de novo: `documentosAPedir` (`regras/novaDemanda.ts`), para o checklist do benefício (GGVP-91) usar na junção. A tela mostra a lista.
5. A subpasta do processo novo leva o nome do benefício em maiúsculas e o ano, como "AUXÍLIO ACIDENTÁRIO 2026" (`nomeDaSubpasta`). A tela mostra o nome; na junção, o `fecharContrato` usa a regra.
6. Recurso e defesa seguem no mesmo processo: a tela não abre demanda e leva ao balcão, para encaminhar ao Jurídico.
7. Sem login ainda, "Quem abre a demanda" é escolhido na tela; aberta pela advogada, o Atendimento recebe "nome · Ligar para o cliente" na Central até a entrevista ser marcada. O perfil de verdade entra com a GGVP-78.
8. Na entrevista da demanda, a IA preenche só o que é do processo novo; o dado pessoal que mudou vem como sugestão na conferência da transcrição (GGVP-46, `conferirInformacoes`), e o valor antigo fica no histórico ("«antes» → «novo»").
9. A mensagem de boas-vindas vai só no primeiro processo da ficha (`mandaBoasVindas`); ela ainda não existe no portal, e a regra fica pronta para a liberação do caso.

## ADDED Requirements

### Requirement: CA1 · A nova demanda na mesma ficha
Para alguém que já é cliente e veio com outra demanda, ao escolher "Nova demanda" na ficha do cliente, o portal SHALL registrar o que a pessoa quer e o benefício de interesse, sem criar cadastro novo.

#### Scenario: CA1 · Escolher "Nova demanda"
- **Dado** alguém que já é cliente e veio com outra demanda (da mesma natureza ou de outra, como consignado ou seguro)
- **Quando** escolho "Nova demanda" na ficha do cliente
- **Então** registro o que a pessoa quer e o benefício de interesse, sem criar cadastro novo

### Requirement: CA2 · Marcar e entrevistar
Com a nova demanda registrada, ao marcar a entrevista, o portal SHALL seguir o mesmo caminho de marcar e entrevistar.

#### Scenario: CA2 · Marcar a entrevista
- **Dado** a nova demanda registrada
- **Quando** marco a entrevista
- **Então** segue o mesmo caminho de marcar e entrevistar (GGVP-123, GGVP-40)

### Requirement: CA3 · O processo novo na mesma ficha
Com a entrevista encerrada, quando a advogada define o benefício, o processo novo SHALL nascer, com número novo, na mesma ficha do cliente.

#### Scenario: CA3 · Definir o benefício
- **Dado** a entrevista encerrada
- **Quando** a advogada define o benefício
- **Então** nasce o processo novo, com número novo, na mesma ficha do cliente

### Requirement: CA4 · Kit novo para o processo novo
Para o processo novo, na hora do contrato, o portal SHALL gerar kit novo (contrato e procuração) de acordo com o processo, mesmo sendo o mesmo cliente.

#### Scenario: CA4 · A hora do contrato
- **Dado** o processo novo
- **Quando** chega a hora do contrato
- **Então** gera kit novo (contrato e procuração) de acordo com o processo

### Requirement: CA5 · Documento pessoal não é pedido de novo
Ao montar o checklist do processo novo, os documentos pessoais que já estão na pasta do cliente SHALL NOT ser pedidos de novo.

#### Scenario: CA5 · Montar o checklist
- **Dado** o processo novo
- **Quando** o checklist é montado
- **Então** os documentos pessoais que já estão na pasta do cliente não são pedidos de novo

### Requirement: CA6 · A IA preenche só o processo novo
Na entrevista da nova demanda, a IA SHALL preencher só o que é do processo novo; o dado pessoal que mudou MUST aparecer como sugestão para alguém confirmar, e o valor antigo fica no histórico.

#### Scenario: CA6 · A IA preenche
- **Dado** a entrevista da nova demanda
- **Quando** a IA preenche
- **Então** preenche só o que é do processo novo, e o dado pessoal que mudou aparece como sugestão, com o valor antigo no histórico

### Requirement: CA7 · A subpasta do processo novo
O processo novo SHALL ganhar uma subpasta própria dentro da pasta do cliente no Drive, com o nome do benefício e o ano.

#### Scenario: CA7 · O processo nasce
- **Dado** o processo novo
- **Quando** nasce
- **Então** ganha uma subpasta com o nome do benefício e o ano, como "AUXÍLIO-ACIDENTE 2026"

### Requirement: CA8 · Recurso e defesa no mesmo processo
Um recurso ou uma defesa SHALL seguir no mesmo processo; processo novo é só depois de perder ou para outro pedido.

#### Scenario: CA8 · Recurso ou defesa
- **Dado** um recurso ou uma defesa
- **Quando** acontece
- **Então** segue no mesmo processo

### Requirement: CA9 · A advogada abre, o Atendimento liga
Num caso perdido em que o escritório decide tentar de novo, quando a advogada abre a nova demanda pela ficha, o Atendimento SHALL receber a tarefa de ligar para o cliente.

#### Scenario: CA9 · A advogada abre a demanda
- **Dado** um caso perdido em que o escritório decide tentar de novo
- **Quando** a advogada abre a nova demanda pela ficha
- **Então** o Atendimento recebe a tarefa de ligar para o cliente

### Requirement: CA10 · Sem boas-vindas para quem já era cliente
No processo novo de quem já era cliente, quando o caso é liberado, o portal SHALL NOT mandar a mensagem de boas-vindas.

#### Scenario: CA10 · O caso é liberado
- **Dado** o processo novo de quem já era cliente
- **Quando** o caso é liberado
- **Então** o portal não manda a mensagem de boas-vindas
