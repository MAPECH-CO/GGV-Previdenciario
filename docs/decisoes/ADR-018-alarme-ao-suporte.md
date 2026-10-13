# ADR-018 · O alarme ao suporte técnico vai ao canal da equipe e abre chamado no Jira

**Data:** 2026-10-13 · **Estado:** aceita · **Decidiu:** Mateus (MAPECH), na GGVP-158 (parte 5)

## Contexto
A vigília do diário roda três vezes por dia por fonte (G13).
- Quando uma rodada falha, a Sênior vê "Reprocessar vigília" no topo da Central.
- O suporte técnico só ficava sabendo pelo log, e só nas falhas de credencial ou da API.
- Três casos ficavam sem aviso nenhum:
  - a rodada que parava no meio (o servidor reiniciado) ficava "rodando" para sempre;
  - a produção sem fonte ligada não rodava nada, e o dia parecia sem publicação.

A GGVP-30 deixou o canal do suporte "a definir". O Lucas disse que é decisão técnica. O Mateus propôs em 02/10 o chamado no Jira e a mensagem no canal da equipe.

## Opções consideradas
1. **Só o portal e o log.**
   - Nada de fora.
   - O suporte só vê se abrir o portal ou o log.
2. **Só o canal da equipe**, por webhook.
   - Uma variável.
   - Some no meio da conversa, e não fica um registro para acompanhar.
3. **O canal e o chamado no Jira.**
   - O canal avisa na hora.
   - O chamado fica no quadro do time até alguém resolver.
   - Precisa de um usuário de serviço no Jira, com token.

## Decisão
O canal e o chamado no Jira (opção 3), por decisão do Mateus em 13/10.

**O que alarma:**
- a falha de qualquer tipo;
- a rodada que não rodou no horário;
- a rodada presa em "rodando" além do tempo limite e mais 5 minutos, que vira falha;
- a vigília sem fonte ligada, uma vez por dia. Nessa hora, a Central da Sênior ganha a linha "Vigília sem fonte ligada".

**Para onde vai:**
- a Central da Sênior, como antes;
- o log;
- o histórico (`alarme_suporte`, com o resultado de cada entrega);
- o suporte, pelo módulo `suporte.ts` (`criarSuporte`).

**Como cada canal liga:**
- **Canal da equipe:** `ALARME_CANAL_URL`, o webhook, que recebe um POST com `{ "text": … }`. O formato serve ao Google Chat e ao Slack.
- **Jira:**
  - as variáveis são `ALARME_JIRA_URL`, `ALARME_JIRA_EMAIL`, `ALARME_JIRA_TOKEN` e `ALARME_JIRA_PROJETO`;
  - o chamado do tipo "Tarefa" é aberto pela API REST (v3), com autenticação básica do usuário de serviço;
  - sem uma das quatro, não abre chamado.
- Só endereço `https`. Cada envio espera até 10 segundos.

**O que vai no texto:** a fonte, o horário da rodada e o motivo, cortado em 300 caracteres. Nunca vai dado de cliente nem texto de publicação.

A falha do canal ou do Jira não derruba a rodada e não tenta de novo sozinha: fica no histórico e no log.

## Consequências
- O suporte sabe na hora, fora do portal, e o chamado fica no quadro até alguém resolver.
- **Sem as variáveis, nada sai:** o alarme fica no portal e no log, como antes. Ligar é tarefa do Coolify.
- **O token do Jira é segredo:** fica só no Coolify, nunca em arquivo do repositório. O usuário de serviço precisa poder criar tarefa no projeto.
- **O tipo "Tarefa" é o do Jira do escritório.** Se o Jira recusar, o canal e o portal ainda avisam, e a recusa fica no log.
- **O monitor do /saude da parte 9 usa o mesmo módulo e o mesmo canal.**
- Reversível por outro ADR: trocar o canal é trocar a variável, e o Jira sai sem as quatro dele.
