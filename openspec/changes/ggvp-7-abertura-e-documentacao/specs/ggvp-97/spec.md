# Spec Delta · ggvp-97 · Boas-vindas ao cliente

## Purpose

Conferido o checklist, o cliente novo recebe a mensagem de boas-vindas. Ela leva as cópias do kit e a lista do que falta, em linguagem simples. Sai pelo Chatwoot, na conversa do cliente, uma vez só, e uma pessoa confere a mensagem antes. Quem já era cliente não recebe. Não há tela própria no Figma: o bloco "Boas-vindas (D1.22)" fica na tela do checklist (step_D1.21 `1818:2`), e o rótulo passa de WhatsApp a Chatwoot, como pede o cartão. Passo D1.22 do Miro, no ramo "Não: cliente novo" do losango "Já era cliente?". O Chatwoot é simulado. O modelo aprovado e o registro de cada mensagem são da GGVP-102: até lá, o modelo é de exemplo. As cópias vêm do grupo contrato (GGVP-89), lidas por uma função do servidor de exemplo até a junção.

Contrato: tipos em `apps/web/src/dados/boasVindas.ts` (`BoasVindas`, `RegistroDasBoasVindas`, `EnvioDasBoasVindas`). Endpoints de quando ligar no servidor:

| Endpoint | Função de exemplo |
|---|---|
| `GET /api/processos/:id/boas-vindas` | `obterBoasVindas` |
| `POST /api/processos/:id/boas-vindas` | `enviarBoasVindas` |

## ADDED Requirements

### Requirement: CA1 · A mensagem leva as cópias e o que falta
Conferido o checklist, a mensagem de boas-vindas SHALL levar as cópias do kit e, se houver, a lista do que falta, em linguagem simples.

#### Scenario: CA1 · Checklist conferido com pendências
- **Dado** o checklist conferido
- **Quando** o sistema envia as boas-vindas
- **Então** a mensagem leva as cópias e, se houver, a lista do que falta, em linguagem simples

### Requirement: CA2 · A mensagem fica no histórico
A mensagem enviada SHALL aparecer no histórico da ficha e em "Últimos contatos". O registro completo de cada mensagem é da GGVP-102.

#### Scenario: CA2 · Abrir o card depois do envio
- **Dado** a mensagem enviada
- **Quando** abro o card
- **Então** ela aparece no histórico

### Requirement: CA3 · Quem já era cliente não recebe
Quem já era cliente do escritório, inclusive quando abre um processo novo (GGVP-124), MUST NOT receber as boas-vindas. A tela SHALL dizer por quê.

#### Scenario: CA3 · Segundo processo
- **Dado** alguém que já era cliente do escritório, inclusive quando abre um processo novo
- **Quando** o checklist é conferido
- **Então** as boas-vindas não são enviadas

### Requirement: CA4 · Uma vez, pelo Chatwoot, conferida antes
As boas-vindas do cliente novo SHALL ir uma única vez, pelo Chatwoot (canal oficial do escritório), na conversa do cliente. "Enviar pelo Chatwoot" MUST ficar desabilitado até alguém marcar "Conferi a mensagem". O servidor MUST recusar a segunda vez.

#### Scenario: CA4 · Enviar as boas-vindas
- **Dado** um cliente novo
- **Quando** as boas-vindas são enviadas
- **Então** vão uma única vez, pelo Chatwoot, na conversa do cliente, e alguém confere a mensagem antes de sair

### Requirement: CA5 · Modelo padrão com as pendências do checklist
A mensagem SHALL ser montada pelo modelo padrão aprovado e listar as pendências que vêm do checklist. Até a GGVP-102 trazer o modelo aprovado, vale o modelo de exemplo, numa função com teste.

#### Scenario: CA5 · Montar a mensagem
- **Dado** a mensagem de boas-vindas
- **Quando** é montada
- **Então** usa o modelo padrão e lista as pendências que vêm do checklist

### Requirement: CA6 · Falha no envio vai ao histórico e vira tarefa
Uma falha no envio SHALL ficar no histórico e virar a tarefa "Reenviar boas-vindas" para o Atendimento. Enviada depois, a tarefa sai. No simulado, falha quando a ficha não tem telefone, porque o Chatwoot não acha a conversa.

#### Scenario: CA6 · Ficha sem telefone
- **Dado** uma falha no envio
- **Quando** acontece
- **Então** a falha fica no histórico e vira tarefa para o Atendimento
