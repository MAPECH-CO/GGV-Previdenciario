# ADR-016 · Kit de agentes da OpenAI no chat do portal

**Data:** 2026-10-09 · **Estado:** aceita · **Decidiu:** Mateus (MAPECH), na GGVP-142

## Contexto
O chat das Centrais e a aba Suporte (GGVP-82) rodavam na tela, com a IA simulada. A GGVP-142 liga o chat no motor de IA
do portal. A pessoa pergunta, a IA responde com as fontes e, quando a pessoa pede uma ação, mostra um cartão. Nada
acontece sem o "Confirmar".

O cartão da GGVP-142 deixou para o Mateus a escolha técnica: usar ou não o kit de agentes da OpenAI em TypeScript dentro
do motor. Seja qual for a escolha, a ação só acontece depois do clique, e números e permissões seguem como código (CA2,
CA3). O ADR-001 fixou TypeScript de ponta a ponta.

## Opções consideradas
1. **Só o motor de hoje** (`sugerir`, chat completions com resposta em texto ou JSON). Cada ação vira um JSON que o
   código valida, e o servidor guarda o cartão. Sem dependência nova, mas o laço de ferramentas (ler o caso, buscar no
   acervo, propor a ação) teria de ser escrito à mão.
2. **Kit de agentes da OpenAI em TypeScript** (`@openai/agents`). Traz o laço de ferramentas pronto, ferramentas com
   esquema Zod e aprovação da pessoa antes de executar (`needsApproval`). O estado da conversa pode ser guardado até o
   clique.

## Decisão
O chat usa o kit de agentes (`@openai/agents` 0.18.0, a versão de setembro, compatível com o Zod 4 do portal), dentro
do motor da API:
- **Modelo:** o mesmo endpoint de chat completions do motor, com o cliente da OpenAI criado pelo portal. O `fetch` é
  injetado, e o teste passa um falso.
- **Rastreamento desligado:** nada da conversa vai para o painel da OpenAI (LGPD; dado de saúde).
- **Leitura sem aprovação, ação com aprovação:** as ferramentas de leitura (o caso, o acervo, as tarefas, o portão)
  rodam sozinhas. As de ação pedem aprovação, e a aprovação vira o cartão da tela.
- **As travas seguem como código:** as recusas e os portões, antes do modelo; a lista fixa de ações do perfil, que
  define quais ferramentas o agente recebe; e as permissões, pela rota da tela, com a sessão de quem confirmou.
- **Registro:** cada conversa vai para `chamada_ia`, como as outras chamadas do motor.

## Consequências
- **Dependência nova na API**, fixa na versão 0.18.0. O kit é 0.x e muda rápido; subir de versão é decisão de quem
  mexer no chat, com os testes do chat.
- **O estado da conversa** fica em memória até o clique (30 minutos). Reiniciar o servidor perde os cartões em aberto,
  e a pessoa pede de novo.
- **As outras finalidades da IA** seguem pelo motor de hoje (`sugerir`). O kit fica só no chat.
- Reversível por outro ADR: as ferramentas viram chamadas do motor de hoje, sem mudar o contrato do chat.
