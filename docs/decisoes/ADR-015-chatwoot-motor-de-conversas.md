# ADR-015 · Chatwoot como motor das conversas com o cliente

**Data da proposta:** 2026-09-26 · **Estado:** aceita
**Registro da aceitação:** 2026-10-12, conforme orientação de Pedro na GGVP-159.

## Contexto
O escritório já usa o Chatwoot em produção, com um chatbot que a equipe usa bastante. O portal novo quer
ser o lugar único de trabalho; se a conversa com o cliente fica numa aba à parte, o caso volta a ser
tocado fora do portal. Estudo completo em `docs/arquitetura/chatwoot-no-portal.md`.

## Opções consideradas
1. **Nível 0 — manter separado.** Chatwoot numa aba própria. O trabalho continua fora do portal. Descartada.
2. **Nível 1 — embutir o inbox.** Painel do Chatwoot no portal por `iframe` com SSO, deep-link por contato.
3. **Nível 2 — integração nativa.** Webhooks ligam cada conversa ao caso; resposta enviada pela API do
   Chatwoot de dentro do portal; conversa na linha do tempo do caso.
4. **Nível 3 — reconstruir a mensageria no portal.** Joga fora o chatbot e a operação omnichannel. Descartada.

## Decisão
Manter o Chatwoot como **motor das conversas** (canais + chatbot) e incorporar em duas fases: **Fase 1**
Nível 1 (iframe + SSO), rápido; **Fase 2** Nível 2 (API + webhook ligada ao caso), que é o que de fato
prende o funcionário no portal e alimenta o D5 e a GGVP-102 sem trabalho manual.

A aceitação define o Chatwoot como motor; não comprova que as duas fases estão completas. Na main de 12/10,
`apps/api/src/chatwoot.ts` e `apps/api/src/rotas/mensagens.ts` já integram a API para contato, conversa e envio.
O recebimento contínuo de mensagens na tela e a ligação de todos os fluxos ainda dependem de entrega específica.
Sem serviço configurado ou sem envio confirmado, a tela deve informar simulação ou falha, nunca entrega real.
Não foi acessado o Chatwoot para atualizar este ADR.

## Consequências
- O Chatwoot vira dependência de serviço externo do portal; entra na configuração da implantação, não no código.
- A conversa pode conter dado de saúde (sensível): valem os portões e o ADR de LGPD (008); acesso por perfil.
- A IA sugere a resposta; uma pessoa confere e envia. Nada é enviado ao cliente automaticamente sem revisão.
- Depende de confirmar com quem administra o Chatwoot: self-host ou nuvem, canais, natureza do chatbot, SSO.
- Reversível só por outro ADR.
