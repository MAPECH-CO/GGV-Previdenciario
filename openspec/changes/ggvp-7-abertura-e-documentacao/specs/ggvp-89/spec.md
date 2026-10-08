# Spec Delta · ggvp-89 · Cópia do contrato para o cliente levar

## Purpose

O Atendimento imprime a cópia do contrato assinado numa pastinha, para o cliente sair com a cópia na mão. Telas do Figma: step_D1.20 · Entregar cópia do contrato `2106:69` (campos obrigatórios e trava de "Registrar entrega"), Agenda · Semana · Atendimento `1941:2` e o evento "Entregar cópia do contrato" `2164:466`. Passo D1.20 do Miro.

Contrato (Zod, vai para `packages/contratos/contrato.ts`; espelho em `apps/web/src/regras/contrato.ts` e `apps/web/src/dados/contrato.ts`):

```ts
import { normalizarData, dataParaIso, normalizarNome, validarNome } from '@ggv/campos'

export const EntregaDaCopia = z.object({            // CA3
  copiaDaVersaoAssinada: z.literal(true),
  entregueEm: z.string().transform((v) => dataParaIso(normalizarData(v))).refine((iso) => iso !== null && iso <= hojeIso()),
  quemRecebeu: z.string().transform(normalizarNome).refine(validarNome),
  observacao: z.string().trim().max(300).optional(),
})
export const VisitaDaCopia = z.object({             // CA4
  data: z.string().transform((v) => dataParaIso(normalizarData(v))).refine((iso) => iso !== null && iso >= hojeIso()),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})
// Contrato ganha a etapa 'entregue' e copia { impressaEm, visitaId, entrega }.
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/processos/:id/contrato/copia/impressao` | — | `Contrato` | `imprimirCopia` |
| `POST /api/processos/:id/contrato/copia/visita` | `VisitaDaCopia` | `Agendamento` | `marcarVisitaDaCopia` |
| `POST /api/processos/:id/contrato/copia/entrega` | `EntregaDaCopia` | `Contrato` | `registrarEntregaDaCopia` |

Campos e a função de `campos` de cada um:

| Campo | Funções |
|---|---|
| Entregue em (data) * | `normalizarData`, `dataParaIso` e "não futura" (`erroData`); começa com a data de hoje |
| Quem recebeu * | `normalizarNome`, `validarNome` |
| Observação | texto, até 300 |
| Data da visita * | `normalizarData`, `dataParaIso` e "de hoje em diante" (`erroDataDoCompromisso`) |
| Hora * | `<input type="time">` do navegador; a biblioteca `campos` não tem hora |
| É a cópia impressa da versão assinada * | caixa de marcar |

O servidor de exemplo valida de novo com as mesmas funções.

Decisões:

1. A tarefa "nome · Entregar cópia do contrato" nasce quando o contrato fica na etapa "copia": a IA reconheceu sem pendência (GGVP-85, CA1) ou o Atendimento conferiu e seguiu (GGVP-85, CA7). A linha fixa "Cleide · Entregar a cópia do contrato" sai de `atendimento.ts`; a semente traz a Cleide com a Aposentadoria Especial assinada em 12/07 e a retirada de hoje às 16:00, que já estava na agenda.
2. "Imprimir cópia para o cliente" fica na tela do passo; a página do processo (GGVP-86) ainda não existe e mostra o mesmo botão quando chegar. A impressora é simulada.
3. "Entregar depois, numa visita" marca o compromisso "Entregar cópia do contrato" na ficha, presencial, de 30 minutos; a agenda mostra com o passo D1.20 (linha acrescentada no mapa de passos de `dados/agenda.ts`). A visita que já estava marcada fica remarcada.
4. Registrada a entrega, a visita em aberto vira realizada, a entrega fica em "Últimos contatos" e o processo passa a "Documentação · checklist do benefício": a conferência do checklist é da GGVP-91 (grupo documentos), que lê a etapa "entregue" do contrato.

## ADDED Requirements

### Requirement: CA1 · "Imprimir cópia para o cliente"
Com o contrato verificado, ao abrir o caso, o Atendimento SHALL ver o botão "Imprimir cópia para o cliente".

#### Scenario: CA1 · Abrir o caso
- **Dado** o contrato verificado
- **Quando** abro o caso
- **Então** vejo o botão "Imprimir cópia para o cliente"

### Requirement: CA2 · A tarefa "Entregar cópia do contrato"
Com o contrato reconhecido sem pendência, pela IA ou na verificação do Atendimento (D1.19), ao terminar a leitura ou a verificação, SHALL ser criada a tarefa "Entregar cópia do contrato".

#### Scenario: CA2 · A leitura ou a verificação termina
- **Dado** o contrato reconhecido sem pendência
- **Quando** a leitura ou a verificação termina
- **Então** é criada a tarefa "Entregar cópia do contrato"

### Requirement: CA3 · A trava de "Registrar entrega"
"Registrar entrega" SHALL habilitar só com a confirmação de que é a cópia impressa da versão assinada, a data da entrega e quem recebeu; a observação é opcional.

#### Scenario: CA3 · Registrar a entrega
- **Dado** a cópia impressa
- **Quando** registro a entrega
- **Então** "Registrar entrega" só habilita com a confirmação, a data e quem recebeu

### Requirement: CA4 · A entrega numa visita entra na agenda
Com a entrega marcada para uma visita depois da assinatura, o compromisso "Entregar cópia do contrato" SHALL entrar na Agenda com a data da visita.

#### Scenario: CA4 · Marcar a visita
- **Dado** que a entrega fica para uma visita depois da assinatura
- **Quando** a marco
- **Então** o compromisso entra na Agenda com a data da visita

### Requirement: CA5 · Depois da entrega, o checklist
Com a entrega registrada, o caso SHALL seguir para a conferência do checklist do benefício (D1.21, GGVP-91).

#### Scenario: CA5 · A etapa termina
- **Dado** a entrega registrada
- **Quando** a etapa termina
- **Então** o caso segue para a conferência do checklist do benefício
