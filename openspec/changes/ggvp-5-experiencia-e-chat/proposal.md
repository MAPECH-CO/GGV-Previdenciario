# GGVP-5 · Experiência por perfil e chat · passos BPMN: transversais (D1 a D3b) · perfis: toda a equipe

## Por quê

Hoje cada tela mostra um pedaço do caso e o chat existe em três pedaços (Central do Atendimento, do Jurídico administrativo e da advogada). A equipe precisa entender em segundos onde o caso está e o que trava, e perguntar e pedir coisas ao portal por escrito, sem decorar telas. A página do processo junta o caso numa linha só; o chat vira um motor único, que consulta com as permissões do perfil e só executa depois de um cartão de confirmação, sem contornar nenhum portão (G1 a G22).

## Histórias na ordem

Uma sessão, na pasta principal, na branch `feat/GGVP-5-experiencia-e-chat` (base: a documentação médica, o Relacionamento e a Perícia, já juntos). Quatro partes, um commit ao fim de cada uma.

1. GGVP-86 · Navegar pelo caso numa linha só · Jurídico e Atendimento
2. GGVP-82 · Conversar com o portal em linguagem natural · critérios de consulta (CA1, CA2, CA6, CA10, CA11)
3. GGVP-82 · critérios de ação (CA3, CA4, CA5, CA7, CA8, CA9, CA12)
4. Fechamento: typecheck, lint, testes e Playwright

Cada história ganha uma spec em `specs/ggvp-n/spec.md` e uma seção no `tasks.md`.

## Fora do escopo

- Servidor, banco e IA de verdade (Mateus). Aqui só tela, sobre o servidor de exemplo em `apps/web/src/dados/`, com a IA simulada. O motor de IA do pedido #26 (`feat/GGVP-14-ia-juridica`) entra na junção.
- O chat escrever a petição (GGVP-63: aqui ele só pede a peça) e falar com o cliente.
- Mover cartões do Jira e abrir o pedido de revisão: o orquestrador faz.
