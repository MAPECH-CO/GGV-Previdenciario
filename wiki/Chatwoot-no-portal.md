
> Fonte versionada: [`docs/arquitetura/chatwoot-no-portal.md`](https://github.com/femezher/GGV-Prev-/blob/main/docs/arquitetura/chatwoot-no-portal.md) no repositório. Edite lá (por PR), não na wiki.

# Estudo · Incorporar o Chatwoot ao portal

**Estado:** estudo para virar ADR na Sprint 0 · **Data:** 26/09/2026 · **Autor:** MAPECH

Estudo de como trazer o Chatwoot, que o escritório já usa, para dentro do portal do GGV Previdenciário,
com um objetivo de negócio claro: **fazer o funcionário trabalhar dentro do portal** e não voltar a tocar
o caso por fora dele. Não é um estudo de "trocar o Chatwoot": é de como encaixá-lo.

## 1. Contexto
- O escritório já roda um **Chatwoot** em produção, os funcionários usam, e usam muito o **chatbot**.
- O portal novo (este projeto) quer ser o lugar único de trabalho. Se a conversa com o cliente continua
  numa aba separada, o caso volta a viver fora do portal, e é isso que se quer evitar.
- Há **dois "chats" diferentes** no projeto, e o estudo é só sobre o segundo:
  1. **Chat interno por perfil** (GGVP-82, ADR-003): o funcionário conversa com o *portal* em linguagem
     natural ("o que falta no caso X?"). Não é cliente, não é Chatwoot.
  2. **Conversa com o cliente** (o Chatwoot): WhatsApp e outros canais, com o chatbot na frente. É o que
     este estudo trata.
- O BPMN já tem os pontos onde essa conversa entra: **D5** (registrar conversa com lead ou cliente),
  **D1** (mensagens e boas-vindas), e as histórias **GGVP-102** (mensagens ao cliente com modelo e
  registro), **GGVP-97** (boas-vindas) e **GGVP-101** (cobrança).

## 2. O que o Chatwoot oferece (e que não vale a pena reconstruir)
- **Caixa de entrada omnichannel** para o agente: WhatsApp, e-mail, widget de site, Instagram etc., tudo num lugar.
- **Widget de site** para o cliente, com identificação do usuário e validação por HMAC.
- **Agent Bots / chatbot**: fluxo automático antes de cair para uma pessoa (é o "chatbot" que já usam).
- **APIs**: de Aplicação (conversas, mensagens, contatos, rótulos), de Plataforma (usuários, SSO) e de Cliente.
- **Webhooks**: eventos como `conversation_created`, `message_created`, `conversation_status_changed`.
- **SSO**: link de login gerado pela API de Plataforma, e SAML na versão enterprise.
- **Rótulos, equipes, CSAT, macros**: organização e resposta padronizada.
- É **open-source e self-hostável**. Reconstruir isso no portal seria jogar fora meses de coisa que já funciona.

## 3. Três níveis de incorporação
| Nível | O que é | Prende o funcionário? | Esforço |
|---|---|---|---|
| **0 — hoje** | Chatwoot numa aba à parte, sem ligação com o portal | Não: o trabalho acontece fora | — |
| **1 — embutir o inbox** | O painel do Chatwoot dentro do portal, num `iframe`, com **SSO** para não pedir outro login; abre já na conversa do contato do caso (deep-link) | Em parte: ele fica na tela do portal, mas a conversa ainda não é o caso | Baixo |
| **2 — integração nativa** | O portal ouve os **webhooks** do Chatwoot, **liga cada conversa ao caso** (ficha do cliente), mostra a conversa na linha do tempo do caso e **envia a resposta pela API** do Chatwoot. O bot e os rótulos conversam com o portal | Sim: a conversa **é** parte do caso; não há motivo para sair | Médio |

O **Nível 3** (reconstruir a mensageria dentro do portal e aposentar o Chatwoot) fica **descartado**: joga
fora o chatbot que já funciona e a operação omnichannel, sem ganho para o objetivo.

## 4. Recomendação
**Manter o Chatwoot como motor das conversas com o cliente** (canais + chatbot) e incorporá-lo em duas fases:

- **Fase 1 — rápido, para tirar o funcionário da aba separada.** Uma seção **"Conversas"** no portal com o
  inbox do Chatwoot embutido por `iframe` e **SSO** (o login do portal vale para o Chatwoot). Do card do
  caso, um botão "Abrir conversa" leva direto à conversa daquele contato. Entrega valor em dias, sem tocar
  no modelo de dados.
- **Fase 2 — o que realmente prende.** Integração por **API + webhook**: cada conversa é casada ao
  cliente/lead do portal e aparece na **linha do tempo do caso**; o funcionário **responde de dentro do
  portal** (o portal chama a API do Chatwoot, que entrega no WhatsApp); o **D5** deixa de ser trabalho
  manual — a conversa já chega registrada e a IA identifica o que mudou; **GGVP-102** manda mensagem por
  modelo e registra; o **handoff do bot** para humano vira tarefa no portal, com laço e escalonamento
  (GGVP-94).

Assim o Chatwoot continua sendo o que é bom (canais e bot), e o portal vira o lugar onde a conversa
acontece no contexto do caso.

## 5. Como casar conversa e caso
- **Chave de casamento:** telefone do WhatsApp e/ou CPF do contato do Chatwoot ↔ cliente/lead do portal.
- **Identidade:** usar a validação por HMAC do Chatwoot para o contato, e o SSO para o agente.
- **Conversa sem cliente ainda:** vai para uma **fila de triagem**, do mesmo jeito que o D4 trata a
  publicação sem número CNJ. Nada se perde; uma pessoa liga a conversa ao caso.
- **Lead novo pelo chatbot:** o bot qualifica, e o handoff cria o lead e a tarefa no portal (liga com D1 e D5).

## 6. Governança e LGPD (não é opcional)
- A conversa pode conter **dado de saúde**, que é dado pessoal **sensível**. Vale o mesmo que o ADR de LGPD
  pendente (008) e os **portões** de `docs/requisitos/portoes-governanca.md`.
- **Acesso por perfil** (`docs/requisitos/perfis.md`): quem vê a conversa segue a raia. Financeiro e cliente
  não veem estratégia; a conversa de um caso não vaza para quem não é do caso.
- **A IA sugere, uma pessoa envia.** Resposta ao cliente não sai automática sem revisão — é a regra do
  `CLAUDE.md` e vale também para mensagem que o bot ou a IA redige.
- **Histórico** de quem falou o quê, incluindo a IA (GGVP-99).
- **Retenção** do conteúdo das conversas: entra nas dúvidas Q11 e Q17, a responder no refinamento.
- **Onde roda o Chatwoot** (self-host ou nuvem) decide residência do dado sensível: confirmar antes da Fase 2.

## 7. Esforço, riscos e dependências
- Fase 1: baixa. Depende de SSO ligado e de o Chatwoot aceitar ser embutido (cabeçalhos de `iframe`).
- Fase 2: média. Riscos: **webhook silencioso** (tratar com o `ecc-silent-failure-hunter`: confirmação e
  reprocessamento), **qualidade do casamento** telefone/CPF, e **manutenção** da versão do Chatwoot.
- Não há mudança de arquitetura do produto: o Chatwoot é serviço externo, o portal integra. Vira ADR mesmo assim.

## 8. A confirmar com quem administra o Chatwoot hoje
1. Chatwoot é **self-hosted** (qual servidor) ou **nuvem** (chatwoot.com)?
2. Quais **canais** estão ligados (WhatsApp API oficial? não oficial via Evolution/Z-API? e-mail? site)?
3. O **"chatbot"** que usam é Agent Bot do próprio Chatwoot, Dialogflow, ou um fluxo no **n8n**?
4. Tem **SSO** hoje? Qual provedor de login o portal vai usar (para o mesmo login valer nos dois)?
5. Quem **administra** o Chatwoot e mantém os canais no ar?

## 9. Próximos passos
- Virar **ADR-015** na Sprint 0 (proposta em `docs/decisoes/ADR-015-chatwoot-motor-de-conversas.md`).
- **Spike de 2 dias** (rótulo `spike`): provar o `iframe` + SSO da Fase 1 e receber um webhook de teste do Chatwoot ligando a conversa a um caso.
- Derivar as histórias da Fase 2 a partir de D5, GGVP-102 e GGVP-94, ligadas aos passos do BPMN.
