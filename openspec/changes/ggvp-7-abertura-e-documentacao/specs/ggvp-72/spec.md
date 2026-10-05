# Spec Delta · ggvp-72 · Assinatura digital pelo ZapSign

## Purpose

O Atendimento gera o documento no ZapSign e recebe a tarefa com o link para acompanhar a assinatura, para o cliente assinar pelo celular e o documento voltar sozinho para o card. Telas do Figma: step_D1.17 `10:176` ("Como a cliente vai assinar?", o pendente "Documento assinado devolvido pelo ZapSign", a tentativa e o limite do G15) e a Central de trabalho · Atendimento `11:2` (item D1.17 "ZapSign enviado"). Passo D1.17 do Miro. A integração real com o ZapSign ficou fora da entrega de 09/10: o envio e o retorno são simulados na tela.

Contrato (Zod, vai para `packages/contratos/contrato.ts`; espelho em `apps/web/src/dados/contrato.ts`):

```ts
export const CanalDaTentativa = z.enum(['whatsapp', 'ligacao'])
export const TentativaDeAssinatura = z.object({ data: z.string(), quando: z.string(), canal: CanalDaTentativa, quem: z.string() })
export const Assinatura = z.object({
  forma: z.enum(['digital', 'papel']),
  zapsign: z.object({                                   // um documento por kit; o identificador fica no caso (CA4)
    documentoId: z.string(), link: z.string().url(), status: z.enum(['enviado', 'assinado']), criadoEm: z.string(),
    eventos: z.array(z.string()),                       // eventos já recebidos: o repetido não anexa de novo (CA7)
  }).optional(),
  tentativas: z.array(TentativaDeAssinatura),           // CA5
  naSenior: z.boolean().optional(),                     // G15 (CA11)
  erro: z.string().optional(),                          // CA9
  assinadoEm: z.string().optional(), arquivo: z.string().optional(),
})
export const RegistroDaTentativa = z.object({ canal: CanalDaTentativa, mensagem: z.string().trim().min(1).max(1000).optional() })
export const RetornoDoZapSign = z.object({ documentoId: z.string(), eventoId: z.string(), status: z.literal('assinado') })   // + assinatura do webhook
// Contrato ganha a etapa 'leitura': o assinado espera a leitura da Documentação (GGVP-81).
```

| Endpoint (quando ligar no servidor) | Entrada | Saída | Função de exemplo |
|---|---|---|---|
| `POST /api/processos/:id/contrato/zapsign` | — | `{ contrato, mensagem }` ou `{ erro }` | `enviarParaAssinatura` |
| `POST /api/processos/:id/contrato/tentativas` | `RegistroDaTentativa` | `Contrato` | `registrarTentativaDeAssinatura` |
| `POST /api/integracoes/zapsign/retorno` (webhook do ZapSign) | `RetornoDoZapSign`, autenticado | `{ arquivo }` ou `{ repetido }` | `receberRetornoDoZapSign` |

Decisões:

1. A regra das tentativas mora em `regras/contrato.ts`: `TENTATIVAS_DE_ASSINATURA = 2` e `DIAS_ENTRE_TENTATIVAS_DE_ASSINATURA = 3` (Lucas e Pedro, 05/10). A primeira tentativa é o link enviado pelo WhatsApp; a próxima, 3 dias depois, pelo WhatsApp (com o mesmo link) ou por ligação. Com a segunda sem assinatura, o limite foi atingido: o caso sobe para a advogada sênior na hora, como na confirmação da entrevista (GGVP-21), e sai da Central do Atendimento.
2. O ZapSign é simulado em `dados/contrato.ts`: o documento ganha o identificador `zapsign-exemplo-<processo>` e um link obviamente falso. "Simular o retorno do ZapSign (assinado)" faz o papel do webhook, com o segredo do exemplo; sem o segredo, o retorno é recusado.
3. A mensagem com o link abre no Chatwoot simulado (a mesma janela do convite), para conferir e enviar; ela fica em "Últimos contatos".
4. O assinado entra na subpasta do processo, como contrato, marcado "aguarda a leitura" (GGVP-81), e o caso passa à etapa "leitura". A tarefa da assinatura sai da Central, e a da sênior também se encerra.
5. A linha fixa "Nair · Colher assinatura" sai de `atendimento.ts`: a tarefa nasce do contrato. A sênior recebe a tarefa no setor Jurídico, que a Central da Advogada já mostra.
6. "Em papel na hora" fica com o visual do Figma e indisponível: é da GGVP-77.

## ADDED Requirements

