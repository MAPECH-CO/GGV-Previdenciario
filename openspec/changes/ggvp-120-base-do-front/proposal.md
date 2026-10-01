# GGVP-120 · Base do front · passo BPMN: nenhum (fundação) · perfil: time de desenvolvimento

## Por quê

O `apps/web` foi escrito em 01/10 antes de existir cartão e change, e pela regra do kit não vai para PR assim. Esta change dá história a ele: cada critério do GGVP-120 vira requisito com teste, sem reescrever o que já funciona.

## O que muda

- Nenhum comportamento novo: o código de `apps/web` fica como está e ganha a spec da capacidade nova `base-do-front`, um requisito por critério (CA1 a CA7).
- Entram só os testes que faltam para provar cada critério (lista no `tasks.md`).
- Entra o Playwright, dependência nova (motivo no `design.md`), para o que o teste de componente não enxerga.

## Fora do escopo

- Monorepo (workspace do pnpm), `apps/api`, `packages/campos`, `packages/contratos`, banco e CI: **GGVP-118** (Mateus). Esta história entrega só o conteúdo de `apps/web`, que roda sozinho com `npm`; o GGVP-118 o liga ao monorepo, sem recriar.
- As regras da Central, que são do **GGVP-78**: ordem por prazo, vencidos e de hoje no topo, estado vazio, quem vê "Tarefas do setor" e quem atribui (dúvida GGVP-115), lista fixa de ações por perfil (CA5, a confirmar com o PO), permissões da busca, as outras Centrais. Aqui a Central do Atendimento é só a vitrine das peças.
- Login e perfil de verdade (GGVP-117, GGVP-96): aqui a função é fixa, "Atendimento". Guardar tema e fonte no perfil da pessoa ("No portal real, é a preferência do usuário", `docs/prototipo/figma.md`) fica para depois do login.
- Ligar o chat (GGVP-82), a busca (GGVP-78), o Suporte (Chatwoot) e o "Trocar perfil" (`59:979`): os botões existem com o visual do Figma e ainda não fazem nada.
- Agenda, Novo cliente, ficha do cliente e telas de passo: cada uma na sua história; até lá caem em "Esta tela ainda não foi construída". Roteador de verdade: com o GGVP-86.
- Cores de status em laranja ("A confirmar com o PO", `docs/prototipo/figma.md`): os tokens seguem o Figma de hoje; se mudar lá, roda `npm run tokens`.
- Logotipo: o "§" é provisório; a marca é decisão do Lucas.

## Portões envolvidos

- Nenhum.

## Travas

- **CA4:** o formato do título da tarefa vem do CA5 do GGVP-78, decisão do Pedro em 29/09 ainda a confirmar com o PO. Não impede o teste; se o Lucas mudar, muda no GGVP-78.
- **CA5:** quem vê "Tarefas do setor" é a dúvida GGVP-115, sem resposta. A aba fica como no Figma `11:2`, sem conteúdo.
