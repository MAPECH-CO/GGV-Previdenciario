# GGVP-120 · Base do front: tokens do Figma, tema e fonte, peças comuns das Centrais

> Tarefa técnica do épico **GGVP-2 · Fundação técnica**, no molde do GGVP-118. Cartão no Jira: [GGVP-120](https://mapech.atlassian.net/browse/GGVP-120), rótulo `fundacao`. Sem chave provisória: nasceu em 01/10/2026 para dar história ao código de `apps/web` escrito antes da change. Fonte: variáveis e telas do Figma (página 10:2).

**Como** time de desenvolvimento\
**quero** o `apps/web` de pé com os tokens do Figma, o tema escuro, a fonte grande e as peças comuns das Centrais\
**para** que as telas das histórias seguintes (GGVP-78, 86, 85, 89, 32) nasçam sobre a mesma base, sem refazer cor, fonte, barra do topo e fila em cada uma.

**Passo BPMN:** nenhum (fundação) · **Épico:** GGVP-2 · **Prioridade:** 1 · **Estimativa:** P (o código já existe; a change confere e documenta)\
**Perfil:** time de desenvolvimento

## Critérios de aceite
1. **Dado** o retrato das variáveis do Figma em `figma-tokens.json` (coleção `Tema`: 29 cores, modos Claro e Escuro; coleção `Acessibilidade`: 17 tamanhos de fonte, modos Padrão e Fonte grande), **quando** rodo `npm run tokens`, **então** sai o `tokens.css` com os nomes do Figma (`cor/fundo` vira `--cor-fundo`), e um teste falha se o CSS ficar fora de dia com o JSON ou se algum `var(--x)` do código apontar para token que não existe.
2. **Dado** qualquer tela, **quando** clico em "☾ Escuro" ou "A+", **então** a tela inteira troca de tema ou de tamanho de fonte e a escolha fica guardada no navegador; `?tema=escuro&fonte=grande` no endereço vence a escolha guardada; valor inválido no endereço, ou navegador sem armazenamento, segue o padrão (claro, fonte padrão).
3. **Dado** a barra do topo, **quando** abro uma tela, **então** vejo a marca "GGV Previdenciário", os botões da função com o da página atual aceso, a ação principal da função (no Atendimento, "+ Novo cliente"), os botões de tema e de fonte e o nome da função de quem está logado (Figma `11:2`).
4. **Dado** uma tarefa numa fila, **quando** ela aparece, **então** mostra o código do passo do BPMN, o nome do cliente (ou o contexto, quando não há cliente), a ação, o detalhe na linha de baixo e o prazo; a linha abre o passo e o nome abre a ficha, em links separados; tarefa urgente vem com a cor de ação e avisa o leitor de tela.
5. **Dado** a raiz `/`, **quando** abro, **então** vejo a Central do Atendimento montada com as peças, como no Figma `11:2`, com dados fictícios: busca com nome acessível; chat "✦ Pergunte ou peça" com sugestões (clicar preenche e não envia; enviar sem servidor avisa e mantém o texto); abas "Minhas tarefas" e "Tarefas do setor", que trocam no clique e nas setas do teclado; a fila; a aba "✦ Suporte".
6. **Dado** `/tokens`, **quando** abro, **então** vejo as 29 cores, os 17 tamanhos de fonte e os raios, e eles reagem à troca de tema e de fonte, para comparar com o Figma.
7. **Dado** um caminho que ainda não tem tela, **quando** abro, **então** vejo "Esta tela ainda não foi construída", o caminho e "Voltar ao início".

## Fora do escopo desta história
- Monorepo (workspace do pnpm), `apps/api`, `packages/campos`, `packages/contratos`, banco e CI: **GGVP-118** (Mateus). Esta história entrega só o conteúdo de `apps/web`, que roda sozinho com `npm`; o GGVP-118 o liga ao monorepo, sem recriar.
- As regras da Central, que são do **GGVP-78**: ordem por prazo, vencidos e de hoje no topo, estado vazio, quem vê "Tarefas do setor" e quem atribui (dúvida GGVP-115), lista fixa de ações por perfil (CA5, a confirmar com o PO), permissões da busca, as outras Centrais. Aqui a Central do Atendimento é só a vitrine das peças.
- Login e perfil de verdade (GGVP-117, GGVP-96): aqui a função é fixa, "Atendimento". Guardar tema e fonte no perfil da pessoa ("No portal real, é a preferência do usuário", `docs/prototipo/figma.md`) fica para depois do login.
- Ligar o chat (GGVP-82), a busca (GGVP-78), o Suporte (Chatwoot) e o "Trocar perfil" (`59:979`): os botões existem com o visual do Figma e ainda não fazem nada.
- Agenda, Novo cliente, ficha do cliente e telas de passo: cada uma na sua história; até lá caem em "Esta tela ainda não foi construída". Roteador de verdade: com o GGVP-86.
- Cores de status em laranja ("A confirmar com o PO", `docs/prototipo/figma.md`): os tokens seguem o Figma de hoje; se mudar lá, roda `npm run tokens`.
- Logotipo: o "§" é provisório; a marca é decisão do Lucas.

## Dados e permissões
- Só dados fictícios, em `apps/web/src/dados/`. Nenhum dado de cliente, nenhum dado de saúde.

## Portões de governança
- Nenhum portão direto.

## Tela ou referência
- Figma `nHOPzl005CpWDXUWyVZIo6`, página 10:2: variáveis `Tema` e `Acessibilidade`; Central de trabalho · Atendimento `11:2`; modos de referência na Advogada: tema escuro `66:284`, fonte grande `66:390`.
- Código: `apps/web` (como rodar em `apps/web/README.md`).

## Dúvidas abertas (bloqueiam a DoR)
- Nenhuma registrada. Conferir no refinamento.

## Dúvidas respondidas pelo PO
- (vazio)
