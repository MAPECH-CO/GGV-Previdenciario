# Spec Delta · ggvp-69 · Preencher o contrato pelo modelo e conferir

## Purpose

A IA preenche o modelo com os dados do cliente e do processo e o Atendimento confere antes de mandar assinar, para não haver campo errado no documento que o cliente assina. Tela do Figma: step_D1.16 `10:143` ("Os documentos foram aprovados?", as quatro conferências, os honorários e a trava de "Gerar contrato"). Passo D1.16 do Miro.

Contrato (Zod, vai para `packages/contratos/contrato.ts`; espelho em `apps/web/src/regras/contrato.ts` e `apps/web/src/dados/contrato.ts`):

```ts
import { normalizarCpf, validarCpf, normalizarNome, validarNome, normalizarTelefone, validarTelefone } from '@ggv/campos'

export const CampoDoModelo = z.enum(['nome', 'estadoCivil', 'profissao', 'cpf', 'rg', 'endereco', 'telefone', 'beneficio',
  'parteContraria', 'representanteNome', 'representanteCpf', 'representanteRg', 'representanteParentesco'])
export const Origem = z.enum(['cadastro', 'ficha', 'documento', 'caso', 'corrigido'])        // CA5
export const CampoPreenchido = z.object({ campo: CampoDoModelo, rotulo: z.string(), valor: z.string(), origem: Origem, obrigatorio: z.boolean() })

const rg = z.string().trim().regex(/^[0-9A-Za-z.\-/ ]{5,20}$/)
export const Correcoes = z.object({                  // CA3: o que a pessoa corrige na tela
  nome: z.string().transform(normalizarNome).refine(validarNome), cpf: z.string().transform(normalizarCpf).refine(validarCpf),
  telefone: z.string().transform(normalizarTelefone).refine(validarTelefone),
  estadoCivil: z.string().trim().max(40), profissao: z.string().trim().max(200), endereco: z.string().trim().max(200),
  rg, parteContraria: z.string().trim().max(120),
  representanteNome: z.string().transform(normalizarNome).refine(validarNome), representanteCpf: z.string().transform(normalizarCpf).refine(validarCpf),
  representanteRg: rg, representanteParentesco: z.enum(['genitora', 'genitor']),
}).partial()

export const GerarContrato = z.object({             // CA6, CA7
  aprovados: z.boolean(),                            // "Os documentos foram aprovados?"
  oQueCorrigir: z.string().trim().min(3).max(500).optional(),   // obrigatório quando aprovados = false
  conferencias: z.object({ campos: z.literal(true), datas: z.literal(true), fichaLoas: z.literal(true), codigoPenal: z.literal(true) }),
  correcoes: Correcoes.default({}),
})
export const RespostaGerar = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('gerado'), contrato: Contrato }),                     // vai para "Colher assinatura"
  z.object({ resultado: z.literal('faltam'), campos: z.array(CampoDoModelo) }),           // CA7
  z.object({ resultado: z.literal('cpf-de-outra-ficha'), nome: z.string() }),
  z.object({ resultado: z.literal('sobrou-do-exemplo'), restos: z.array(z.string()) }),   // CA8
])
// Contrato (GGVP-65) ganha: etapa 'assinatura', dados (rg, parteContraria, representante), corrigidos, documento { versao, geradoEm, campos }, versoes.
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/processos/:id/contrato/gerar` | `GerarContrato` | `RespostaGerar` | `gerarContrato` |

Campos e a função de `campos` de cada um:

| Campo | Funções |
|---|---|
| Nome completo, Nome do representante | `normalizarNome`, `validarNome` |
| CPF, CPF do representante | `normalizarCpf`, `validarCpf`, `formatarCpf`; CPF de outra ficha não grava |
| Telefone / WhatsApp | `normalizarTelefone`, `validarTelefone`, `formatarTelefone` |
| RG, RG do representante | `regras/contrato.ts` (`erroRg`): letras, números e pontuação, de 5 a 20; a biblioteca `campos` não tem RG |
| Estado civil, Profissão, Endereço, Parte contrária | texto, obrigatório e com tamanho |
| Parentesco do representante | escolha: genitora ou genitor |
| O que corrigir | texto, obrigatório com "Não, corrigir campos" |

O servidor de exemplo valida de novo com as mesmas funções.

Decisões:

1. Os campos do modelo saem de `camposDoModelo` (`regras/contrato.ts`): da ficha do cliente ("cadastro"), da ficha de atendimento ("ficha", quando ela foi preenchida no portal), da pasta ("documento", o CPF que já está na pasta), do processo ("caso") e o que a pessoa corrigiu aqui ("corrigido").
2. Corrigir é responder "Não, corrigir campos": os campos viram caixas, o "O que corrigir" fica obrigatório, e "Gerar contrato" grava a correção (na ficha, para os dados pessoais; no contrato, para RG, parte contrária e representante), registra no histórico e gera o documento de novo, numa versão nova.
3. O RG e o representante não existem na ficha: ficam no contrato do processo. A parte contrária é o INSS nos kits do INSS; no empréstimo e no seguro, a pessoa escreve o banco ou a seguradora; na curatela não há.
4. As datas (CA4) são regra em `datasDoKit`: no papel, em branco para preencher à mão, menos o contrato de honorários, que sai com a data; no ZapSign, a data da assinatura. A tela mostra a regra; o papel é da GGVP-77.
5. Os modelos convertidos são simulados: um texto curto por documento, com os campos `{{...}}`. `restosDoModelo` (CA8) procura campo `{{...}}` que sobrou e o nome do cliente de exemplo do modelo.
6. A linha fixa de honorários vem do modelo (CA11): "20% do êxito (ad exitum)" no Contrato Completo 2026; os modelos 6, 7, 8 e 10 dizem "os do modelo n" até a GGVP-104 trazer o texto.

