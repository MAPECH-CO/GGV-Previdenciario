# Spec Delta · ggvp-77 · Assinatura em papel na entrevista

## Purpose

O Atendimento imprime o documento, colhe a assinatura na hora e passa no scanner, para atender o cliente que não assina pelo celular. Telas do Figma: step_D1.17 `10:176` (opção "Papel, na hora" com o anexo obrigatório da digitalização) e step_D1.18 `10:466` (a leitura, que é da GGVP-81). Passo D1.17 do Miro.

Contrato (Zod, vai para `packages/contratos/contrato.ts`; espelho em `apps/web/src/dados/contrato.ts`):

```ts
// Assinatura (GGVP-72) ganha: impressoEm (o kit impresso) e arquivo (a digitalização do assinado).
export const Assinatura = AssinaturaGgvp72.extend({ impressoEm: z.string().optional() })
export const KitImpresso = z.object({ contrato: Contrato, datas: z.array(z.object({ documento: z.string(), data: z.string() })) })
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/processos/:id/contrato/impressao` | — | `KitImpresso` | `imprimirKit` |
| `POST /api/digitalizacao/lotes` (o n8n, com o contrato assinado) | lote do scanner | `Arquivo` | `digitalizarContratoAssinado` |
| `POST /api/processos/:id/contrato/assinatura-em-papel` | — | `Contrato` | `concluirAssinaturaEmPapel` |

Decisões:

1. Papel só na entrevista presencial (CA4): `entrevistaDoCaso` (`regras/contrato.ts`) pega a entrevista mais recente que não foi remarcada; sem entrevista registrada (cliente antigo, nova demanda no balcão), é presencial. Por vídeo ou telefone, a opção não aparece na tela e o servidor recusa.
2. As datas do kit impresso saem de `datasDoKit` (GGVP-69, CA4): em branco para preencher à mão, menos o contrato de honorários.
3. A impressora e o scanner são simulados: "Imprimir o kit" registra a impressão e mostra a data de cada documento; "Digitalizar o contrato assinado (scanner simulado)" faz o papel da automação do balcão e guarda o PDF pesquisável na subpasta do processo, marcado "aguarda a leitura" (GGVP-81).
4. "Concluir a assinatura" só habilita com a digitalização anexada; concluída, o caso vai para a leitura, como no retorno do ZapSign.
5. Escolhido o papel e impresso o kit, não se troca para o ZapSign; antes de imprimir, dá para trocar.

## ADDED Requirements

### Requirement: CA1 · O kit impresso com as datas em branco
Com "Papel" escolhido, ao imprimir, o documento SHALL sair com as datas em branco para preencher à mão, menos o contrato de honorários.

#### Scenario: CA1 · Imprimir
- **Dado** "Papel" escolhido
- **Quando** imprimo
- **Então** o documento sai com as datas em branco, menos o contrato de honorários

### Requirement: CA2 · A digitalização vai para a pasta e aparece no card
Com o documento assinado passado no scanner, a automação do balcão SHALL guardar o PDF pesquisável na pasta do cliente no Drive, e o arquivo MUST aparecer no card do cliente.

#### Scenario: CA2 · Passar no scanner
- **Dado** o documento assinado
- **Quando** passa no scanner
- **Então** o PDF pesquisável fica na pasta do cliente e aparece no card

### Requirement: CA3 · Só conclui com a digitalização anexada
Com "Papel, na hora" escolhido, a tarefa de assinatura SHALL ser concluída só com a digitalização do contrato assinado anexada.

#### Scenario: CA3 · Concluir a tarefa
- **Dado** "Papel, na hora" escolhido
- **Quando** tento concluir a tarefa de assinatura
- **Então** ela só é concluída com a digitalização anexada

### Requirement: CA4 · Papel só na entrevista presencial
Na entrevista por vídeo ou por telefone, a opção "Papel, na hora" MUST NOT aparecer, e a assinatura SHALL ir pelo ZapSign.

#### Scenario: CA4 · Entrevista por vídeo ou telefone
- **Dado** uma entrevista por vídeo ou por telefone
- **Quando** chega a hora de assinar
- **Então** a opção "Papel, na hora" não aparece e a assinatura vai pelo ZapSign