### Requirement: CA1 · O ZapSign monta o documento e a tarefa traz o link
Com o documento conferido e "Digital" escolhido, ao enviar, o ZapSign SHALL montar o documento pelo modelo e o Atendimento MUST receber a tarefa com o link.

#### Scenario: CA1 · Enviar pelo ZapSign
- **Dado** o documento conferido e "Digital" escolhido
- **Quando** envio
- **Então** o ZapSign monta o documento pelo modelo e eu recebo a tarefa com o link

### Requirement: CA2 · O lembrete de tentar de novo
Com o cliente sem assinar, passado o intervalo, a tarefa SHALL lembrar de tentar contato de novo.

#### Scenario: CA2 · O intervalo passa
- **Dado** o cliente sem assinar
- **Quando** o intervalo passa
- **Então** a tarefa me lembra de tentar contato de novo

### Requirement: CA3 · O assinado volta para o card
Com o documento assinado devolvido pelo ZapSign, ele SHALL ser anexado no card e seguir para a leitura.

#### Scenario: CA3 · O ZapSign devolve
- **Dado** o documento assinado
- **Quando** o ZapSign devolve
- **Então** ele é anexado no card e segue para a leitura

### Requirement: CA4 · Um documento por kit, com o status da integração
No envio digital, SHALL existir um documento no ZapSign por kit, o identificador do ZapSign MUST ficar guardado no caso e a tarefa SHALL mostrar o status que a integração informa.

#### Scenario: CA4 · Gerar o documento
- **Dado** o envio digital
- **Quando** o documento é gerado
- **Então** existe um documento por kit, o identificador fica no caso e a tarefa mostra o status

### Requirement: CA5 · Nova tentativa sem documento duplicado
Ao registrar uma nova tentativa de contato, SHALL ficar a data e o canal, e reenviar o link MUST NOT criar documento duplicado.

#### Scenario: CA5 · Registrar a tentativa
- **Dado** uma nova tentativa de contato
- **Quando** registro
- **Então** ficam a data e o canal, e reenviar o link não cria documento duplicado

### Requirement: CA6 · A tarefa se encerra sozinha
Com o documento assinado anexado ao card, a tarefa de assinatura SHALL se encerrar sozinha.

#### Scenario: CA6 · O assinado é anexado
- **Dado** o documento assinado devolvido
- **Quando** o sistema o anexa ao card
- **Então** a tarefa de assinatura se encerra sozinha

### Requirement: CA7 · Retorno autenticado e sem repetição
O retorno de assinatura do ZapSign SHALL ser autenticado, e o mesmo evento repetido MUST NOT anexar o documento duas vezes.

#### Scenario: CA7 · O retorno chega
- **Dado** o retorno de assinatura do ZapSign
- **Quando** ele chega
- **Então** é autenticado, e o mesmo evento repetido não anexa duas vezes

### Requirement: CA9 · Erro com a opção de tentar de novo
Com um erro na geração do documento, a tarefa SHALL mostrar a mensagem e a opção de tentar de novo.

#### Scenario: CA9 · O ZapSign falha
- **Dado** um erro na geração do documento
- **Quando** ele acontece
- **Então** a tarefa mostra a mensagem e a opção de tentar de novo

### Requirement: CA10 · O arquivo final do ZapSign
O documento anexado SHALL ser o arquivo final do ZapSign, com as evidências de assinatura.

#### Scenario: CA10 · Anexar o assinado
- **Dado** o documento assinado
- **Quando** é anexado
- **Então** é o arquivo final do ZapSign, com as evidências

### Requirement: CA11 · Limite de tentativas sobe para a sênior (G15)
Com as tentativas de contato sem assinatura, atingido o limite, a tarefa SHALL subir para a sênior: 2 tentativas, com 3 dias entre elas, regra em código com teste.

#### Scenario: CA11 · O limite é atingido
- **Dado** tentativas de contato sem assinatura
- **Quando** o limite é atingido
- **Então** a tarefa sobe para a sênior

### Requirement: CA12 · O link vai pelo WhatsApp
No envio pelo ZapSign, o cliente SHALL receber o link para assinar por mensagem no WhatsApp; sem ZapSign, o caminho é a assinatura em papel no escritório (GGVP-77).

#### Scenario: CA12 · Enviar o link
- **Dado** o envio pelo ZapSign
- **Quando** o documento é gerado
- **Então** o cliente recebe o link por mensagem no WhatsApp

## Travas

- CA8 é "(proposta)": a consulta periódica ao ZapSign quando o retorno não chega. Não vira código até o Lucas aceitar.
- A espera pela assinatura como tarefa com prazo, lembrete e retomada é proposta do Fernando, não aprovada; aqui vale só o que o CA2 e o CA11 pedem.
