# Spec Delta · ggvp-65 · Kit de documentos por benefício

## Purpose

Quando o cliente fecha, o portal monta o kit certo do benefício (contrato, procuração, hipossuficiência, residência, termo do INSS, Código Penal) para o Atendimento nunca mandar assinar o kit errado. Passo D1.15 do Miro, sem tela própria: o kit aparece na tela de preparar o contrato, step_D1.16 `10:143`, e a tarefa "nome · Preparar contrato" na Central do Atendimento `11:2`.

Contrato (Zod, vai para `packages/contratos/contrato.ts`; espelho em `apps/web/src/regras/contrato.ts` e `apps/web/src/dados/contrato.ts`):

```ts
export const DocumentoDoKit = z.enum(['contrato', 'procuracao', 'hipossuficiencia', 'residencia', 'termo-inss', 'codigo-penal',
  'grupo-familiar', 'declaracao-moradia', 'declaracao-uniao-estavel', 'declaracao-separacao'])
export const IdDoModelo = z.enum(['contrato-completo-2026', 'modelo-6', 'modelo-7', 'modelo-8', 'modelo-10'])
export const CondicoesDoKit = z.object({            // só mudam o kit do LOAS (CA2, CA8)
  representado: z.boolean(), moradia: z.boolean(), uniaoEstavel: z.boolean(), separacaoDeFato: z.boolean(),
})
export const KitMontado = z.object({
  linha: z.string(), nome: z.string(), modelo: IdDoModelo,
  documentos: z.array(z.object({ id: DocumentoDoKit, nome: z.string(), detalhe: z.string().optional(), condicional: z.boolean().optional() })),
  assinam: z.array(z.string()), acaoContra: z.string().optional(),
})
export const Contrato = z.object({                  // um por processo (CA9)
  processoId: z.string(), fichaId: z.string(), etapa: z.enum(['preparar']),
  condicoes: CondicoesDoKit, kit: KitMontado.nullable(), abertoEm: z.string(),
})
export const FecharContrato = z.object({ beneficio: z.enum(BENEFICIOS_SEM_NAO_SEI) })   // catálogo único (CA6)
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/fichas/:id/processos` (o cliente fechou) | `FecharContrato` | `{ ficha, processo, contrato }` | `fecharContrato` |
| `GET /api/processos/:id/contrato` | `id` | `{ ficha, processo, contrato }` | `obterContrato` |
| `PUT /api/processos/:id/contrato/condicoes` | `CondicoesDoKit` | `Contrato` | `salvarCondicoes` |
| parte de `GET /api/central/atendimento` | — | `Tarefa[]` | `tarefasDoContrato` |

Decisões:

1. A tabela do cartão vira `KITS` em `regras/contrato.ts`, com os ids do catálogo `BENEFICIOS`. Aposentadorias: Especial, por Contribuição, por Idade, Rural, PCD por Contribuição e PCD por Idade. Auxílio incapacidade: Incapacidade Temporária, Incapacidade Permanente e Incapacidade Permanente Acidentária (o termo de incapacidade temporária e permanente cobre a permanente). Empréstimo fraudulento é o "Empréstimo Indevido" do catálogo. Benefício fora da tabela (Pensão por Morte, as revisões...) fecha sem kit e a tela avisa: nada é gerado. Levar ao Lucas.
2. O kit fica guardado no contrato do processo: cada processo tem o seu (CA9), mesmo cliente e mesmos documentos.
3. LOAS: a ficha de grupo familiar vai sempre; as declarações entram por quatro perguntas na tela ("Condições do caso"), que montam o kit de novo. As perguntas seguem a tabela do Lucas (GGVP-104) quando ela vier escrita. O representado só vale no LOAS.
4. "O cliente fecha" é `fecharContrato`: o lead vira cliente, nasce o processo em "Contrato · preparar" e a tarefa. Quem chama é a definição do benefício na entrevista e a nova demanda (GGVP-124), que ainda não existem; a semente traz a Cleide com a Aposentadoria PCD para preparar.
5. A tarefa nasce do contrato (`tarefasDoContrato`); a linha fixa "Cleide · Conferir contrato" sai de `atendimento.ts`.

