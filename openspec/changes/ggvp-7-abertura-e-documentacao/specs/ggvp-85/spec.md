# Spec Delta · ggvp-85 · Verificar o contrato assinado

## Purpose

O Atendimento recebe uma tarefa só quando a IA não reconheceu o contrato assinado ou apontou problema, para conferir à mão só o que precisa. Telas do Figma: step_D1.19 `10:202` ("A IA sugere · você confere", assinatura e páginas, decisão "Está tudo certo?", campo "O que corrigir") e a Central de trabalho · Atendimento `11:2` (item D1.19 "a IA apontou 1 pendência"). Passo D1.19 do Miro.

Contrato (Zod, vai para `packages/contratos/contrato.ts`; espelho em `apps/web/src/regras/contrato.ts` e `apps/web/src/dados/contrato.ts`):

```ts
export const LeituraDoContrato = z.object({         // o que a leitura da IA devolve (GGVP-81)
  reconhecido: z.boolean(),
  assinatura: z.object({ reconhecida: z.boolean(), texto: z.string() }),
  faltam: z.array(z.string()),                      // "pág. 4 (rubrica)" (CA4)
  pendencias: z.array(z.string()),                  // "a página da assinatura veio cortada" (CA2)
})
export const Verificacao = z.discriminatedUnion('tudoCerto', [
  z.object({ tudoCerto: z.literal(true) }),
  z.object({ tudoCerto: z.literal(false), oQueCorrigir: z.string().trim().min(3).max(500),
    paginaCorrigida: z.object({ nome: z.string(), tamanho: z.number().int().positive().max(TAMANHO_MAXIMO) }).optional() }),   // CA5
])
// Contrato ganha as etapas 'conferir' e 'copia', a leitura, a verificação e as versões anteriores (CA6).
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/processos/:id/contrato/leitura` (chamado pela leitura da GGVP-81) | `LeituraDoContrato` | `Contrato` | `concluirLeituraDoContrato` |
| `POST /api/processos/:id/contrato/verificacao` | `Verificacao` | `Contrato` | `verificarContrato` |
| `POST /api/processos/:id/contrato/aviso` | `{ mensagem }` | — (fica em "Últimos contatos") | `avisarClienteDaConferencia` |

Decisões:

1. A leitura é da GGVP-81 (grupo documentos). Ela chama `concluirLeituraDoContrato`; até a junção, o botão "Simular a leitura da IA (D1.18)", no fim da tela de colher a assinatura, usa a leitura de exemplo: o papel na primeira versão vem com a página da assinatura cortada e a pág. 4 sem rubrica (o exemplo do Figma); o resto a IA reconhece.
2. `precisaConferir` e `resumoDaLeitura` (`regras/contrato.ts`) decidem: a IA não entendeu, não reconheceu a assinatura, faltou página ou apontou pendência, o Atendimento recebe "nome · Conferir contrato"; senão, nenhuma tarefa e o caso vai para a cópia (GGVP-89).
3. "Não, corrigir e reenviar": o que corrigir é obrigatório; a página corrigida pode ir anexa e passa pelas regras de arquivo (PDF, JPG ou PNG, até 20 MB). A versão assinada fica em `anteriores` e o arquivo dela não sai da pasta (CA6). O contrato volta a "Preparar contrato" com o motivo, para corrigir os campos e gerar a versão nova, que vai para o cliente assinar (CA3), com outro documento no ZapSign.
4. "Contato do cliente": "Ligar" mostra o número (ligação simulada) e "WhatsApp" abre o Chatwoot simulado com o aviso da pendência, que fica em "Últimos contatos".
5. "Ver contrato na íntegra" mostra o arquivo assinado e o texto gerado de cada documento do kit.

## ADDED Requirements

### Requirement: CA1 · Reconhecido e certo, nenhuma tarefa
Com o contrato assinado que a IA reconheceu e está tudo certo, ao terminar a leitura, nenhuma tarefa SHALL ser criada e o caso MUST seguir.

#### Scenario: CA1 · A leitura termina sem problema
- **Dado** um contrato assinado que a IA reconheceu e está tudo certo
- **Quando** a leitura termina
- **Então** nenhuma tarefa é criada e o caso segue

### Requirement: CA2 · Problema na leitura vira tarefa
Com um contrato que a IA não entendeu ou em que apontou problema, ao terminar a leitura, o Atendimento SHALL receber a tarefa com o que a IA apontou.

#### Scenario: CA2 · A IA aponta problema
- **Dado** um contrato que a IA não entendeu ou em que apontou problema
- **Quando** a leitura termina
- **Então** recebo a tarefa com o que a IA apontou

### Requirement: CA3 · Corrigir reenvia para assinatura
Confirmado o problema, com os campos corrigidos, o documento SHALL ser reenviado para assinatura.

#### Scenario: CA3 · Corrigir os campos
- **Dado** que confirmo o problema
- **Quando** corrijo os campos
- **Então** o documento é reenviado para assinatura

### Requirement: CA4 · Assinatura e páginas na tarefa
Na leitura do contrato assinado, a tarefa SHALL mostrar se a assinatura foi reconhecida e se todas as páginas estão presentes, apontando as páginas e as assinaturas que faltam.

#### Scenario: CA4 · A IA termina a leitura
- **Dado** a leitura do contrato assinado
- **Quando** a IA termina
- **Então** a tarefa mostra a assinatura e as páginas, com o que falta

### Requirement: CA5 · A decisão "Está tudo certo?"
Na verificação, "Não, corrigir e reenviar" SHALL exigir o que corrigir (a página corrigida pode ir anexa), e "Está certo, seguir" MUST habilitar só com a decisão respondida.

#### Scenario: CA5 · Responder a decisão
- **Dado** a verificação
- **Quando** respondo "Está tudo certo?"
- **Então** "Não" exige o que corrigir e "Está certo, seguir" só habilita com a decisão

### Requirement: CA6 · A versão anterior fica no histórico
Com "Não, corrigir e reenviar", ao corrigir os campos, a versão anterior do contrato SHALL ficar no histórico.

#### Scenario: CA6 · Corrigir
- **Dado** "Não, corrigir e reenviar"
- **Quando** corrijo os campos
- **Então** a versão anterior do contrato fica no histórico

### Requirement: CA7 · Sem problema, vai para a cópia
Com a verificação concluída sem problema, o caso SHALL ir para a cópia do contrato (D1.20, GGVP-89).

#### Scenario: CA7 · Seguir
- **Dado** a verificação concluída sem problema
- **Quando** sigo
- **Então** o caso vai para a cópia do contrato