## ADDED Requirements

### Requirement: CA1 · O modelo vem preenchido
Com o kit escolhido, o preenchimento SHALL trazer nome, estado civil, profissão, CPF, RG, endereço, telefone, benefício e parte contrária, e os dados do representante quando houver.

#### Scenario: CA1 · Pedir o preenchimento
- **Dado** o kit escolhido
- **Quando** peço o preenchimento
- **Então** o modelo vem com nome, estado civil, profissão, CPF, RG, endereço, telefone, benefício e parte contrária, e os dados do representante quando houver

### Requirement: CA2 · A lista "O que conferir"
Com o documento preenchido, a conferência SHALL mostrar a lista "O que conferir": datas feitas à mão, na ficha LOAS se é cliente ou representante legal, página do Código Penal sem assinatura.

#### Scenario: CA2 · Conferir o documento
- **Dado** o documento preenchido
- **Quando** confiro
- **Então** vejo a lista "O que conferir"

### Requirement: CA3 · Corrigir regera o documento
Com um campo errado corrigido, o documento SHALL ser gerado de novo antes de seguir.

#### Scenario: CA3 · Corrigir um campo
- **Dado** um campo errado
- **Quando** corrijo
- **Então** o documento é regerado antes de seguir

### Requirement: CA4 · As datas do documento
No papel, as datas SHALL sair em branco para preencher à mão na assinatura, menos no contrato de honorários; no ZapSign MUST valer a data da assinatura.

#### Scenario: CA4 · Gerar o documento
- **Dado** as datas do documento
- **Quando** ele é gerado
- **Então** no papel as datas saem em branco, menos no contrato de honorários; no ZapSign vale a data da assinatura

### Requirement: CA5 · De onde veio cada campo
Na conferência, cada campo SHALL mostrar de onde veio (cadastro, ficha ou documento).

#### Scenario: CA5 · Conferir os campos
- **Dado** o documento preenchido
- **Quando** confiro
- **Então** cada campo mostra de onde veio

### Requirement: CA6 · A trava de "Gerar contrato"
"Gerar contrato" SHALL habilitar só com "Os documentos foram aprovados?" respondida, o "O que corrigir" preenchido quando a resposta é "Não, corrigir campos", e as quatro conferências marcadas: campos certos e completos, datas à mão, ficha LOAS, página do Código Penal sem assinatura.

#### Scenario: CA6 · Ir gerar o contrato
- **Dado** a conferência
- **Quando** vou gerar o contrato
- **Então** "Gerar contrato" só habilita com a decisão, o "O que corrigir" quando é "Não" e as quatro conferências

### Requirement: CA7 · Campo obrigatório vazio não vai para assinatura
Com um campo obrigatório vazio, o contrato MUST NOT seguir para assinatura, e a correção feita SHALL ficar registrada.

#### Scenario: CA7 · Mandar com campo vazio
- **Dado** um campo obrigatório vazio
- **Quando** tento mandar para assinatura
- **Então** não consigo, e a correção feita fica registrada

### Requirement: CA8 · Nada sobra do cliente de exemplo
Com um kit gerado para um cliente de teste, a verificação automática do texto SHALL achar nenhum dado do cliente de exemplo dos Contratos Completos.

#### Scenario: CA8 · Verificar o texto
- **Dado** um kit gerado com um cliente de teste
- **Quando** o texto é verificado de forma automática
- **Então** não sobra nenhum dado do cliente de exemplo

### Requirement: CA9 · Sem representante, sem campos de representante
Para o cliente sem representante, os campos de representante MUST NOT aparecer.

#### Scenario: CA9 · Preencher sem representante
- **Dado** um cliente sem representante
- **Quando** o modelo é preenchido
- **Então** os campos de representante não aparecem

### Requirement: CA10 · Modelos versionados com o mesmo identificador
Os modelos convertidos SHALL ficar versionados na pasta "MODELOS ZAPSIGN · PREV" e no ZapSign com o mesmo identificador.

#### Scenario: CA10 · Publicar os modelos
- **Dado** os modelos convertidos
- **Quando** são publicados
- **Então** ficam versionados na pasta e no ZapSign com o mesmo identificador

### Requirement: CA11 · Os honorários vêm do modelo
Os honorários do contrato SHALL vir do modelo convertido do escritório, sem campo para digitar, e a conferência MUST mostrar o que o modelo traz.

#### Scenario: CA11 · Conferir os honorários
- **Dado** o contrato de honorários do kit
- **Quando** o documento é conferido
- **Então** os honorários vêm do modelo, sem campo para digitar, e a conferência mostra o que o modelo traz