## ADDED Requirements

### Requirement: CA1 · O kit do benefício escolhido
Com o benefício escolhido, quando o cliente fecha, o portal SHALL mostrar o kit daquele benefício, conforme a tabela "Kits por benefício".

#### Scenario: CA1 · O cliente fecha
- **Dado** um benefício escolhido
- **Quando** o cliente fecha
- **Então** o portal mostra o kit daquele benefício, conforme a tabela

### Requirement: CA2 · LOAS representado por genitor(a)
No LOAS representado por genitor(a), o kit SHALL levar os dados e a assinatura do representado e da genitora.

#### Scenario: CA2 · Montar o kit do LOAS representado
- **Dado** LOAS representado por genitor(a)
- **Quando** o kit é montado
- **Então** leva os dados e a assinatura do representado e da genitora

### Requirement: CA3 · As exceções da tabela
Em Curatela, Isenção de IR, Empréstimo fraudulento e Seguro de vida, o kit SHALL respeitar as exceções da tabela (Curatela sem Termo INSS, Isenção de IR sem hipossuficiência).

#### Scenario: CA3 · Montar o kit de uma exceção
- **Dado** Curatela, Isenção de IR, Empréstimo fraudulento ou Seguro de vida
- **Quando** o kit é montado
- **Então** as exceções da tabela são respeitadas

### Requirement: CA4 · Exatamente os documentos da tabela
Para cada um dos 9 benefícios da tabela, o kit gerado SHALL conter exatamente os documentos da tabela, nem mais nem menos, com um teste por benefício.

#### Scenario: CA4 · Gerar o kit de cada benefício
- **Dado** cada um dos 9 benefícios da tabela
- **Quando** o kit é gerado
- **Então** ele contém exatamente os documentos da tabela, nem mais nem menos

### Requirement: CA5 · O modelo da coluna "Modelo"
O kit gerado SHALL usar o modelo indicado na coluna "Modelo": Contrato Completo 2026 ou os modelos 6, 7, 8 e 10.

#### Scenario: CA5 · Gerar o kit
- **Dado** um benefício
- **Quando** o kit é gerado
- **Então** o modelo usado é o arquivo da coluna "Modelo"

### Requirement: CA6 · O mesmo catálogo de benefícios
A escolha do kit SHALL usar o mesmo catálogo de benefícios da ficha, da definição do benefício, do checklist e das Centrais.

#### Scenario: CA6 · Escolher o kit
- **Dado** o catálogo de benefícios
- **Quando** o kit é escolhido
- **Então** ele usa o mesmo catálogo da ficha, da definição do benefício, do checklist e das Centrais

### Requirement: CA8 · Ficha de grupo familiar e declarações do LOAS
O kit de LOAS (idoso, deficiente, representado ou mandado de segurança de LOAS) SHALL incluir a ficha de grupo familiar, e as declarações de moradia, união estável e separação de fato MUST entrar quando a condição do caso pede.

#### Scenario: CA8 · Montar o kit do LOAS
- **Dado** um kit de LOAS
- **Quando** é montado
- **Então** inclui a ficha de grupo familiar, e as declarações entram quando a condição do caso pede

### Requirement: CA9 · Processo novo de quem já é cliente
No processo novo de quem já é cliente, ao fechar o contrato o portal SHALL gerar um kit novo (contrato e procuração) de acordo com o processo, mesmo sendo o mesmo cliente com os mesmos documentos.

#### Scenario: CA9 · Fechar outro benefício
- **Dado** um processo novo de quem já é cliente
- **Quando** o contrato é fechado
- **Então** o portal gera um kit novo de acordo com o processo

## Travas

- CA7 é "(proposta)": a versão do kit, com os casos em andamento mantendo a sua e a opção de atualizar. Não vira código até o Lucas aceitar; a manutenção dos kits é da GGVP-104.
